/**
 * 🦉 TypeOwl
 * 
 * Runtime type synchronization between backend and frontend.
 * Types that fly across repos.
 */

// Core types
export * from './types.js';

// Server module (for backends)
export { TypeRegistry, createTypeOwl } from './server/index.js';

// Client module (for frontends)
export { 
  TypeOwlClient, 
  createTypeOwlClient, 
  syncTypes,
  syncFromConfig,
  loadConfigAndSync,
  watchFromConfig,
  type TypeOwlClientConfig,
} from './client/index.js';

// Config helper (re-export for convenience)
export { defineConfig } from './types.js';

