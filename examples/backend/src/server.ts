/**
 * 🦉 TypeOwl Example Backend
 * 
 * Demonstrates THREE ways to define API types:
 * 
 * 🔴 OPTION 1: No TypeOwl - Raw handlers, no type exposure
 *    → Frontend uses `any` or manual types
 * 
 * 🟡 OPTION 2: Static types only - Types extracted from src/types/
 *    → Frontend can force-cast using exposed static types
 * 
 * 🟢 OPTION 3: typeowl.endpoint() - Full type generation + validation
 *    → Frontend gets auto-generated endpoint types
 * 
 * Run: npm run dev
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { initTypeOwl } from 'typeowl/server';

// Import types from our types folder (for use in this file)
import type { Blog, Product } from './types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🦉 TYPEOWL - Auto-loads from typeowl.server.config.ts
// ═══════════════════════════════════════════════════════════════════════════

const typeowl = await initTypeOwl();

// ═══════════════════════════════════════════════════════════════════════════
// 📦 ZOD SCHEMAS (for typeowl.endpoint validation)
// ═══════════════════════════════════════════════════════════════════════════

// Common params schema
const IdParamsSchema = z.object({ id: z.string() });

// User schemas
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'user', 'guest']),
});

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
});

// Health check (untyped endpoint)
const HealthSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 FASTIFY SERVER
// ═══════════════════════════════════════════════════════════════════════════

const app = Fastify({ logger: false });

await app.register(cors, { origin: true });

// Mount TypeOwl routes (from config)
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

type User = z.infer<typeof UserSchema>;
const users: User[] = [
  { id: '1', email: 'alice@example.com', name: 'Alice', role: 'admin' },
  { id: '2', email: 'bob@example.com', name: 'Bob', role: 'user' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 OPTION 1: No TypeOwl - Raw Fastify handlers
// ═══════════════════════════════════════════════════════════════════════════
// These endpoints are NOT registered with TypeOwl.
// Frontend must use `any` or define types manually.

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// ═══════════════════════════════════════════════════════════════════════════
// 🟡 OPTION 2: Static types only - Types exposed via extract config
// ═══════════════════════════════════════════════════════════════════════════
// Blog type is extracted from src/types/Blog.ts via typeowl.server.config.ts
// The TYPE is exposed, but endpoints are NOT mapped.
// Frontend can force-cast responses using the exposed Blog type.

app.get('/api/blogs', async () => blogs);

app.get('/api/blogs/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const blog = blogs.find(b => b.id === id);
  if (!blog) return reply.code(404).send({ error: 'Blog not found' });
  return blog;
});

// ═══════════════════════════════════════════════════════════════════════════
// 🟢 OPTION 3: typeowl.endpoint() - Full type generation + validation
// ═══════════════════════════════════════════════════════════════════════════
// These endpoints have AUTOMATIC validation and type registration!
// Schemas are extracted to TypeOwl AND used for runtime validation.
// Frontend gets fully typed ApiEndpoints with body/params/response.

// GET /api/users - List all users
typeowl.endpoint(app, 'GET', '/api/users', {
  response: z.array(UserSchema),
  description: 'List all users',
}, async () => {
  return users;
});

// GET /api/users/:id - Get user by ID
typeowl.endpoint(app, 'GET', '/api/users/:id', {
  params: IdParamsSchema,
  response: UserSchema,
  description: 'Get user by ID',
}, async ({ params, reply }) => {
  const user = users.find(u => u.id === params.id);
  if (!user) {
    (reply as { code: (n: number) => { send: (d: unknown) => void } }).code(404).send({ error: 'User not found' });
    return undefined as never;
  }
  return user;
});

// POST /api/users - Create user (with body validation!)
typeowl.endpoint(app, 'POST', '/api/users', {
  body: CreateUserSchema,
  response: UserSchema,
  description: 'Create a new user',
}, async ({ body }) => {
  // body is already validated and typed as { email: string, name: string, role: 'admin'|'user'|'guest' }
  const newUser: User = {
    id: String(users.length + 1),
    email: body.email,
    name: body.name,
    role: body.role,
  };
  users.push(newUser);
  return newUser;
});

// DELETE /api/users/:id - Delete user
typeowl.endpoint(app, 'DELETE', '/api/users/:id', {
  params: IdParamsSchema,
  response: z.object({ success: z.boolean(), message: z.string() }),
  description: 'Delete a user',
}, async ({ params, reply }) => {
  const index = users.findIndex(u => u.id === params.id);
  if (index === -1) {
    (reply as { code: (n: number) => { send: (d: unknown) => void } }).code(404).send({ error: 'User not found' });
    return undefined as never;
  }
  users.splice(index, 1);
  return { success: true, message: 'User deleted' };
});
// POST /api/blogs - Create a new blog
typeowl.endpoint(app, 'POST', '/api/blogs', {
  body:'BlogInput',
  response: 'Blog',
  description: 'Create a new blog',
}, async ({ body }) => console.log(body));

// GET /api/products - List all products
typeowl.endpoint(app, 'GET', '/api/products', {
  response: 'Product[]',
  description: 'List all products',
}, async () => products);

// GET /api/products/:id - Get product by ID
typeowl.endpoint(app, 'GET', '/api/products/:id', {
  params: IdParamsSchema,
  response: 'Product | null',  // Using extracted type reference!
  description: 'Get product by ID',
}, async ({ params, reply }) => {
  const product = products.find(p => p.id === params.id);
  if (!product) {
    (reply as { code: (n: number) => { send: (d: unknown) => void } }).code(404).send({ error: 'Product not found' });
    return undefined as never;
  }
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
  
  \x1b[31m🔴 No TypeOwl (raw handlers):\x1b[0m
    GET  /api/health
  
  \x1b[33m🟡 Static types only (Blog exposed, endpoint not mapped):\x1b[0m
    GET  /api/blogs
    GET  /api/blogs/:id
  
  \x1b[32m🟢 typeowl.endpoint() (full type + validation):\x1b[0m
    GET    /api/products
    GET    /api/products/:id
    GET    /api/users
    GET    /api/users/:id
    POST   /api/users      \x1b[33m← Try invalid body!\x1b[0m
    DELETE /api/users/:id
  
  TypeOwl Endpoints:
    \x1b[33mhttp://localhost:${PORT}/__typeowl\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/content.d.ts\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/endpoints.d.ts\x1b[0m

  \x1b[2mPress Ctrl+C to stop\x1b[0m
`);
});
