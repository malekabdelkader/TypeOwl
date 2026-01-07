/**
 * 🦉 TypeOwl - Core Type Definitions
 * 
 * These types define the shape of the type manifest and definitions
 * that travel over the wire between backend and frontend.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 📦 TYPE REPRESENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a TypeScript type in a serializable format
 */
export type TypeDefinition =
  | { kind: 'primitive'; value: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'any' | 'unknown' | 'void' }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'array'; element: TypeDefinition }
  | { kind: 'object'; properties: Record<string, PropertyDefinition> }
  | { kind: 'union'; types: TypeDefinition[] }
  | { kind: 'intersection'; types: TypeDefinition[] }
  | { kind: 'reference'; name: string }  // Reference to another type by name
  | { kind: 'optional'; type: TypeDefinition }
  | { kind: 'raw'; typescript: string; generics?: string };  // Raw TypeScript string (extracted from source)

export interface PropertyDefinition {
  type: TypeDefinition;
  optional?: boolean;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ ENDPOINT MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointDefinition {
  /** HTTP method */
  method: HttpMethod;
  /** URL path pattern (e.g., /users/:id) */
  path: string;
  /** Request body type (for POST, PUT, PATCH) */
  body?: string;  // Reference to type name
  /** URL params type (e.g., { id: string }) */
  params?: string;
  /** Query string type */
  query?: string;
  /** Response type */
  response: string;
  /** Optional description */
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📄 TYPE FILE REFERENCE
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeFileReference {
  /** Relative path to the type file from basePath */
  path: string;
  /** Hash of file contents for cache invalidation */
  hash: string;
  /** List of exported type names in this file */
  exports: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 📋 MANIFEST (Lightweight - just metadata + pointers)
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeManifest {
  /** Version of the manifest schema */
  manifestVersion: '1.0.0';
  /** Version of the API/types (for cache invalidation) */
  version: string;
  /** When this manifest was generated */
  generatedAt: string;
  /** Git commit hash (optional, for debugging) */
  gitCommit?: string;
  /** Map of domain/namespace to type file references */
  files: Record<string, TypeFileReference>;
  /** All API endpoints mapped to their types */
  endpoints: Record<string, EndpointDefinition>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📦 INTERNAL TYPE STORE (Server-side only, not sent over wire)
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeDomain {
  /** Types in this domain */
  types: Record<string, TypeDefinition>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ SERVER CONFIGURATION (Registry)
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeOwlServerConfig {
  /** Path prefix for type endpoints (default: /__typeowl) */
  basePath?: string;
  /** Version string for cache invalidation */
  version?: string;
  /** Include git commit in manifest */
  includeGitCommit?: boolean;
  /**
   * Allowed source files/directories for type extraction.
   * Only files within these paths can be used with extractAndRegister().
   * 
   * Can be:
   * - A single file path: './src/types.ts'
   * - A directory: './src/types/'
   * - An array of paths: ['./src/types/', './src/models/']
   * 
   * If not set, extraction is disabled for safety.
   * 
   * @example
   * typeSources: './src/types.ts'
   * 
   * @example
   * typeSources: ['./src/types/', './src/models/']
   */
  typeSources?: string | string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 SERVER PLUGIN CONFIGURATION (typeowl.server.config.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Guard configuration for TypeOwl endpoints
 */
export interface TypeOwlGuardConfig {
  /**
   * Enable/disable TypeOwl endpoints
   * - true: always enabled
   * - false: always disabled
   * - 'development': only enabled when NODE_ENV !== 'production'
   * @default 'development'
   */
  enabled?: boolean | 'development';
  
  /**
   * API key required to access type endpoints
   * If set, requests must include the key via header or query param
   */
  apiKey?: string;
}

/**
 * Request context passed to the plugin handler
 */
export interface TypeOwlRequestContext {
  /** The request path (e.g., /__typeowl, /__typeowl/types/users.d.ts) */
  path: string;
  /** Headers from the request (for API key validation) */
  headers?: Record<string, string | string[] | undefined>;
  /** Query parameters (for API key validation) */
  query?: Record<string, string | undefined>;
}

/**
 * Response from handleRequest
 */
export interface TypeOwlResponse {
  body: unknown;
  contentType: string;
}

/**
 * The TypeOwl handler interface - framework agnostic
 */
export interface TypeOwlHandler {
  /** Handle a request and return response or null if not found */
  handleRequest(path: string): TypeOwlResponse | null;
  /** Get the base path for TypeOwl endpoints */
  getBasePath(): string;
  /** Get all registered domains */
  getDomains(): string[];
  /** Check if request is authorized based on security config */
  validateRequest(ctx: TypeOwlRequestContext, guard?: TypeOwlGuardConfig): { valid: boolean; error?: string };
}

/**
 * Server plugin configuration
 * Use with `defineServerConfig` for type safety
 * 
 * @example
 * // typeowl.server.config.ts
 * import { defineServerConfig, createTypeOwl } from 'typeowl/server';
 * 
 * const typeowl = createTypeOwl({ version: '1.0.0' });
 * 
 * export default defineServerConfig({
 *   registry: typeowl,
 *   security: { enabled: 'development' },
 *   
 *   // Framework-agnostic plugin - YOU wire it to your server
 *   plugin: (handler) => {
 *     // Example with Fastify:
 *     app.get('/__typeowl/*', (req, reply) => {
 *       const res = handler.handleRequest(req.url);
 *       if (res) return reply.type(res.contentType).send(res.body);
 *       return reply.code(404).send({ error: 'Not found' });
 *     });
 *   },
 * });
 */
export interface TypeOwlServerPluginConfig {
  /** Path prefix for type endpoints (default: /__typeowl) */
  basePath?: string;
  
  /** Version string for cache invalidation */
  version?: string;
  
  /** Include git commit in manifest */
  includeGitCommit?: boolean;
  
  /**
   * Guard settings for TypeOwl endpoints
   */
  guard?: TypeOwlGuardConfig;
  
  /**
   * Allowed source files/directories for type extraction.
   * Only files within these paths can be used with extractAndRegister().
   * 
   * @example
   * typeSources: './src/types/'
   * 
   * @example
   * typeSources: ['./src/types/', './src/models/']
   */
  typeSources?: string | string[];
  
  /**
   * Types to extract from source files.
   * Declarative way to register types without calling extractAndRegister() manually.
   * 
   * @example
   * // Extract all exported types from a directory
   * extract: {
   *   content: { from: './src/types/', types: ['Blog', 'Product'] },
   *   models: { from: './src/models/', types: ['User', 'Order'] },
   * }
   */
  extract?: Record<string, { from: string; types: string[] }>;
  
  /**
   * Serving mode for TypeOwl.
   * 
   * - 'dynamic': Types served at runtime via registerRoutes.
   *              Requires registerRoutes to be defined.
   * 
   * - 'static': Types generated as static files by CLI.
   *             Files output to basePath (e.g., /public/__typeowl/).
   *             registerRoutes is optional.
   * 
   * @default 'dynamic'
   */
  mode?: 'dynamic' | 'static';

  /**
   * Framework-specific route registration.
   * Only used when mode is 'dynamic'.
   * 
   * @example
   * // Fastify
   * registerRoutes: (app: FastifyInstance, typeowl, config) => {
   *   const basePath = typeowl.getBasePath();
   *   app.get(`${basePath}/*`, async (req, reply) => {
   *     const response = typeowl.handleRequest(req.url);
   *     if (response) return reply.type(response.contentType).send(response.body);
   *     return reply.code(404).send({ error: 'Not found' });
   *   });
   * }
   */
  registerRoutes?: (app: unknown, typeowl: TypeOwlHandler, config: TypeOwlServerPluginConfig) => void | Promise<void>;
}

/**
 * Helper function to define TypeOwl server config with type safety
 * 
 * @example
 * // typeowl.server.config.ts
 * import { defineServerConfig } from 'typeowl/server';
 * 
 * export default defineServerConfig({
 *   basePath: '/__typeowl',
 *   security: { enabled: 'development' },
 *   plugin: (handler) => {
 *     // Wire to your framework here
 *   },
 * });
 */
export function defineServerConfig(config: TypeOwlServerPluginConfig): TypeOwlServerPluginConfig {
  return config;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ CLIENT CONFIGURATION (internal/programmatic use)
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeOwlClientConfig {
  /** URL to fetch types from (e.g., http://localhost:3001/__typeowl) */
  source: string;
  /** Output directory for generated types (default: .typeowl) */
  outputDir?: string;
  /** Cache directory for offline fallback (default: .typeowl-cache) */
  cacheDir?: string;
  /** Watch for changes (poll interval in ms, 0 = disabled) */
  watchInterval?: number;
  /** Namespace prefix for this resolver (for multi-backend setups) */
  namespace?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📄 CONFIG FILE (typeowl.config.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single type resolver (backend source)
 * 
 * @example
 * // Simple string URL
 * resolver: 'http://localhost:3001/__typeowl'
 * 
 * @example
 * // Full configuration
 * resolver: {
 *   name: 'api',
 *   source: 'http://localhost:3001/__typeowl',
 *   // or with environment-based URL:
 *   source: () => process.env.API_URL + '/__typeowl',
 * }
 */
export interface TypeResolver {
  /** 
   * Name/namespace for this resolver
   * Used to organize types from multiple backends
   * @example 'api', 'auth', 'payments'
   */
  name: string;
  
  /** 
   * Source URL or function that returns source URL
   * Can be dynamic based on environment
   */
  source: string | (() => string);
  
  /**
   * Custom headers to send with requests to this resolver
   * 
   * @example
   * headers: { 'X-TypeOwl-Key': process.env.TYPEOWL_API_KEY }
   */
  headers?: Record<string, string>;
  
  /**
   * Hook called before each request.
   * Use to modify headers, add auth tokens, etc.
   * 
   * @example
   * onRequest: (url, init) => {
   *   init.headers = { ...init.headers, 'Authorization': `Bearer ${getToken()}` };
   *   return init;
   * }
   */
  onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
  
  /**
   * Hook called after each response.
   * Use to log, transform, or handle errors.
   * 
   * @example
   * onResponse: (response) => {
   *   if (!response.ok) console.error('TypeOwl fetch failed:', response.status);
   *   return response;
   * }
   */
  onResponse?: (response: Response) => Response | Promise<Response>;
}

/**
 * TypeOwl configuration file schema
 * 
 * @example
 * // typeowl.config.ts
 * import { defineConfig } from 'typeowl';
 * 
 * export default defineConfig({
 *   resolvers: [
 *     {
 *       name: 'api',
 *       source: process.env.NODE_ENV === 'development'
 *         ? 'http://localhost:3001/__typeowl'
 *         : 'https://api.example.com/__typeowl',
 *     },
 *   ],
 *   output: './.typeowl',
 * });
 */
export interface TypeOwlConfig {
  /**
   * Type resolvers - one or more backend sources
   * 
   * Can be a single resolver or an array for multi-backend setups.
   * Each resolver fetches types from a different backend.
   * 
   * @example
   * // Single backend (shorthand)
   * resolvers: 'http://localhost:3001/__typeowl'
   * 
   * @example
   * // Single backend (full config)
   * resolvers: {
   *   name: 'api',
   *   source: 'http://localhost:3001/__typeowl',
   * }
   * 
   * @example
   * // Multiple backends
   * resolvers: [
   *   { name: 'api', source: 'http://localhost:3001/__typeowl' },
   *   { name: 'auth', source: 'http://localhost:3002/__typeowl' },
   * ]
   */
  resolvers: string | TypeResolver | TypeResolver[];
  
  /** 
   * Output directory for generated types
   * @default '.typeowl'
   */
  output?: string;
  
  /** 
   * Cache directory for offline fallback
   * @default '.typeowl-cache'
   */
  cache?: string;
  
  /** 
   * Watch configuration
   * - false: disabled (default)
   * - true: enabled with 5000ms interval
   * - number: enabled with custom interval in ms
   */
  watch?: boolean | number;
  
  /**
   * Global headers to send with all requests.
   * Per-resolver headers override these.
   * 
   * @example
   * headers: { 'X-TypeOwl-Key': process.env.TYPEOWL_API_KEY }
   */
  headers?: Record<string, string>;
  
  /**
   * Global request hook called before each request.
   * Per-resolver hooks are called after this.
   * 
   * @example
   * onRequest: (url, init) => {
   *   console.log('Fetching:', url);
   *   return init;
   * }
   */
  onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
  
  /**
   * Global response hook called after each response.
   * Per-resolver hooks are called after this.
   */
  onResponse?: (response: Response) => Response | Promise<Response>;
  
  /**
   * Lifecycle hooks for customization
   */
  hooks?: {
    /** Called before sync starts */
    beforeSync?: () => void | Promise<void>;
    /** Called after each resolver syncs */
    afterResolverSync?: (resolver: string, result: SyncResult) => void | Promise<void>;
    /** Called after all syncs complete */
    afterSync?: (results: Record<string, SyncResult>) => void | Promise<void>;
  };
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  version?: string;
  filesUpdated?: number;
  error?: string;
}

/**
 * Helper function to define TypeOwl config with type safety
 * Similar to Vite's defineConfig or Rsbuild's defineConfig
 * 
 * @example
 * // typeowl.config.ts
 * import { defineConfig } from 'typeowl';
 * 
 * export default defineConfig({
 *   resolvers: [
 *     { name: 'api', source: 'http://localhost:3001/__typeowl' },
 *   ],
 * });
 */
export function defineConfig(config: TypeOwlConfig): TypeOwlConfig {
  return config;
}

// ═══════════════════════════════════════════════════════════════════════════
// 💾 CACHED MANIFEST (stored locally for offline/incremental sync)
// ═══════════════════════════════════════════════════════════════════════════

export interface CachedManifest {
  /** The manifest data */
  manifest: TypeManifest;
  /** When this was cached locally */
  cachedAt: string;
  /** Hashes of files we have locally (for incremental sync) */
  localHashes: Record<string, string>;
}
