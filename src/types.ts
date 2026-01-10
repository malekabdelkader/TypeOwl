/**
 * 🦉 TypeOwl - Core Type Definitions
 * 
 * With TypeChecker-based extraction, types are stored as raw TypeScript strings.
 * No intermediate format needed - just pure .d.ts content.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 📦 TYPE REPRESENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw TypeScript type definition as extracted by TypeChecker.
 * This is the actual .d.ts content for a type.
 */
export type RawTypeDefinition = string;

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ ENDPOINT MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointDefinition {
  method: HttpMethod;
  path: string;
  body?: string;
  params?: string;
  query?: string;
  response: string;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📄 TYPE FILE & MANIFEST
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeFileReference {
  path: string;
  hash: string;
  exports: string[];
}

export interface TypeManifest {
  manifestVersion: '1.0.0';
  version: string;
  generatedAt: string;
  gitCommit?: string;
  files: Record<string, TypeFileReference>;
  endpoints: Record<string, EndpointDefinition>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📦 INTERNAL TYPE STORE
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeDomain {
  types: Record<string, RawTypeDefinition>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ SERVER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeOwlServerConfig {
  basePath?: string;
  version?: string;
  includeGitCommit?: boolean;
  typeSources?: string | string[];
}

export interface TypeOwlGuardConfig {
  enabled?: boolean | 'development';
  apiKey?: string;
}

export interface TypeOwlRequestContext {
  path: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | undefined>;
}

export interface TypeOwlResponse {
  body: unknown;
  contentType: string;
}

export interface TypeOwlHandler {
  handleRequest(path: string): TypeOwlResponse | null;
  getBasePath(): string;
  getDomains(): string[];
  validateRequest(ctx: TypeOwlRequestContext, guard?: TypeOwlGuardConfig): { valid: boolean; error?: string };
}

export interface TypeOwlServerPluginConfig {
  basePath?: string;
  version?: string;
  includeGitCommit?: boolean;
  guard?: TypeOwlGuardConfig;
  typeSources?: string | string[];
  extract?: Record<string, { from: string; types: string[] | '*' }>;
  /** 
   * Source files containing route definitions (route.get().returns<T>()).
   * TypeOwl will extract endpoint types from these files using TypeChecker.
   */
  routes?: string | string[];
  /**
   * How to handle type name conflicts:
   * - 'error': Throw an error when duplicate type names with different content are found
   * - 'rename': Automatically rename conflicting types (e.g., User -> User2)
   * @default 'error'
   */
  onConflict?: 'error' | 'rename';
  mode?: 'dynamic' | 'static';
  registerRoutes?: (app: unknown, typeowl: TypeOwlHandler, config: TypeOwlServerPluginConfig) => void | Promise<void>;
}

export function defineServerConfig(config: TypeOwlServerPluginConfig): TypeOwlServerPluginConfig {
  return config;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeOwlClientConfig {
  source: string;
  outputDir?: string;
  cacheDir?: string;
  watchInterval?: number;
  namespace?: string;
}

export interface TypeResolver {
  name: string;
  source: string | (() => string);
  headers?: Record<string, string>;
  onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
  onResponse?: (response: Response) => Response | Promise<Response>;
}

export interface TypeOwlConfig {
  resolvers: string | TypeResolver | TypeResolver[];
  output?: string;
  cache?: string;
  watch?: boolean | number;
  headers?: Record<string, string>;
  onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
  onResponse?: (response: Response) => Response | Promise<Response>;
  hooks?: {
    beforeSync?: () => void | Promise<void>;
    afterResolverSync?: (resolver: string, result: SyncResult) => void | Promise<void>;
    afterSync?: (results: Record<string, SyncResult>) => void | Promise<void>;
  };
}

export interface SyncResult {
  success: boolean;
  version?: string;
  filesUpdated?: number;
  error?: string;
}

export function defineConfig(config: TypeOwlConfig): TypeOwlConfig {
  return config;
}

export interface CachedManifest {
  manifest: TypeManifest;
  cachedAt: string;
  localHashes: Record<string, string>;
}
