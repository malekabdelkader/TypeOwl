/**
 * 🦉 TypeOwl Example Backend
 * 
 * A Fastify server that exposes types via TypeOwl.
 * Types and routes are configured in typeowl.server.config.ts
 * 
 * Run: npm run dev
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initTypeOwl } from 'typeowl/server';

// Import types from our types folder (for use in this file)
import type { Blog, Product } from './types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🦉 TYPEOWL - Auto-loads from typeowl.server.config.ts
// ═══════════════════════════════════════════════════════════════════════════

const typeowl = await initTypeOwl();

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 FASTIFY SERVER
// ═══════════════════════════════════════════════════════════════════════════

const app = Fastify({ logger: false });

await app.register(cors, { origin: true });

// Mount TypeOwl routes (defined in config)
await typeowl.mount(app);

// ─── Sample Data ─────────────────────────────────────────────────────────────

const blogs: Blog[] = [
  { id: '1', title: 'Hello World', content: 'Welcome to TypeOwl!', published: true, createdAt: new Date().toISOString() },
  { id: '2', title: 'Getting Started', content: 'Let me show you how...', published: true, createdAt: new Date().toISOString() },
];

const products: Product[] = [
  { id: '1', name: 'TypeOwl Pro', price: 99, description: 'Full-featured type sharing', inStock: true },
  { id: '2', name: 'TypeOwl Starter', price: 0, inStock: true },
];

// ─── API Endpoints ───────────────────────────────────────────────────────────

app.get('/api/blogs', async () => blogs);

app.get('/api/blogs/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const blog = blogs.find(b => b.id === id);
  if (!blog) return reply.code(404).send({ error: 'Blog not found' });
  return blog;
});

app.get('/api/products', async () => products);

app.get('/api/products/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const product = products.find(p => p.id === id);
  if (!product) return reply.code(404).send({ error: 'Product not found' });
  return product;
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = 3001;

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log(`
\x1b[36m🦉 TypeOwl Example Backend\x1b[0m
\x1b[2m──────────────────────────────\x1b[0m

  Server:     \x1b[32mhttp://localhost:${PORT}\x1b[0m
  
  API Endpoints:
    GET  /api/blogs
    GET  /api/blogs/:id
    GET  /api/products
    GET  /api/products/:id
  
  TypeOwl Endpoints:
    \x1b[33mhttp://localhost:${PORT}/__typeowl\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/content.d.ts\x1b[0m

  \x1b[2mPress Ctrl+C to stop\x1b[0m
`);
});
