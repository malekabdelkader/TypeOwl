/**
 * 🦉 TypeOwl Configuration
 * 
 * This file defines where to fetch types from and how to sync them.
 * Similar to vite.config.ts or rsbuild.config.ts
 */

import { defineConfig } from 'typeowl';

export default defineConfig({
  /**
   * Type resolvers - define your backend sources here
   * 
   * For a single backend, you can use a simple string:
   *   resolvers: 'http://localhost:3001/__typeowl'
   * 
   * For multiple backends (microservices), use an array:
   *   resolvers: [
   *     { name: 'api', source: 'http://localhost:3001/__typeowl' },
   *     { name: 'auth', source: 'http://localhost:3002/__typeowl' },
   *     { name: 'payments', source: 'http://localhost:3003/__typeowl' },
   *   ]
   */
  resolvers: [
    {
      name: 'api',
      source: process.env.TYPEOWL_API_URL || 'http://localhost:3001/__typeowl',
    },
    // Add more resolvers as needed:
    // {
    //   name: 'auth',
    //   source: process.env.TYPEOWL_AUTH_URL || 'http://localhost:3002/__typeowl',
    // },
  ],

  /**
   * Output directory for generated types
   * Your code imports from this directory: import type { User } from '@typeowl'
   */
  output: './.typeowl',

  /**
   * Cache directory for offline fallback
   * When the backend is down, TypeOwl uses cached types
   */
  cache: './.typeowl-cache',

  /**
   * Watch mode configuration
   * - false: disabled (default for one-shot sync)
   * - true: enabled with 5000ms interval
   * - number: enabled with custom interval in ms
   */
  watch: false,

  /**
   * Lifecycle hooks for customization
   */
  hooks: {
    beforeSync: () => {
      // Called before sync starts
      // console.log('Starting type sync...');
    },
    
    afterResolverSync: (resolver, result) => {
      // Called after each resolver syncs
      if (result.success) {
        console.log(`  ✓ ${resolver}: v${result.version} (${result.filesUpdated} files)`);
      } else {
        console.log(`  ✗ ${resolver}: ${result.error}`);
      }
    },
    
    afterSync: (results) => {
      // Called after all syncs complete
      const successful = Object.values(results).filter(r => r.success).length;
      const total = Object.keys(results).length;
      console.log(`\n  Synced ${successful}/${total} resolvers\n`);
    },
  },
});

