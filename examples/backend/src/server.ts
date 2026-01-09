/**
 * 🦉 TypeOwl Example Backend
 * 
 * Demonstrates FOUR ways to define API types:
 * 
 * 🔴 OPTION 1: No TypeOwl - Raw handlers, no type exposure
 * 🟡 OPTION 2: Static types only - Types extracted from src/types/
 * 🟢 OPTION 3: typeowl.endpoint() - Full type generation + validation (coupled to app)
 * 🔵 OPTION 4: route.get() - Framework-agnostic Zod validation (NEW!)
 * 
 * Run: npm run dev
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { initTypeOwl, route } from 'typeowl/server';

// Import types from our types folder
import type { Blog, Product } from './types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// 📦 ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const IdParamsSchema = z.object({ id: z.string() });

const BlogSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  published: z.boolean(),
  createdAt: z.string(),
});

const BlogInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
});

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  description: z.string().optional(),
  inStock: z.boolean(),
});

const ProductQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().optional(),
});

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

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 OPTION 4: route.get() - Framework-agnostic with Zod (NEW!)
// ═══════════════════════════════════════════════════════════════════════════
// Define routes ONCE, wire up with your framework
// Zod provides runtime validation + TypeOwl extracts types automatically.

const getBlogs = route.get('/api/blogs')
  .returns(z.array(BlogSchema));

const getBlogById = route.get('/api/blogs/:id')
  .withParams(IdParamsSchema)
  .returns(BlogSchema.nullable());

const createBlog = route.post('/api/blogs')
  .withBody(BlogInputSchema)
  .returns(BlogSchema);

const getProducts = route.get('/api/products')
  .withQuery(ProductQuerySchema)
  .returns(z.array(ProductSchema));

const getProductById = route.get('/api/products/:id')
  .withParams(IdParamsSchema)
  .returns(ProductSchema.nullable());

const getUsers = route.get('/api/users')
  .returns(z.array(UserSchema));

const getUserById = route.get('/api/users/:id')
  .withParams(IdParamsSchema)
  .returns(UserSchema.nullable());

const createUser = route.post('/api/users')
  .withBody(CreateUserSchema)
  .returns(UserSchema);

const deleteUser = route.del('/api/users/:id')
  .withParams(IdParamsSchema)
  .returns(z.object({ success: z.boolean(), message: z.string() }));

// ═══════════════════════════════════════════════════════════════════════════
// 🦉 TYPEOWL
// ═══════════════════════════════════════════════════════════════════════════

const typeowl = await initTypeOwl();

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 FASTIFY SERVER
// ═══════════════════════════════════════════════════════════════════════════

const app = Fastify({ logger: false });

await app.register(cors, { origin: true });
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
// 🔴 OPTION 1: No TypeOwl - Raw handler
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 OPTION 4: route.get() handlers - Framework-agnostic!
// ═══════════════════════════════════════════════════════════════════════════
// Use .path for route, .params()/.body()/.query() for validation, .response() for type-checking

// GET /api/blogs
app.get(getBlogs.path, async () => {
  return getBlogs.response(blogs);
});

// GET /api/blogs/:id
app.get(getBlogById.path, async (request, reply) => {
  const { id } = getBlogById.params(request.params);  // Validates with Zod!
  const blog = blogs.find(b => b.id === id);
  if (!blog) {
    reply.code(404).send({ error: 'Blog not found' });
    return null;
  }
  return getBlogById.response(blog);
});

// POST /api/blogs
app.post(createBlog.path, async (request, reply) => {
  try {
    const input = createBlog.body(request.body);  // Validates with Zod!
    const newBlog: Blog = {
      id: String(blogs.length + 1),
      title: input.title,
      content: input.content,
      published: false,
      createdAt: new Date().toISOString(),
    };
    blogs.push(newBlog);
    return createBlog.response(newBlog);
  } catch (err) {
    // ZodError - validation failed
    reply.code(400).send({ error: (err as Error).message });
    return null;
  }
});

// GET /api/products
app.get(getProducts.path, async (request) => {
  const { search, limit } = getProducts.query(request.query ?? {});  // Validates!
  let result = products;
  if (search) {
    result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }
  if (limit) {
    result = result.slice(0, limit);
  }
  return getProducts.response(result);
});

// GET /api/products/:id
app.get(getProductById.path, async (request, reply) => {
  const { id } = getProductById.params(request.params);
  const product = products.find(p => p.id === id);
  if (!product) {
    reply.code(404).send({ error: 'Product not found' });
    return null;
  }
  return getProductById.response(product);
});

// GET /api/users
app.get(getUsers.path, async () => {
  return getUsers.response(users);
});

// GET /api/users/:id
app.get(getUserById.path, async (request, reply) => {
  const { id } = getUserById.params(request.params);
  const user = users.find(u => u.id === id);
  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return null;
  }
  return getUserById.response(user);
});

// POST /api/users
app.post(createUser.path, async (request, reply) => {
  try {
    const input = createUser.body(request.body);  // Validates with Zod!
    const newUser: User = {
      id: String(users.length + 1),
      email: input.email,
      name: input.name,
      role: input.role,
    };
    users.push(newUser);
    return createUser.response(newUser);
  } catch (err) {
    reply.code(400).send({ error: (err as Error).message });
    return null;
  }
});

// DELETE /api/users/:id
app.delete(deleteUser.path, async (request, reply) => {
  const { id } = deleteUser.params(request.params);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    reply.code(404).send({ error: 'User not found' });
    return null;
  }
  users.splice(index, 1);
  return deleteUser.response({ success: true, message: 'User deleted' });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🟡 OPTION 2: Static types only - Types exposed via extract config
// ═══════════════════════════════════════════════════════════════════════════
// Blog and Product types are extracted from src/types/ via typeowl.server.config.ts
// Types are exposed at /__typeowl/types/content.d.ts but endpoints are NOT mapped.
// Frontend can import and use the types with force-casting.
// (The actual handlers for /api/blogs and /api/products are in Option 4 above)

// ═══════════════════════════════════════════════════════════════════════════
// 🟢 OPTION 3: typeowl.endpoint() - Framework-specific alternative
// ═══════════════════════════════════════════════════════════════════════════
// If you prefer passing the app instance directly:
//
// typeowl.endpoint(app, 'GET', '/api/example', {
//   response: z.object({ message: z.string() }),
// }, async () => ({ message: 'Hello!' }));
//
// typeowl.endpoint(app, 'POST', '/api/example', {
//   body: z.object({ name: z.string() }),
//   response: ',
// }, async ({ body }) => ({ greeting: `Hello, ${body.name}!` }));
//
// Note: typeowl.endpoint() is framework-specific (requires app instance).
// For framework-agnostic code, use route.get() (Option 4) instead.

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = 3001;

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log(`
\x1b[36m🦉 TypeOwl Example Backend\x1b[0m
\x1b[2m──────────────────────────────────────────────────────\x1b[0m

  Server:     \x1b[32mhttp://localhost:${PORT}\x1b[0m
  
  \x1b[34m🔵 route.get() - Framework-agnostic + Zod (⭐ Recommended):\x1b[0m
    GET    /api/blogs
    GET    /api/blogs/:id
    POST   /api/blogs        \x1b[33m← Try invalid body!\x1b[0m
    GET    /api/products
    GET    /api/products/:id
    GET    /api/users
    GET    /api/users/:id
    POST   /api/users        \x1b[33m← Try invalid body!\x1b[0m
    DELETE /api/users/:id
  
  \x1b[33m🟡 Static types (types extracted from src/types/):\x1b[0m
    Blog, BlogInput, Product types exposed
  
  \x1b[32m🟢 typeowl.endpoint() (see commented examples in code):\x1b[0m
    Framework-specific alternative
  
  \x1b[31m🔴 Raw handler (no TypeOwl):\x1b[0m
    GET    /api/health
  
  TypeOwl Endpoints:
    \x1b[33mhttp://localhost:${PORT}/__typeowl\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/content.d.ts\x1b[0m

  \x1b[36mWorks with: Fastify, Express, Hono, Next.js, Koa\x1b[0m

  \x1b[2mPress Ctrl+C to stop\x1b[0m
`);
});
