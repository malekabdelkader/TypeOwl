/**
 * 🦉 TypeOwl Server Configuration
 * 
 * This is the central configuration file for TypeOwl.
 * All settings for type extraction, serving, and security are defined here.
 */

import { defineServerConfig } from 'typeowl/server';
import type { FastifyInstance } from 'fastify';

// Helper to cast app to your framework type
const asFastify = (app: unknown) => app as FastifyInstance;

export default defineServerConfig({
  // ═══════════════════════════════════════════════════════════════════════════
  // 📍 BASE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Base path for TypeOwl endpoints.
   * All type endpoints will be served under this path.
   * 
   * @default '/__typeowl'
   * @example '/__typeowl' -> http://localhost:3001/__typeowl/types/content.d.ts
   */
  basePath: '/__typeowl',

  /**
   * Version string for cache invalidation.
   * Change this when your types change to bust client caches.
   * 
   * @example '1.0.0', 'v2', process.env.npm_package_version
   */
  version: '1.0.0',

  /**
   * Include git commit hash in the manifest.
   * Useful for debugging which version is deployed.
   * 
   * @default false
   */
  includeGitCommit: false,

  // ═══════════════════════════════════════════════════════════════════════════
  // 📦 TYPE EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🔒 Allowed source files/directories for type extraction.
   * Only files within these paths can have their types extracted.
   * This is a security measure to prevent accidental exposure of sensitive types.
   * 
   * Can be:
   * - Single file: './src/types.ts'
   * - Single directory: './src/types/'
   * - Multiple paths: ['./src/types/', './src/models/']
   * 
   * ⚠️ Required for extractAndRegister() to work.
   */
  typeSources: './src/types/',

  /**
   * Types to extract from source files.
   * Maps domain names to source locations and type names.
   * 
   * Each domain becomes a separate .d.ts file:
   * - content -> /__typeowl/types/content.d.ts
   * - models -> /__typeowl/types/models.d.ts
   * 
   * @example
   * extract: {
   *   content: { from: './src/types/', types: ['Blog', 'Product'] },
   *   models: { from: './src/models/', types: ['User', 'Order'] },
   * }
   */
  extract: {
    content: {
      from: './src/types/',
      types: ['Blog', 'Product'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ GUARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Guard settings for TypeOwl endpoints.
   */
  guard: {
    /**
     * When to enable TypeOwl endpoints:
     * - true: Always enabled (use with caution in production!)
     * - false: Always disabled
     * - 'development': Only when NODE_ENV !== 'production'
     * 
     * @default 'development'
     */
    enabled: 'development',

    /**
     * API key required to access type endpoints.
     * If set, clients must include the key via:
     * - Header: X-TypeOwl-Key: your-api-key
     * - Query param: ?key=your-api-key
     * 
     * @example process.env.TYPEOWL_API_KEY
     */
    // apiKey: process.env.TYPEOWL_API_KEY,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 SERVING MODE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * How TypeOwl serves types:
   * 
   * - 'dynamic': Types served at runtime via registerRoutes.
   *              Your server handles requests to /__typeowl/*.
   *              Requires registerRoutes to be defined.
   * 
   * - 'static': Types generated as static files by CLI.
   *             Run: npx typeowl generate
   *             Files output to basePath (e.g., ./public/__typeowl/).
   *             registerRoutes is optional (not needed for static hosting).
   * 
   * @default 'dynamic'
   */
  mode: 'dynamic',

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔌 ROUTE REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register TypeOwl routes on your server framework.
   * 
   * This function receives:
   * - appInstance: Your server instance (Fastify, Express, Hono, etc.)
   * - typeowl: The TypeOwl handler for processing requests
   * - config: This config object for reference
   * 
   * Called when you run: typeowl.mount(app)
   * 
   * @example
   * // Fastify
   * registerRoutes: (app, typeowl, config) => {
   *   app.get('/__typeowl/*', (req, reply) => { ... });
   * }
   * 
   * @example
   * // Express
   * registerRoutes: (app, typeowl, config) => {
   *   app.use('/__typeowl', (req, res) => { ... });
   * }
   */
  registerRoutes: (appInstance, typeowl, config) => {
    const app = asFastify(appInstance);
    const basePath = typeowl.getBasePath();
    const guard = config.guard;

    // Guard check helper
    const checkGuard = (request: { headers: Record<string, string | string[] | undefined>; query: Record<string, string> }) => {
      return typeowl.validateRequest(
        { path: '', headers: request.headers, query: request.query },
        guard
      );
    };

    // Manifest endpoint: /__typeowl
    app.get(`${basePath}`, async (request, reply) => {
      const auth = checkGuard(request as never);
      if (!auth.valid) return reply.code(401).send({ error: auth.error });
      const response = typeowl.handleRequest(basePath);
      if (response) return reply.type(response.contentType).send(response.body);
      return reply.code(404).send({ error: 'Not found' });
    });

    // Manifest JSON endpoint: /__typeowl/manifest.json
    app.get(`${basePath}/manifest.json`, async (request, reply) => {
      const auth = checkGuard(request as never);
      if (!auth.valid) return reply.code(401).send({ error: auth.error });
      const response = typeowl.handleRequest(`${basePath}/manifest.json`);
      if (response) return reply.type(response.contentType).send(response.body);
      return reply.code(404).send({ error: 'Not found' });
    });

    // Type files endpoint: /__typeowl/types/{file}.d.ts
    app.get(`${basePath}/types/:file`, async (request, reply) => {
      const auth = checkGuard(request as never);
      if (!auth.valid) return reply.code(401).send({ error: auth.error });
      const { file } = request.params as { file: string };
      const response = typeowl.handleRequest(`${basePath}/types/${file}`);
      if (response) return reply.type(response.contentType).send(response.body);
      return reply.code(404).send({ error: 'Not found' });
    });

    console.log(`  🦉 TypeOwl registered at ${basePath}`);
  },
});
