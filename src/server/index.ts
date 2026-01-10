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
import type {
  TypeManifest,
  RawTypeDefinition,
  EndpointDefinition,
  HttpMethod,
  TypeOwlServerConfig,
  TypeOwlServerPluginConfig,
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

// Re-export extraction utilities (TypeChecker-based)
export { 
  extractTypes, 
  extractFromFile, 
  extractTypesAsRecord,
  extractRouteTypes,
  type ExtractedType,
  type ExtractOptions,
  type ExtractedTypes,
  type RouteTypeInfo
} from './extract.js';

// Re-export route builder (Pure TypeScript types, no Zod)
export { 
  route,
  getRegisteredRoutes,
  clearRouteRegistry,
  type RouteDefinition,
  type RouteBuilder,
  type RegisteredRoute,
  type HttpMethod as RouteHttpMethod
} from '../route.js';

// Import for internal use
import { extractTypes as extractTypesSync, extractRouteTypes as extractRouteTypesSync } from './extract.js';
import { getRegisteredRoutes, type RegisteredRoute } from '../route.js';


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
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Register a raw TypeScript type definition
   * 
   * @example
   * typeowl.registerType('User', 'interface User { id: string; name: string; }');
   * typeowl.registerType('Role', "type Role = 'admin' | 'user';");
   */
  registerType(name: string, typescript: RawTypeDefinition): this {
    this.registerTypeInDomain(name, typescript);
    return this;
  }
  
  /**
   * Register a type and return the actual name used (may differ if renamed due to conflict)
   */
  registerTypeWithName(name: string, typescript: RawTypeDefinition): string {
    return this.registerTypeInDomain(name, typescript);
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
   * @example
   * // Extract ALL exported types from a file/directory
   * typeowl
   *   .domain('content')
   *   .extractAndRegister('./src/types/', '*');
   * 
   * @throws Error if file is not in allowed typeSources
   */
  extractAndRegister(file: string, typeNames: string[] | '*'): this {
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
    
    // If '*' is passed, extract all exported types (pass undefined to extractTypes)
    const typesToExtract = typeNames === '*' ? undefined : typeNames;
    const extracted = extractTypesSync({ file: filePath, types: typesToExtract });
    
    for (const type of extracted) {
      // Use the raw TypeScript source directly
      this.registerTypeInDomain(type.name, type.source);
    }
    
    return this;
  }

  private registerTypeInDomain(name: string, typescript: RawTypeDefinition): string {
    const domain = this.domains.get(this.currentDomain)!;
    
    // Check for name conflicts
    if (domain.types[name]) {
      // Use TypeChecker for structural comparison
      const areStructurallyEqual = this.compareTypesStructurally(
        domain.types[name], 
        typescript
      );
      
      if (areStructurallyEqual) {
        // Same structure, skip silently
        return name;
      }
      
      // Different content with same name - handle based on config
      const onConflict = this.pluginConfig?.onConflict ?? 'error';
      
      if (onConflict === 'rename') {
        // Auto-rename and register with new name
        const newName = this.suggestAlternativeName(name);
        // Update the type name in the source text
        const renamedTypescript = typescript
          .replace(new RegExp(`\\binterface\\s+${name}\\b`), `interface ${newName}`)
          .replace(new RegExp(`\\btype\\s+${name}\\s*=`), `type ${newName} =`);
        domain.types[newName] = renamedTypescript;
        this.invalidateCache(this.currentDomain);
        console.warn(`[TypeOwl] ⚠️ Type "${name}" renamed to "${newName}" (conflict resolution)`);
        return newName;
      }
      
      // onConflict === 'error'
      const suggestedName = this.suggestAlternativeName(name);
      throw new Error(
        `\n[TypeOwl] ❌ Type name conflict in domain "${this.currentDomain}":\n\n` +
        `  Type "${name}" already exists with different content.\n\n` +
        `  💡 Suggested fix: Rename one of the types to "${suggestedName}"\n` +
        `  💡 Or set onConflict: 'rename' in your config to auto-rename\n`
      );
    }
    
    // Register the type
    domain.types[name] = typescript;
    this.invalidateCache(this.currentDomain);
    return name;
  }
  
  /**
   * Compare two type definitions structurally using TypeChecker
   */
  private compareTypesStructurally(type1: string, type2: string): boolean {
    // Quick hash check first (optimization)
    if (this.hash(type1) === this.hash(type2)) {
      return true;
    }
    
    // Use TypeChecker for structural comparison
    try {
      const ts = require('typescript') as typeof import('typescript');
      
      // Create a temporary program with both types
      const sourceCode = `
        type __Type1__ = ${this.extractTypeBody(type1)};
        type __Type2__ = ${this.extractTypeBody(type2)};
        type __Test__ = __Type1__ extends __Type2__ ? __Type2__ extends __Type1__ ? true : false : false;
      `;
      
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );
      
      const host: import('typescript').CompilerHost = {
        getSourceFile: (fileName) => fileName === 'temp.ts' ? sourceFile : undefined,
        getDefaultLibFileName: () => 'lib.d.ts',
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        fileExists: (f) => f === 'temp.ts',
        readFile: () => undefined,
      };
      
      const program = ts.createProgram(['temp.ts'], {
        noEmit: true,
        strict: true,
      }, host);
      
      const checker = program.getTypeChecker();
      
      // Find the __Test__ type and check if it resolves to 'true'
      const testSymbol = checker.getSymbolAtLocation(
        (sourceFile.statements[2] as import('typescript').TypeAliasDeclaration).name
      );
      
      if (testSymbol) {
        const testType = checker.getDeclaredTypeOfSymbol(testSymbol);
        const typeStr = checker.typeToString(testType);
        return typeStr === 'true';
      }
      
      return false;
    } catch {
      // Fallback to hash comparison if TypeChecker fails
      return false;
    }
  }
  
  /**
   * Extract the type body from a type definition string
   * e.g., "interface User { id: string }" -> "{ id: string }"
   * e.g., "type Role = 'admin' | 'user'" -> "'admin' | 'user'"
   */
  private extractTypeBody(typeDef: string): string {
    // Handle interface
    const interfaceMatch = typeDef.match(/interface\s+\w+\s*({[\s\S]*})/);
    if (interfaceMatch) return interfaceMatch[1];
    
    // Handle type alias
    const typeMatch = typeDef.match(/type\s+\w+\s*=\s*([\s\S]+);?$/);
    if (typeMatch) return typeMatch[1].replace(/;$/, '');
    
    // Return as-is if no match
    return typeDef;
  }

  private suggestAlternativeName(name: string): string {
    // Simple numeric suffix: User -> User1 -> User2
    let counter = 1;
    while (this.hasType(name + counter, this.currentDomain)) {
      counter++;
    }
    return name + counter;
  }

  hasType(name: string, domain?: string): boolean {
    if (domain) {
      const d = this.domains.get(domain);
      return d ? name in d.types : false;
    }
    for (const d of this.domains.values()) {
      if (name in d.types) return true;
    }
    return false;
  }

  getType(name: string): { domain: string; typescript: RawTypeDefinition } | null {
    for (const [domainName, domain] of this.domains) {
      if (name in domain.types) {
        return { domain: domainName, typescript: domain.types[name] };
      }
    }
    return null;
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

  /**
   * Extract and register route types from a source file using TypeChecker.
   * 
   * This scans the source file for route.get().returns<T>() patterns and
   * extracts the type arguments to generate endpoint type definitions.
   * 
   * @example
   * const typeowl = await initTypeOwl();
   * typeowl.extractRoutes(import.meta.url);  // Extracts from current file
   */
  extractRoutes(sourceFile: string, _domain: string = 'endpoints'): this {
    // Resolve file path
    let filePath: string;
    if (sourceFile.startsWith('file://')) {
      filePath = fileURLToPath(sourceFile);
    } else if (sourceFile.startsWith('/')) {
      filePath = sourceFile;
    } else {
      filePath = resolve(process.cwd(), sourceFile);
    }
    
    // Use extractRouteTypes from extract.js (already imported at top)
    const routes = extractRouteTypesSync(filePath);
    
    if (routes.length === 0) {
      return this;
    }
    
    // Register types used in routes to content domain
    this.domain('content');
    for (const route of routes) {
      // Register any types collected from this route
      for (const [typeName, extractedType] of route.types) {
        if (!this.hasType(typeName, 'content')) {
          this.registerType(typeName, extractedType.source);
        }
      }
    }
    
    // Register endpoints with type names (types are in content.d.ts)
    for (const route of routes) {
      this.registerEndpoint(route.method as HttpMethod, route.path, {
        params: route.params,
        body: route.body,
        query: route.query,
        response: route.response,
      });
    }
    
    return this;
  }

  /**
   * Register endpoint metadata from route.get()/post()/etc. builder.
   * 
   * Note: This only registers metadata. For full type extraction,
   * use extractRoutes(import.meta.url) instead.
   */
  registerRoutesFromBuilder(domain: string = 'endpoints'): this {
    const routes = getRegisteredRoutes();
    
    if (routes.length === 0) {
      return this;
    }
    
    this.domain(domain);
    
    for (const registeredRoute of routes) {
      const endpointName = this.generateEndpointTypeName(
        registeredRoute.method as HttpMethod, 
        registeredRoute.path
      );
      
      // Register endpoint with generated type names
      this.registerEndpoint(registeredRoute.method as HttpMethod, registeredRoute.path, {
        params: registeredRoute.hasParams ? `${endpointName}Params` : undefined,
        body: registeredRoute.hasBody ? `${endpointName}Body` : undefined,
        query: registeredRoute.hasQuery ? `${endpointName}Query` : undefined,
        response: `${endpointName}Response`,
      });
    }
    
    return this;
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

    // Output raw TypeScript definitions directly
    for (const [, typescript] of Object.entries(domain.types)) {
      // Add export if not already exported
      const trimmed = typescript.trim();
      if (trimmed.startsWith('export ')) {
        lines.push(trimmed);
      } else {
        lines.push(`export ${trimmed}`);
      }
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
  
  // Extract route types from specified source files using TypeChecker
  if (config.routes) {
    const routeFiles = Array.isArray(config.routes) ? config.routes : [config.routes];
    for (const routeFile of routeFiles) {
      registry.extractRoutes(routeFile);
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
