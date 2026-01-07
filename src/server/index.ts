/**
 * 🦉 TypeOwl Server Module
 * 
 * Exposes your TypeScript types via HTTP endpoints.
 * Use this in your backend to make types available to frontends.
 */

import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import type {
  TypeManifest,
  TypeDefinition,
  EndpointDefinition,
  HttpMethod,
  TypeOwlServerConfig,
  TypeOwlServerPluginConfig,
  PropertyDefinition,
  TypeFileReference,
  TypeDomain,
  TypeOwlRequestContext,
  TypeOwlGuardConfig,
  TypeOwlHandler,
  TypeOwlResponse
} from '../types.js';

// Re-export types and config helper
export { defineServerConfig } from '../types.js';
export type { 
  TypeOwlServerPluginConfig, 
  TypeOwlGuardConfig,
  TypeOwlHandler,
  TypeOwlRequestContext,
  TypeOwlResponse
} from '../types.js';

// Re-export extraction utilities
export { 
  extractTypes, 
  extractFromFile, 
  extractTypesAsRecord,
  type ExtractedType,
  type ExtractOptions,
  type ExtractedTypes
} from './extract.js';

// Import for internal use
import { extractTypes as extractTypesSync } from './extract.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ TYPE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export class TypeRegistry {
  /** Map of domain name to types in that domain */
  private domains: Map<string, TypeDomain> = new Map();
  /** Currently active domain for registration */
  private currentDomain: string = 'main';
  /** API endpoints */
  private endpoints: Map<string, EndpointDefinition> = new Map();
  /** Generated type file cache (domain -> { content, hash }) */
  private typeFileCache: Map<string, { content: string; hash: string }> = new Map();
  /** Config */
  private config: Required<Omit<TypeOwlServerConfig, 'typeSources'>> & { typeSources: string[] };
  /** Plugin config (when created from config file) */
  private pluginConfig?: TypeOwlServerPluginConfig;

  constructor(config: TypeOwlServerConfig = {}) {
    // Normalize typeSources to array of absolute paths
    const typeSources = config.typeSources 
      ? (Array.isArray(config.typeSources) ? config.typeSources : [config.typeSources])
          .map(p => resolve(process.cwd(), p))
      : [];
    
    this.config = {
      basePath: config.basePath ?? '/__typeowl',
      version: config.version ?? '0.0.0',
      includeGitCommit: config.includeGitCommit ?? false,
      typeSources
    };
    // Initialize default domain
    this.domains.set('main', { types: {} });
  }

  /**
   * Check if a file path is allowed for type extraction
   */
  private isAllowedSource(filePath: string): boolean {
    if (this.config.typeSources.length === 0) {
      return false; // No sources configured = extraction disabled
    }
    
    const absolutePath = filePath.startsWith('/') 
      ? filePath 
      : resolve(process.cwd(), filePath);
    
    return this.config.typeSources.some(allowedPath => {
      // Check if the file is within the allowed path (file or directory)
      return absolutePath === allowedPath || absolutePath.startsWith(allowedPath + '/');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Domain Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the current domain for type registration
   * Creates the domain if it doesn't exist
   */
  domain(name: string): this {
    this.currentDomain = name;
    if (!this.domains.has(name)) {
      this.domains.set(name, { types: {} });
    }
    this.invalidateCache(name);
    return this;
  }

  /**
   * Get list of all domains
   */
  getDomains(): string[] {
    return Array.from(this.domains.keys());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Type Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a type from a Zod schema
   */
  registerZod<T extends z.ZodType>(name: string, schema: T): this {
    const typeDef = zodToTypeDefinition(schema);
    this.registerTypeInDomain(name, typeDef);
    return this;
  }

  /**
   * Register a type definition directly
   */
  registerType(name: string, definition: TypeDefinition): this {
    this.registerTypeInDomain(name, definition);
    return this;
  }

  /**
   * Register an object type with properties
   */
  registerObject(name: string, properties: Record<string, TypeDefinition | { type: TypeDefinition; optional?: boolean }>): this {
    const props: Record<string, PropertyDefinition> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      if ('type' in value && 'optional' in value) {
        props[key] = value as PropertyDefinition;
      } else {
        props[key] = { type: value as TypeDefinition };
      }
    }
    
    this.registerTypeInDomain(name, { kind: 'object', properties: props });
    return this;
  }

  /**
   * Extract and register types directly from a TypeScript source file
   * 
   * ⚠️ Requires `typeSources` to be configured in createTypeOwl() for security.
   * 
   * @example
   * // Configure allowed sources
   * const typeowl = createTypeOwl({
   *   version: '1.0.0',
   *   typeSources: './src/types.ts'  // or ['./src/types/', './src/models/']
   * });
   * 
   * // In your types.ts file:
   * type Blog = { id: string; title: string; content: string; }
   * interface Product { name: string; price: number; }
   * 
   * // Register them directly from the source
   * typeowl
   *   .domain('content')
   *   .extractAndRegister(import.meta.url, ['Blog', 'Product']);
   * 
   * @throws Error if file is not in allowed typeSources
   */
  extractAndRegister(file: string, typeNames: string[]): this {
    // Resolve the file path
    let filePath: string;
    if (file.startsWith('file://')) {
      filePath = fileURLToPath(file);
    } else if (file.startsWith('/')) {
      filePath = file;
    } else {
      filePath = resolve(process.cwd(), file);
    }
    
    // Security check: ensure file is in allowed sources
    if (!this.isAllowedSource(filePath)) {
      const configured = this.config.typeSources.length > 0 
        ? `Allowed sources: ${this.config.typeSources.join(', ')}`
        : 'No typeSources configured. Set typeSources in createTypeOwl() to enable extraction.';
      
      throw new Error(
        `[TypeOwl] Type extraction not allowed from: ${filePath}\n` +
        `${configured}\n\n` +
        `Example:\n` +
        `  const typeowl = createTypeOwl({\n` +
        `    typeSources: '${dirname(filePath)}'\n` +
        `  });`
      );
    }
    
    const extracted = extractTypesSync({ file: filePath, types: typeNames });
    
    for (const type of extracted) {
      this.registerTypeInDomain(type.name, type.definition);
    }
    
    return this;
  }

  private registerTypeInDomain(name: string, definition: TypeDefinition): void {
    const domain = this.domains.get(this.currentDomain)!;
    domain.types[name] = definition;
    this.invalidateCache(this.currentDomain);
  }

  private invalidateCache(domain: string): void {
    this.typeFileCache.delete(domain);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Endpoint Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register an API endpoint with its types
   */
  registerEndpoint(
    method: HttpMethod,
    path: string,
    types: {
      body?: string;
      params?: string;
      query?: string;
      response: string;
      description?: string;
    }
  ): this {
    const key = `${method} ${path}`;
    this.endpoints.set(key, {
      method,
      path,
      ...types
    });
    return this;
  }

  /**
   * Convenience methods for common HTTP methods
   */
  get(path: string, response: string, options?: { query?: string; params?: string; description?: string }): this {
    return this.registerEndpoint('GET', path, { response, ...options });
  }

  post(path: string, response: string, options?: { body?: string; params?: string; description?: string }): this {
    return this.registerEndpoint('POST', path, { response, ...options });
  }

  put(path: string, response: string, options?: { body?: string; params?: string; description?: string }): this {
    return this.registerEndpoint('PUT', path, { response, ...options });
  }

  patch(path: string, response: string, options?: { body?: string; params?: string; description?: string }): this {
    return this.registerEndpoint('PATCH', path, { response, ...options });
  }

  delete(path: string, response: string, options?: { params?: string; description?: string }): this {
    return this.registerEndpoint('DELETE', path, { response, ...options });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-Typed Endpoint Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register an endpoint with automatic type extraction and validation.
   * 
   * This method:
   * 1. Extracts types from Zod schemas
   * 2. Registers them with TypeOwl
   * 3. Returns a validated handler wrapper
   * 
   * @example
   * // Define schemas
   * const CreateUserSchema = z.object({ email: z.string().email(), name: z.string() });
   * const UserSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });
   * 
   * // Register endpoint with auto-validation
   * typeowl.endpoint(app, 'POST', '/api/users', {
   *   body: CreateUserSchema,
   *   response: UserSchema,
   * }, async ({ body }) => {
   *   // body is validated and typed as { email: string, name: string }
   *   const user = await createUser(body);
   *   return user;  // Must match UserSchema
   * });
   */
  endpoint<
    TBody extends z.ZodType | undefined = undefined,
    TParams extends z.ZodType | undefined = undefined,
    TQuery extends z.ZodType | undefined = undefined,
    TResponse extends z.ZodType | undefined = undefined
  >(
    app: unknown,
    method: HttpMethod,
    path: string,
    schemas: {
      body?: TBody;
      params?: TParams;
      query?: TQuery;
      response?: TResponse;
      description?: string;
      /** Domain to register types in (default: 'endpoints') */
      domain?: string;
    },
    handler: (ctx: {
      body: TBody extends z.ZodType ? z.infer<TBody> : undefined;
      params: TParams extends z.ZodType ? z.infer<TParams> : Record<string, string>;
      query: TQuery extends z.ZodType ? z.infer<TQuery> : Record<string, string>;
      request: unknown;
      reply: unknown;
    }) => Promise<TResponse extends z.ZodType ? z.infer<TResponse> : unknown>
  ): this {
    const domain = schemas.domain ?? 'endpoints';
    const endpointName = this.generateEndpointTypeName(method, path);
    
    // Register types from Zod schemas
    this.domain(domain);
    
    if (schemas.body) {
      const typeName = `${endpointName}Body`;
      this.registerZod(typeName, schemas.body);
    }
    if (schemas.params) {
      const typeName = `${endpointName}Params`;
      this.registerZod(typeName, schemas.params);
    }
    if (schemas.query) {
      const typeName = `${endpointName}Query`;
      this.registerZod(typeName, schemas.query);
    }
    if (schemas.response) {
      const typeName = `${endpointName}Response`;
      this.registerZod(typeName, schemas.response);
    }
    
    // Register endpoint definition
    this.registerEndpoint(method, path, {
      body: schemas.body ? `${endpointName}Body` : undefined,
      params: schemas.params ? `${endpointName}Params` : undefined,
      query: schemas.query ? `${endpointName}Query` : undefined,
      response: schemas.response ? `${endpointName}Response` : 'unknown',
      description: schemas.description,
    });
    
    // Create validated handler wrapper
    const wrappedHandler = async (request: unknown, reply: unknown) => {
      const req = request as { body?: unknown; params?: unknown; query?: unknown };
      const rep = reply as { code: (n: number) => { send: (data: unknown) => unknown } };
      
      try {
        // Validate body
        let validatedBody: unknown = undefined;
        if (schemas.body && req.body !== undefined) {
          const result = schemas.body.safeParse(req.body);
          if (!result.success) {
            return rep.code(400).send({
              error: 'Validation failed',
              field: 'body',
              issues: result.error.issues,
            });
          }
          validatedBody = result.data;
        }
        
        // Validate params
        let validatedParams: unknown = req.params ?? {};
        if (schemas.params && req.params !== undefined) {
          const result = schemas.params.safeParse(req.params);
          if (!result.success) {
            return rep.code(400).send({
              error: 'Validation failed',
              field: 'params',
              issues: result.error.issues,
            });
          }
          validatedParams = result.data;
        }
        
        // Validate query
        let validatedQuery: unknown = req.query ?? {};
        if (schemas.query && req.query !== undefined) {
          const result = schemas.query.safeParse(req.query);
          if (!result.success) {
            return rep.code(400).send({
              error: 'Validation failed',
              field: 'query',
              issues: result.error.issues,
            });
          }
          validatedQuery = result.data;
        }
        
        // Call handler with validated data
        const response = await handler({
          body: validatedBody as never,
          params: validatedParams as never,
          query: validatedQuery as never,
          request,
          reply,
        });
        
        // Validate response (optional, for development)
        if (schemas.response && process.env.NODE_ENV !== 'production') {
          const result = schemas.response.safeParse(response);
          if (!result.success) {
            console.warn(`[TypeOwl] Response validation failed for ${method} ${path}:`, result.error.issues);
          }
        }
        
        return response;
      } catch (error) {
        console.error(`[TypeOwl] Handler error for ${method} ${path}:`, error);
        return rep.code(500).send({ error: 'Internal server error' });
      }
    };
    
    // Register route on the app (framework-agnostic via duck typing)
    const fastifyApp = app as { 
      get?: (path: string, handler: unknown) => void;
      post?: (path: string, handler: unknown) => void;
      put?: (path: string, handler: unknown) => void;
      patch?: (path: string, handler: unknown) => void;
      delete?: (path: string, handler: unknown) => void;
    };
    
    const methodLower = method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    if (fastifyApp[methodLower]) {
      fastifyApp[methodLower]!(path, wrappedHandler);
    }
    
    return this;
  }

  /**
   * Generate a type name from method and path
   */
  private generateEndpointTypeName(method: HttpMethod, path: string): string {
    // /api/users -> GetApiUsers
    // /api/users/:id -> GetApiUsersById
    // /api/posts/:postId/comments/:commentId -> GetApiPostsByPostIdCommentsByCommentId
    const parts = path
      .split('/')
      .filter(p => p)
      .map(p => {
        if (p.startsWith(':')) {
          // Convert :id to ById, :userId to ByUserId
          const paramName = p.slice(1);
          return 'By' + paramName.charAt(0).toUpperCase() + paramName.slice(1);
        }
        return p.charAt(0).toUpperCase() + p.slice(1);
      });
    
    const methodPart = method.charAt(0) + method.slice(1).toLowerCase();
    return methodPart + parts.join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Type File Generation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate TypeScript content for a domain
   */
  private generateTypeFile(domainName: string): { content: string; hash: string } {
    // Check cache
    const cached = this.typeFileCache.get(domainName);
    if (cached) return cached;

    const domain = this.domains.get(domainName);
    if (!domain) {
      return { content: '// Empty domain', hash: this.hash('') };
    }

    const lines: string[] = [
      '/**',
      ' * 🦉 TypeOwl Generated Types',
      ` * Domain: ${domainName}`,
      ` * Version: ${this.config.version}`,
      ` * Generated: ${new Date().toISOString()}`,
      ' * DO NOT EDIT - This file is auto-generated',
      ' */',
      ''
    ];

    // Generate type definitions
    for (const [name, def] of Object.entries(domain.types)) {
      lines.push(`export ${typeDefinitionToTS(name, def)}`);
      lines.push('');
    }

    const content = lines.join('\n');
    const hash = this.hash(content);
    
    // Cache it
    this.typeFileCache.set(domainName, { content, hash });
    
    return { content, hash };
  }

  /**
   * Generate a short hash of content
   */
  private hash(content: string): string {
    return createHash('md5').update(content).digest('hex').slice(0, 8);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manifest Generation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate the lightweight manifest (just metadata + file pointers)
   */
  getManifest(): TypeManifest {
    const files: Record<string, TypeFileReference> = {};
    
    for (const [domainName, domain] of this.domains) {
      const { hash } = this.generateTypeFile(domainName);
      files[domainName] = {
        path: `${this.config.basePath}/types/${domainName}.d.ts`,
        hash,
        exports: Object.keys(domain.types)
      };
    }

    const manifest: TypeManifest = {
      manifestVersion: '1.0.0',
      version: this.config.version,
      generatedAt: new Date().toISOString(),
      files,
      endpoints: Object.fromEntries(this.endpoints)
    };

    if (this.config.includeGitCommit) {
      manifest.gitCommit = this.getGitCommit();
    }

    return manifest;
  }

  private getGitCommit(): string | undefined {
    try {
      // Could use child_process to get git commit
      return undefined;
    } catch {
      return undefined;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Endpoints Type File
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate the API endpoints type file
   */
  private generateEndpointsFile(): string {
    const lines: string[] = [
      '/**',
      ' * 🦉 TypeOwl API Endpoints',
      ` * Version: ${this.config.version}`,
      ' * DO NOT EDIT - This file is auto-generated',
      ' */',
      '',
      '// Import all domain types',
    ];

    // Import from each domain
    for (const [domainName, domain] of this.domains) {
      const exports = Object.keys(domain.types);
      if (exports.length > 0) {
        lines.push(`import type { ${exports.join(', ')} } from './${domainName}';`);
      }
    }

    lines.push('');
    lines.push('// Re-export all types');
    for (const [domainName, domain] of this.domains) {
      const exports = Object.keys(domain.types);
      if (exports.length > 0) {
        lines.push(`export type { ${exports.join(', ')} } from './${domainName}';`);
      }
    }

    lines.push('');
    lines.push('// ═══════════════════════════════════════════════════════════════════════════');
    lines.push('// 🗺️ API ENDPOINTS');
    lines.push('// ═══════════════════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('export interface ApiEndpoints {');
    
    for (const [key, endpoint] of this.endpoints) {
      const parts: string[] = [];
      if (endpoint.params) parts.push(`params: ${endpoint.params}`);
      if (endpoint.query) parts.push(`query: ${endpoint.query}`);
      if (endpoint.body) parts.push(`body: ${endpoint.body}`);
      parts.push(`response: ${endpoint.response}`);
      
      lines.push(`  '${key}': { ${parts.join('; ')} };`);
    }
    
    lines.push('}');
    lines.push('');
    lines.push('export type ApiEndpoint = keyof ApiEndpoints;');
    lines.push('');

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HTTP Handler
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the base path for type endpoints
   */
  getBasePath(): string {
    return this.config.basePath;
  }

  /**
   * Handle an HTTP request for types
   * Returns the response body or null if path doesn't match
   */
  handleRequest(path: string): TypeOwlResponse | null {
    const basePath = this.config.basePath;
    
    // Manifest endpoint
    if (path === basePath || path === `${basePath}/`) {
      return {
        body: this.getManifest(),
        contentType: 'application/json'
      };
    }

    if (path === `${basePath}/manifest.json`) {
      return {
        body: this.getManifest(),
        contentType: 'application/json'
      };
    }

    // Index file (re-exports all types + endpoints)
    if (path === `${basePath}/types/index.d.ts`) {
      return {
        body: this.generateEndpointsFile(),
        contentType: 'text/plain'
      };
    }

    // Domain type files: /__typeowl/types/{domain}.d.ts
    const typeFileMatch = path.match(new RegExp(`^${basePath}/types/([a-zA-Z0-9_-]+)\\.d\\.ts$`));
    if (typeFileMatch) {
      const domainName = typeFileMatch[1];
      if (this.domains.has(domainName)) {
        const { content } = this.generateTypeFile(domainName);
        return {
          body: content,
          contentType: 'text/plain'
        };
      }
    }

    return null;
  }

  /**
   * Validate a request against guard configuration
   * Use this to check API keys, etc. in your framework's middleware
   */
  validateRequest(
    ctx: TypeOwlRequestContext, 
    guard?: TypeOwlGuardConfig
  ): { valid: boolean; error?: string } {
    if (!guard) return { valid: true };

    // Check if enabled
    if (guard.enabled === false) {
      return { valid: false, error: 'TypeOwl endpoints are disabled' };
    }
    if (guard.enabled === 'development' && process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'TypeOwl endpoints are disabled in production' };
    }

    // Check API key if configured
    if (guard.apiKey) {
      const headerKey = ctx.headers?.['x-typeowl-key'];
      const queryKey = ctx.query?.['key'];
      const providedKey = (Array.isArray(headerKey) ? headerKey[0] : headerKey) || queryKey;

      if (providedKey !== guard.apiKey) {
        return { valid: false, error: 'Invalid or missing API key' };
      }
    }

    return { valid: true };
  }

  /**
   * Get this registry as a TypeOwlHandler interface
   * Useful for passing to the plugin config
   */
  asHandler(): TypeOwlHandler {
    return this;
  }

  /**
   * Set the plugin configuration (called internally by createTypeOwlFromConfig)
   */
  setPluginConfig(config: TypeOwlServerPluginConfig): this {
    this.pluginConfig = config;
    return this;
  }

  /**
   * Get the plugin configuration
   */
  getPluginConfig(): TypeOwlServerPluginConfig | undefined {
    return this.pluginConfig;
  }

  /**
   * Get the serving mode from config.
   */
  getMode(): 'dynamic' | 'static' {
    return this.pluginConfig?.mode ?? 'dynamic';
  }

  /**
   * Mount TypeOwl routes to your app.
   * Uses the registerRoutes function from your config file.
   * 
   * @example
   * const typeowl = await initTypeOwl();
   * typeowl.mount(app);
   * 
   * @throws Error if mode is 'static' or no registerRoutes is defined
   */
  async mount(app: unknown): Promise<void> {
    const mode = this.getMode();
    
    if (mode === 'static') {
      throw new Error(
        '[TypeOwl] Cannot mount() in static mode.\n' +
        'Static mode generates files via CLI instead of serving at runtime.\n' +
        'Change mode to "dynamic" if you want to serve types from your server.'
      );
    }
    
    if (!this.pluginConfig?.registerRoutes) {
      throw new Error(
        '[TypeOwl] No registerRoutes defined in config.\n' +
        'Dynamic mode requires registerRoutes to be defined.\n\n' +
        'Add a registerRoutes function to your typeowl.server.config.ts:\n\n' +
        'export default defineServerConfig({\n' +
        '  mode: "dynamic",\n' +
        '  registerRoutes: (app, typeowl, config) => {\n' +
        '    // Register your routes here\n' +
        '  },\n' +
        '});'
      );
    }

    await this.pluginConfig.registerRoutes(app, this, this.pluginConfig);
  }

  /**
   * Validate config for CLI operations.
   * 
   * @internal
   */
  validateForCLI(): { valid: boolean; error?: string } {
    const mode = this.getMode();
    
    if (mode === 'dynamic' && !this.pluginConfig?.registerRoutes) {
      return {
        valid: false,
        error: 'Dynamic mode requires registerRoutes to be defined in config.',
      };
    }
    
    return { valid: true };
  }

  /**
   * Generate static type files to disk.
   * Used internally by CLI - not intended for direct use.
   * 
   * @internal
   */
  async generate(outputPath: string): Promise<{ files: string[] }> {
    const outputDir = resolve(process.cwd(), outputPath);
    const typesDir = join(outputDir, 'types');
    const generatedFiles: string[] = [];
    
    // Create directories
    mkdirSync(typesDir, { recursive: true });
    
    // Write manifest
    const manifestPath = join(outputDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(this.getManifest(), null, 2));
    generatedFiles.push(manifestPath);
    
    // Write type files for each domain
    for (const domainName of this.getDomains()) {
      const { content } = this['generateTypeFile'](domainName);
      const filePath = join(typesDir, `${domainName}.d.ts`);
      writeFileSync(filePath, content);
      generatedFiles.push(filePath);
    }
    
    // Write index file
    const indexPath = join(typesDir, 'index.d.ts');
    writeFileSync(indexPath, this['generateEndpointsFile']());
    generatedFiles.push(indexPath);
    
    console.log(`  🦉 TypeOwl generated ${generatedFiles.length} files to ${outputDir}`);
    
    return { files: generatedFiles };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 ZOD TO TYPE DEFINITION CONVERTER
// ═══════════════════════════════════════════════════════════════════════════

// Internal Zod definition type (not exported by Zod)
interface ZodDef {
  typeName?: string;
  value?: unknown;
  values?: readonly unknown[];
  type?: z.ZodType;
  shape?: () => Record<string, z.ZodType>;
  options?: z.ZodType[];
  left?: z.ZodType;
  right?: z.ZodType;
  innerType?: z.ZodType;
}

function zodToTypeDefinition(schema: z.ZodType): TypeDefinition {
  const def = schema._def as ZodDef;
  const typeName = def.typeName as string;

  switch (typeName) {
    case 'ZodString':
      return { kind: 'primitive', value: 'string' };
    case 'ZodNumber':
      return { kind: 'primitive', value: 'number' };
    case 'ZodBoolean':
      return { kind: 'primitive', value: 'boolean' };
    case 'ZodNull':
      return { kind: 'primitive', value: 'null' };
    case 'ZodUndefined':
      return { kind: 'primitive', value: 'undefined' };
    case 'ZodAny':
      return { kind: 'primitive', value: 'any' };
    case 'ZodUnknown':
      return { kind: 'primitive', value: 'unknown' };
    case 'ZodVoid':
      return { kind: 'primitive', value: 'void' };
      
    case 'ZodLiteral':
      return { kind: 'literal', value: def.value as string | number | boolean };

    case 'ZodEnum': {
      // Convert enum to union of literals
      const values = def.values as readonly (string | number)[];
      return {
        kind: 'union',
        types: values.map(v => ({ kind: 'literal' as const, value: v }))
      };
    }
      
    case 'ZodArray':
      return { kind: 'array', element: zodToTypeDefinition(def.type!) };
      
    case 'ZodObject': {
      const shape = def.shape!();
      const properties: Record<string, PropertyDefinition> = {};
      
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = {
          type: zodToTypeDefinition(value as z.ZodType),
          optional: (value as z.ZodType).isOptional()
        };
      }
      
      return { kind: 'object', properties };
    }
    
    case 'ZodUnion':
      return { 
        kind: 'union', 
        types: def.options!.map((opt: z.ZodType) => zodToTypeDefinition(opt)) 
      };
      
    case 'ZodIntersection':
      return { 
        kind: 'intersection', 
        types: [zodToTypeDefinition(def.left!), zodToTypeDefinition(def.right!)] 
      };
      
    case 'ZodOptional':
      return { kind: 'optional', type: zodToTypeDefinition(def.innerType!) };
      
    case 'ZodNullable':
      return { 
        kind: 'union', 
        types: [zodToTypeDefinition(def.innerType!), { kind: 'primitive', value: 'null' }] 
      };

    case 'ZodDefault':
      // Default values don't change the type, just unwrap
      return zodToTypeDefinition(def.innerType!);
      
    default:
      return { kind: 'primitive', value: 'unknown' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPE DEFINITION TO TYPESCRIPT
// ═══════════════════════════════════════════════════════════════════════════

function typeDefinitionToTS(name: string, def: TypeDefinition): string {
  if (def.kind === 'object') {
    const props = Object.entries(def.properties)
      .map(([key, prop]) => {
        const optional = prop.optional ? '?' : '';
        return `  ${key}${optional}: ${typeDefToTSType(prop.type)};`;
      })
      .join('\n');
    return `interface ${name} {\n${props}\n}`;
  }
  
  return `type ${name} = ${typeDefToTSType(def)};`;
}

function typeDefToTSType(def: TypeDefinition): string {
  switch (def.kind) {
    case 'primitive':
      return def.value;
    case 'literal':
      return typeof def.value === 'string' ? `'${def.value}'` : String(def.value);
    case 'array':
      const element = typeDefToTSType(def.element);
      return element.includes('|') ? `(${element})[]` : `${element}[]`;
    case 'object': {
      const props = Object.entries(def.properties)
        .map(([key, prop]) => {
          const optional = prop.optional ? '?' : '';
          return `${key}${optional}: ${typeDefToTSType(prop.type)}`;
        })
        .join('; ');
      return `{ ${props} }`;
    }
    case 'union':
      return def.types.map(t => typeDefToTSType(t)).join(' | ');
    case 'intersection':
      return def.types.map(t => typeDefToTSType(t)).join(' & ');
    case 'reference':
      return def.name;
    case 'optional':
      return `${typeDefToTSType(def.type)} | undefined`;
    case 'raw':
      // Raw TypeScript - already valid TS syntax
      return def.typescript;
    default:
      return 'unknown';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new TypeOwl registry (low-level API)
 */
export function createTypeOwl(config?: TypeOwlServerConfig): TypeRegistry {
  return new TypeRegistry(config);
}

/**
 * Create TypeOwl from a server config file (high-level API)
 * Automatically handles type extraction based on config.
 * 
 * @example
 * // typeowl.server.config.ts
 * export default defineServerConfig({
 *   version: '1.0.0',
 *   typeSources: './src/types/',
 *   extract: {
 *     content: { from: './src/types/', types: ['Blog', 'Product'] },
 *   },
 * });
 * 
 * // server.ts
 * import config from './typeowl.server.config.js';
 * const typeowl = createTypeOwlFromConfig(config);
 */
export function createTypeOwlFromConfig(config: TypeOwlServerPluginConfig): TypeRegistry {
  const registry = new TypeRegistry({
    basePath: config.basePath,
    version: config.version,
    includeGitCommit: config.includeGitCommit,
    typeSources: config.typeSources,
  });
  
  // Store the plugin config for mount() to use
  registry.setPluginConfig(config);
  
  // Auto-register extracted types from config
  if (config.extract) {
    for (const [domain, extraction] of Object.entries(config.extract)) {
      registry
        .domain(domain)
        .extractAndRegister(extraction.from, extraction.types);
    }
  }
  
  return registry;
}

/**
 * Load the TypeOwl server config file.
 * Auto-discovers typeowl.server.config.ts in the project root.
 * 
 * @example
 * import { loadServerConfig, createTypeOwlFromConfig } from 'typeowl/server';
 * 
 * const config = await loadServerConfig();
 * const typeowl = createTypeOwlFromConfig(config);
 * 
 * @example
 * // Or with a custom path
 * const config = await loadServerConfig('./custom.config.ts');
 */
export async function loadServerConfig(
  configPath?: string
): Promise<TypeOwlServerPluginConfig> {
  const path = configPath ?? resolve(process.cwd(), 'typeowl.server.config.ts');
  
  try {
    // Try .ts first, then .js
    const tsPath = path.endsWith('.ts') ? path : path.replace(/\.js$/, '.ts');
    const jsPath = path.endsWith('.js') ? path : path.replace(/\.ts$/, '.js');
    
    let configModule: { default: TypeOwlServerPluginConfig };
    
    try {
      // Try importing as-is (works with tsx, ts-node, etc.)
      configModule = await import(tsPath);
    } catch {
      // Fall back to .js extension
      configModule = await import(jsPath);
    }
    
    return configModule.default;
  } catch (e) {
    throw new Error(
      `[TypeOwl] Failed to load config from: ${path}\n` +
      `Make sure typeowl.server.config.ts exists in your project root.\n` +
      `${e}`
    );
  }
}

/**
 * Load config and create TypeOwl in one step.
 * Auto-discovers typeowl.server.config.ts in the project root.
 * 
 * @example
 * import { initTypeOwl } from 'typeowl/server';
 * 
 * const typeowl = await initTypeOwl();
 */
export async function initTypeOwl(configPath?: string): Promise<TypeRegistry> {
  const config = await loadServerConfig(configPath);
  return createTypeOwlFromConfig(config);
}

export default createTypeOwl;
