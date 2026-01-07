/**
 * 🦉 TypeOwl Client Configuration
 * 
 * This file defines where to fetch types from and how to sync them.
 * Similar to vite.config.ts or rsbuild.config.ts
 */

import { defineConfig } from 'typeowl';

export default defineConfig({
  // ═══════════════════════════════════════════════════════════════════════════
  // 📡 RESOLVERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Type resolvers - define your backend sources here.
   * 
   * Can be:
   * - Simple string: 'http://localhost:3001/__typeowl'
   * - Single resolver object: { name: 'api', source: '...' }
   * - Array of resolvers for multiple backends
   * 
   * @example
   * // Single backend (shorthand)
   * resolvers: 'http://localhost:3001/__typeowl'
   * 
   * @example
   * // Multiple backends (microservices)
   * resolvers: [
   *   { name: 'api', source: 'http://localhost:3001/__typeowl' },
   *   { name: 'auth', source: 'http://localhost:3002/__typeowl' },
   * ]
   */
  resolvers: [
    {
      /**
       * Name/namespace for this resolver.
       * Types are organized under this name.
       */
      name: 'api',

      /**
       * Source URL for the TypeOwl endpoint.
       * Can be a string or a function that returns a string.
       * 
       * @example
       * source: 'http://localhost:3001/__typeowl'
       * source: () => process.env.API_URL + '/__typeowl'
       */
      source: process.env.TYPEOWL_API_URL || 'http://localhost:3001/__typeowl',

      /**
       * Custom headers to send with requests to this resolver.
       * Use for API keys, auth tokens, etc.
       * 
       * @example
       * headers: { 'X-TypeOwl-Key': 'my-api-key' }
       */
      // headers: {},

      /**
       * Hook called before each request to this resolver.
       * Use to modify headers, add auth tokens, etc.
       * 
       * @example
       * onRequest: (url, init) => {
       *   init.headers = { ...init.headers, 'Authorization': `Bearer ${getToken()}` };
       *   return init;
       * }
       */
      // onRequest: (url, init) => init,

      /**
       * Hook called after each response from this resolver.
       * Use to log, transform, or handle errors.
       * 
       * @example
       * onResponse: (response) => {
       *   if (!response.ok) console.error('Fetch failed:', response.status);
       *   return response;
       * }
       */
      // onResponse: (response) => response,
    },
    // Add more resolvers for microservices:
    // {
    //   name: 'auth',
    //   source: process.env.TYPEOWL_AUTH_URL || 'http://localhost:3002/__typeowl',
    // },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // 📁 OUTPUT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Output directory for generated types.
   * Your code imports from this directory.
   * 
   * @default '.typeowl'
   * @example import type { User } from './.typeowl'
   */
  output: './.typeowl',

  /**
   * Cache directory for offline fallback.
   * When the backend is down, TypeOwl uses cached types.
   * 
   * @default '.typeowl-cache'
   */
  cache: './.typeowl-cache',

  // ═══════════════════════════════════════════════════════════════════════════
  // ⏱️ WATCH MODE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Watch mode configuration for automatic re-syncing.
   * 
   * - false: disabled (default, one-shot sync)
   * - true: enabled with 5000ms interval
   * - number: enabled with custom interval in ms
   * 
   * @default false
   */
  watch: false,

  // ═══════════════════════════════════════════════════════════════════════════
  // 🌐 GLOBAL REQUEST OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Global headers to send with all requests.
   * Per-resolver headers override these.
   * 
   * @example
   * headers: { 'X-Client-Version': '1.0.0' }
   */
  // headers: {},

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
  // onRequest: (url, init) => init,

  /**
   * Global response hook called after each response.
   * Per-resolver hooks are called after this.
   * 
   * @example
   * onResponse: (response) => {
   *   console.log('Response:', response.status);
   *   return response;
   * }
   */
  // onResponse: (response) => response,

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎣 LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lifecycle hooks for customization.
   */
  hooks: {
    /**
     * Called before sync starts.
     */
    beforeSync: () => {
      // console.log('Starting type sync...');
    },

    /**
     * Called after each resolver syncs.
     * 
     * @param resolver - Name of the resolver
     * @param result - Sync result with success, version, filesUpdated, error
     */
    afterResolverSync: (resolver, result) => {
      if (result.success) {
        console.log(`  ✓ ${resolver}: v${result.version} (${result.filesUpdated} files)`);
      } else {
        console.log(`  ✗ ${resolver}: ${result.error}`);
      }
    },

    /**
     * Called after all syncs complete.
     * 
     * @param results - Map of resolver names to sync results
     */
    afterSync: (results) => {
      const successful = Object.values(results).filter(r => r.success).length;
      const total = Object.keys(results).length;
      console.log(`\n  Synced ${successful}/${total} resolvers\n`);
    },
  },
});
