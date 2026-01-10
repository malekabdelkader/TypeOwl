/**
 * 🦉 TypeOwl Example Backend
 * 
 * Demonstrates TypeOwl with pure TypeScript types - no Zod needed!
 * TypeChecker extracts types at build time via CLI.
 * 
 * Run: npm run dev
 * Generate types: npx typeowl generate
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initTypeOwl, route } from 'typeowl/server';

// Import types from our types folder (for static type extraction)
import type { Blog, BlogInput, CreateUserInput, Product, User } from './types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// 📦 PURE TYPESCRIPT TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface IdParams {
  id: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

interface ProductQuery {
  search?: string;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 ROUTE DEFINITIONS - Pure TypeScript generics!
// ═══════════════════════════════════════════════════════════════════════════

// Blog routes
const getBlogs = route
  .get('/api/blogs')
  .returns<Blog[]>();

const getBlogById = route
  .get('/api/blogs/:id')
  .params<IdParams>()
  .returns<Blog | null>();

const createBlog = route
  .post('/api/blogs')
  .body<BlogInput>()
  .returns<Blog>();

// Product routes
const getProducts = route
  .get('/api/products')
  .query<ProductQuery>()
  .returns<Product[]>();

const getProductById = route
  .get('/api/products/:id')
  .params<IdParams>()
  .returns<Product | null>();

// User routes
const getUsers = route
  .get('/api/users')
  .returns<User[]>();

const getUserById = route
  .get('/api/users/:id')
  .params<IdParams>()
  .returns<User | null>();

const createUser = route
  .post('/api/users')
  .body<CreateUserInput>()
  .returns<User>();

const deleteUser = route
  .del('/api/users/:id')
  .params<IdParams>()
  .returns<DeleteResponse>();

// ═══════════════════════════════════════════════════════════════════════════
// 🦉 TYPEOWL INITIALIZATION
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

const users: User[] = [
  { id: '1', email: 'alice@example.com', name: 'Alice', role: 'admin' },
  { id: '2', email: 'bob@example.com', name: 'Bob', role: 'user' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 RAW HANDLER (No TypeOwl)
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 ROUTE HANDLERS - Clean, type-safe handlers
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/blogs
app.get(getBlogs.path, async () => {
  return blogs;
});

// GET /api/blogs/:id
app.get(getBlogById.path, async (request, reply) => {
  const { id } = request.params as IdParams;
  const blog = blogs.find(b => b.id === id);
  if (!blog) {
    reply.code(404).send({ error: 'Blog not found' });
    return null;
  }
  return blog;
});

// POST /api/blogs
app.post(createBlog.path, async (request, reply) => {
  const input = request.body as BlogInput;
  // Optional: Add validation here with your preferred library
  if (!input.title || !input.content) {
    reply.code(400).send({ error: 'Title and content are required' });
    return null;
  }
  const newBlog: Blog = {
    id: String(blogs.length + 1),
    title: input.title,
    content: input.content,
    published: false,
    createdAt: new Date().toISOString(),
  };
  blogs.push(newBlog);
  return newBlog;
});

// GET /api/products
app.get(getProducts.path, async (request) => {
  const query = request.query as ProductQuery;
  let result = products;
  if (query.search) {
    result = result.filter(p => p.name.toLowerCase().includes(query.search!.toLowerCase()));
  }
  if (query.limit) {
    result = result.slice(0, Number(query.limit));
  }
  return result;
});

// GET /api/products/:id
app.get(getProductById.path, async (request, reply) => {
  const { id } = request.params as IdParams;
  const product = products.find(p => p.id === id);
  if (!product) {
    reply.code(404).send({ error: 'Product not found' });
    return null;
  }
  return product;
});

// GET /api/users
app.get(getUsers.path, async () => {
  return users;
});

// GET /api/users/:id
app.get(getUserById.path, async (request, reply) => {
  const { id } = request.params as IdParams;
  const user = users.find(u => u.id === id);
  if (!user) {
    reply.code(404).send({ error: 'User not found' });
    return null;
  }
  return user;
});

// POST /api/users
app.post(createUser.path, async (request, reply) => {
  const input = request.body as CreateUserInput;
  // Optional: Add validation here
  if (!input.email || !input.name) {
    reply.code(400).send({ error: 'Email and name are required' });
    return null;
  }
  const newUser: User = {
    id: String(users.length + 1),
    email: input.email,
    name: input.name,
    role: input.role ?? 'user',
  };
  users.push(newUser);
  return newUser;
});

// DELETE /api/users/:id
app.delete(deleteUser.path, async (request, reply) => {
  const { id } = request.params as IdParams;
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    reply.code(404).send({ error: 'User not found' });
    return null;
  }
  users.splice(index, 1);
  return { success: true, message: 'User deleted' };
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = 3001;

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log(`
\x1b[36m🦉 TypeOwl Example Backend (TypeChecker)\x1b[0m
\x1b[2m──────────────────────────────────────────────────────\x1b[0m

  Server:     \x1b[32mhttp://localhost:${PORT}\x1b[0m
  
  \x1b[34m🔵 Routes with pure TypeScript types:\x1b[0m
    GET    /api/blogs
    GET    /api/blogs/:id
    POST   /api/blogs
    GET    /api/products
    GET    /api/products/:id
    GET    /api/users
    GET    /api/users/:id
    POST   /api/users
    DELETE /api/users/:id
  
  \x1b[33m🟡 Static types (from src/types/):\x1b[0m
    Blog, Product types auto-extracted
  
  \x1b[31m🔴 Raw handler (no TypeOwl):\x1b[0m
    GET    /api/health
  
  TypeOwl Endpoints:
    \x1b[33mhttp://localhost:${PORT}/__typeowl\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/content.d.ts\x1b[0m

  \x1b[2mPress Ctrl+C to stop\x1b[0m
`);
});
