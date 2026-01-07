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
  | { kind: 'optional'; type: TypeDefinition };

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
// ⚙️ SERVER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeOwlServerConfig {
  /** Path prefix for type endpoints (default: /__typeowl) */
  basePath?: string;
  /** Version string for cache invalidation */
  version?: string;
  /** Include git commit in manifest */
  includeGitCommit?: boolean;
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
