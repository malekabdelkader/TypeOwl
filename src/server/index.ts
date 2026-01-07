/**
 * 🦉 TypeOwl Server Module
 * 
 * Exposes your TypeScript types via HTTP endpoints.
 * Use this in your backend to make types available to frontends.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {
  TypeManifest,
  TypeDefinition,
  EndpointDefinition,
  HttpMethod,
  TypeOwlServerConfig,
  PropertyDefinition,
  TypeFileReference,
  TypeDomain
} from '../types.js';

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
  private config: Required<TypeOwlServerConfig>;

  constructor(config: TypeOwlServerConfig = {}) {
    this.config = {
      basePath: config.basePath ?? '/__typeowl',
      version: config.version ?? '0.0.0',
      includeGitCommit: config.includeGitCommit ?? false
    };
    // Initialize default domain
    this.domains.set('main', { types: {} });
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
  handleRequest(path: string): { body: unknown; contentType: string } | null {
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
    default:
      return 'unknown';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new TypeOwl registry
 */
export function createTypeOwl(config?: TypeOwlServerConfig): TypeRegistry {
  return new TypeRegistry(config);
}

export default createTypeOwl;
