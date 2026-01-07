/**
 * 🦉 TypeOwl Client Module
 * 
 * Fetches types from a TypeOwl-enabled backend and generates
 * TypeScript definitions for your frontend project.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { 
  TypeManifest, 
  CachedManifest, 
  TypeOwlConfig, 
  TypeResolver, 
  SyncResult 
} from '../types.js';

// Re-export config types
export type { TypeOwlConfig, TypeResolver, SyncResult } from '../types.js';
export { defineConfig } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 CONSOLE COLORS
// ═══════════════════════════════════════════════════════════════════════════

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[91m',
  magenta: '\x1b[35m',
};

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ LEGACY CLIENT CONFIG (for programmatic use)
// ═══════════════════════════════════════════════════════════════════════════

export interface TypeOwlClientConfig {
  /** URL to fetch types from */
  source: string;
  /** Output directory for generated types (default: .typeowl) */
  outputDir?: string;
  /** Cache directory for offline fallback (default: .typeowl-cache) */
  cacheDir?: string;
  /** Watch for changes (poll interval in ms, 0 = disabled) */
  watchInterval?: number;
  /** Namespace for this resolver */
  namespace?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🦉 TYPE OWL CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export class TypeOwlClient {
  private config: Required<TypeOwlClientConfig>;
  private cachedManifest: CachedManifest | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: TypeOwlClientConfig) {
    this.config = {
      source: config.source,
      outputDir: config.outputDir ?? '.typeowl',
      cacheDir: config.cacheDir ?? '.typeowl-cache',
      watchInterval: config.watchInterval ?? 0,
      namespace: config.namespace ?? '',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sync Types
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch types from backend and generate TypeScript files
   * Only fetches files that have changed (based on hash comparison)
   */
  async sync(): Promise<SyncResult> {
    const namespace = this.config.namespace;
    const prefix = namespace ? `${c.magenta}[${namespace}]${c.reset} ` : '';
    
    console.log(`${prefix}${c.cyan}🦉 TypeOwl${c.reset} ${c.dim}Syncing types...${c.reset}`);

    try {
      // Load local cache first
      await this.loadCache();

      // Fetch manifest from backend
      const manifest = await this.fetchManifest();
      
      // Compare with cached manifest to find changed files
      const filesToFetch = this.getChangedFiles(manifest);
      
      if (filesToFetch.length === 0) {
        console.log(`${prefix}  ${c.dim}→ Types unchanged (v${manifest.version})${c.reset}\n`);
        return { success: true, version: manifest.version, filesUpdated: 0 };
      }

      console.log(`${prefix}  ${c.dim}→ ${filesToFetch.length} file(s) changed${c.reset}`);

      // Fetch changed type files
      const typeFiles = await this.fetchTypeFiles(manifest, filesToFetch, prefix);
      
      // Write files to output directory
      await this.writeTypeFiles(manifest, typeFiles);
      
      // Update cache
      await this.saveCache(manifest);
      
      console.log(`${prefix}  ${c.green}✓${c.reset} Types synced ${c.dim}(v${manifest.version})${c.reset}`);
      console.log(`${prefix}  ${c.dim}→ ${this.config.outputDir}${c.reset}\n`);
      
      return { success: true, version: manifest.version, filesUpdated: filesToFetch.length };
      
    } catch (error) {
      const err = error as Error;
      console.log(`${prefix}  ${c.yellow}⚠${c.reset} Could not fetch from ${c.dim}${this.config.source}${c.reset}`);
      
      // Try to use cached files
      if (this.cachedManifest) {
        console.log(`${prefix}  ${c.dim}→ Using cached types (v${this.cachedManifest.manifest.version})${c.reset}\n`);
        return { success: true, version: this.cachedManifest.manifest.version, filesUpdated: 0 };
      }
      
      console.log(`${prefix}  ${c.red}✗${c.reset} ${err.message}\n`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch manifest from the backend
   */
  private async fetchManifest(): Promise<TypeManifest> {
    const url = this.config.source.endsWith('/manifest.json')
      ? this.config.source
      : `${this.config.source}/manifest.json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json() as Promise<TypeManifest>;
  }

  /**
   * Compare manifest with cached version to find changed files
   */
  private getChangedFiles(manifest: TypeManifest): string[] {
    // Safety check for malformed manifest
    if (!manifest.files || typeof manifest.files !== 'object') {
      console.log(`  ${c.yellow}⚠${c.reset} Manifest missing 'files' field`);
      return [];
    }

    if (!this.cachedManifest || !this.cachedManifest.localHashes) {
      // No cache, fetch all files
      return Object.keys(manifest.files);
    }

    const changed: string[] = [];
    
    for (const [domain, fileRef] of Object.entries(manifest.files)) {
      const cachedHash = this.cachedManifest.localHashes[domain];
      if (cachedHash !== fileRef.hash) {
        changed.push(domain);
      }
    }

    return changed;
  }

  /**
   * Fetch type files from the backend
   */
  private async fetchTypeFiles(manifest: TypeManifest, domains: string[], prefix: string = ''): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    
    // Fetch all changed files in parallel
    const results = await Promise.all(
      domains.map(async (domain) => {
        const fileRef = manifest.files[domain];
        const url = this.resolveUrl(fileRef.path);
        
        console.log(`${prefix}    ${c.dim}↓ ${domain}.d.ts${c.reset}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${domain}.d.ts: ${response.status}`);
        }
        
        const content = await response.text();
        return { domain, content };
      })
    );

    for (const { domain, content } of results) {
      files.set(domain, content);
    }

    return files;
  }

  /**
   * Resolve a path from manifest to full URL
   */
  private resolveUrl(path: string): string {
    // Path is like /__typeowl/types/users.d.ts
    // Source is like http://localhost:3001/__typeowl
    const baseUrl = this.config.source.replace(/\/__typeowl\/?$/, '');
    return `${baseUrl}${path}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Writing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Write type files to output directory
   */
  private async writeTypeFiles(manifest: TypeManifest, typeFiles: Map<string, string>): Promise<void> {
    const outputDir = this.config.outputDir;
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write each domain type file
    for (const [domain, content] of typeFiles) {
      await fs.writeFile(path.join(outputDir, `${domain}.d.ts`), content);
    }

    // Fetch and write index file (with endpoints)
    const indexUrl = this.resolveUrl(`${this.getBasePath()}/types/index.d.ts`);
    try {
      const indexResponse = await fetch(indexUrl);
      if (indexResponse.ok) {
        const indexContent = await indexResponse.text();
        await fs.writeFile(path.join(outputDir, 'index.d.ts'), indexContent);
      }
    } catch {
      // Generate a basic index file if fetch fails
      await fs.writeFile(path.join(outputDir, 'index.d.ts'), this.generateIndexFile(manifest));
    }
    
    // Generate package.json for the module
    const packageJson = {
      name: '.typeowl',
      version: manifest.version,
      types: './index.d.ts',
      private: true
    };
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  /**
   * Get base path from source URL
   */
  private getBasePath(): string {
    const match = this.config.source.match(/(\/__typeowl)\/?$/);
    return match ? match[1] : '/__typeowl';
  }

  /**
   * Generate index file that re-exports all domains
   */
  private generateIndexFile(manifest: TypeManifest): string {
    const lines: string[] = [
      '/**',
      ' * 🦉 TypeOwl Generated Types',
      ` * Version: ${manifest.version}`,
      ' * DO NOT EDIT - This file is auto-generated',
      ' */',
      ''
    ];

    // Re-export from each domain
    const files = manifest.files || {};
    for (const [domain, fileRef] of Object.entries(files)) {
      if (fileRef.exports && fileRef.exports.length > 0) {
        lines.push(`export type { ${fileRef.exports.join(', ')} } from './${domain}';`);
      }
    }

    lines.push('');
    lines.push('// API Endpoints');
    lines.push('export interface ApiEndpoints {');
    
    const endpoints = manifest.endpoints || {};
    for (const [key, endpoint] of Object.entries(endpoints)) {
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
  // Caching
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load cached manifest
   */
  private async loadCache(): Promise<void> {
    try {
      const content = await fs.readFile(
        path.join(this.config.cacheDir, 'cache.json'),
        'utf-8'
      );
      this.cachedManifest = JSON.parse(content) as CachedManifest;
    } catch {
      this.cachedManifest = null;
    }
  }

  /**
   * Save manifest to cache
   */
  private async saveCache(manifest: TypeManifest): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      
      // Build local hashes map
      const localHashes: Record<string, string> = {};
      for (const [domain, fileRef] of Object.entries(manifest.files)) {
        localHashes[domain] = fileRef.hash;
      }

      const cached: CachedManifest = {
        manifest,
        cachedAt: new Date().toISOString(),
        localHashes
      };

      await fs.writeFile(
        path.join(this.config.cacheDir, 'cache.json'),
        JSON.stringify(cached, null, 2)
      );

      this.cachedManifest = cached;
    } catch {
      // Ignore cache errors
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watch Mode
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start watching for type changes
   */
  startWatch(): void {
    if (this.config.watchInterval <= 0) return;
    
    console.log(`${c.cyan}🦉 TypeOwl${c.reset} ${c.dim}Watching for changes (${this.config.watchInterval}ms)${c.reset}\n`);
    
    this.watchTimer = setInterval(async () => {
      await this.sync();
    }, this.config.watchInterval);
  }

  /**
   * Stop watching
   */
  stopWatch(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CONFIG-BASED SYNC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize resolvers from config to array format
 */
function normalizeResolvers(resolvers: TypeOwlConfig['resolvers']): TypeResolver[] {
  if (typeof resolvers === 'string') {
    // Simple string URL - use 'api' as default name
    return [{ name: 'api', source: resolvers }];
  }
  
  if (Array.isArray(resolvers)) {
    return resolvers;
  }
  
  // Single resolver object
  return [resolvers];
}

/**
 * Get the actual source URL from a resolver
 */
function getSourceUrl(resolver: TypeResolver): string {
  if (typeof resolver.source === 'function') {
    return resolver.source();
  }
  return resolver.source;
}

/**
 * Sync types using a TypeOwl config
 * Supports multiple resolvers (backends)
 */
export async function syncFromConfig(config: TypeOwlConfig): Promise<Record<string, SyncResult>> {
  const resolvers = normalizeResolvers(config.resolvers);
  const outputDir = config.output ?? '.typeowl';
  const cacheDir = config.cache ?? '.typeowl-cache';
  const watchInterval = config.watch === true ? 5000 : (typeof config.watch === 'number' ? config.watch : 0);
  
  console.log(`\n${c.cyan}🦉 TypeOwl${c.reset}\n`);
  
  // Call beforeSync hook
  if (config.hooks?.beforeSync) {
    await config.hooks.beforeSync();
  }
  
  const results: Record<string, SyncResult> = {};
  
  for (const resolver of resolvers) {
    const sourceUrl = getSourceUrl(resolver);
    const resolverOutputDir = resolvers.length > 1 
      ? path.join(outputDir, resolver.name)
      : outputDir;
    const resolverCacheDir = resolvers.length > 1
      ? path.join(cacheDir, resolver.name)
      : cacheDir;
    
    const client = new TypeOwlClient({
      source: sourceUrl,
      outputDir: resolverOutputDir,
      cacheDir: resolverCacheDir,
      watchInterval,
      namespace: resolvers.length > 1 ? resolver.name : undefined,
    });
    
    const result = await client.sync();
    results[resolver.name] = result;
    
    // Call afterResolverSync hook
    if (config.hooks?.afterResolverSync) {
      await config.hooks.afterResolverSync(resolver.name, result);
    }
  }
  
  // Call afterSync hook
  if (config.hooks?.afterSync) {
    await config.hooks.afterSync(results);
  }
  
  return results;
}

/**
 * Load config from typeowl.config.ts and sync
 */
export async function loadConfigAndSync(configPath?: string): Promise<Record<string, SyncResult>> {
  const possiblePaths = configPath 
    ? [configPath]
    : [
        'typeowl.config.ts',
        'typeowl.config.js',
        'typeowl.config.mjs',
      ];
  
  for (const configFile of possiblePaths) {
    try {
      const fullPath = path.resolve(process.cwd(), configFile);
      const configModule = await import(fullPath);
      const config = configModule.default as TypeOwlConfig;
      return await syncFromConfig(config);
    } catch {
      // Try next path
    }
  }
  
  throw new Error('Could not find typeowl.config.ts. Create one or specify the path.');
}

/**
 * Start watch mode using config
 */
export async function watchFromConfig(config: TypeOwlConfig): Promise<void> {
  const resolvers = normalizeResolvers(config.resolvers);
  const outputDir = config.output ?? '.typeowl';
  const cacheDir = config.cache ?? '.typeowl-cache';
  const watchInterval = config.watch === true ? 5000 : (typeof config.watch === 'number' ? config.watch : 5000);
  
  console.log(`\n${c.cyan}🦉 TypeOwl${c.reset} ${c.dim}Watch mode${c.reset}\n`);
  
  const clients: TypeOwlClient[] = [];
  
  for (const resolver of resolvers) {
    const sourceUrl = getSourceUrl(resolver);
    const resolverOutputDir = resolvers.length > 1 
      ? path.join(outputDir, resolver.name)
      : outputDir;
    const resolverCacheDir = resolvers.length > 1
      ? path.join(cacheDir, resolver.name)
      : cacheDir;
    
    const client = new TypeOwlClient({
      source: sourceUrl,
      outputDir: resolverOutputDir,
      cacheDir: resolverCacheDir,
      watchInterval,
      namespace: resolvers.length > 1 ? resolver.name : undefined,
    });
    
    // Initial sync
    await client.sync();
    
    // Start watching
    client.startWatch();
    clients.push(client);
  }
  
  console.log(`${c.dim}Watching for type changes... (Ctrl+C to stop)${c.reset}\n`);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    for (const client of clients) {
      client.stopWatch();
    }
    console.log(`\n${c.dim}Stopped watching.${c.reset}\n`);
    process.exit(0);
  });
  
  // Keep process alive
  await new Promise(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a TypeOwl client for syncing types
 */
export function createTypeOwlClient(config: TypeOwlClientConfig): TypeOwlClient {
  return new TypeOwlClient(config);
}

/**
 * One-shot sync function (legacy, for simple use cases)
 */
export async function syncTypes(config: TypeOwlClientConfig): Promise<boolean> {
  const client = new TypeOwlClient(config);
  const result = await client.sync();
  return result.success;
}

export default createTypeOwlClient;
