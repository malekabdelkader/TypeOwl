/**
 * 🦉 TypeOwl Example Backend
 * 
 * A Fastify server that exposes types via TypeOwl.
 * 
 * Run: npm run dev
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { createTypeOwl } from 'typeowl/server';

// ═══════════════════════════════════════════════════════════════════════════
// 📦 DEFINE YOUR SCHEMAS (using Zod)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Users Domain ────────────────────────────────────────────────────────────

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.string(),
});

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
});

const UserQuerySchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

// ─── Posts Domain ────────────────────────────────────────────────────────────

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),
  published: z.boolean(),
  createdAt: z.string(),
});

const CreatePostSchema = z.object({
  title: z.string(),
  content: z.string(),
  published: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// 🦉 REGISTER TYPES WITH TYPEOWL
// ═══════════════════════════════════════════════════════════════════════════

const typeowl = createTypeOwl({
  version: '1.0.0',
  basePath: '/__typeowl',
});

// Register user-related types in "users" domain
typeowl
  .domain('users')
  .registerZod('User', UserSchema)
  .registerZod('CreateUserInput', CreateUserSchema)
  .registerZod('UserQuery', UserQuerySchema)
  .registerObject('PaginatedUsers', {
    users: { kind: 'array', element: { kind: 'reference', name: 'User' } },
    total: { kind: 'primitive', value: 'number' },
    page: { kind: 'primitive', value: 'number' },
  });

// Register post-related types in "posts" domain
typeowl
  .domain('posts')
  .registerZod('Post', PostSchema)
  .registerZod('CreatePostInput', CreatePostSchema);

// Register common/shared types in "common" domain
typeowl
  .domain('common')
  .registerObject('ApiError', {
    error: { kind: 'primitive', value: 'string' },
    code: { kind: 'primitive', value: 'number' },
    details: { type: { kind: 'primitive', value: 'unknown' }, optional: true },
  })
  .registerObject('ApiSuccess', {
    success: { kind: 'primitive', value: 'boolean' },
    message: { type: { kind: 'primitive', value: 'string' }, optional: true },
  });

// Register API endpoints
typeowl
  .domain('main')
  .get('/api/users', 'User[]', { query: 'UserQuery', description: 'List all users' })
  .get('/api/users/:id', 'User', { params: '{ id: string }', description: 'Get user by ID' })
  .post('/api/users', 'User', { body: 'CreateUserInput', description: 'Create a new user' })
  .put('/api/users/:id', 'User', { body: 'CreateUserInput', params: '{ id: string }' })
  .delete('/api/users/:id', 'ApiSuccess', { params: '{ id: string }' })
  .get('/api/posts', 'Post[]', { description: 'List all posts' })
  .get('/api/posts/:id', 'Post', { params: '{ id: string }' })
  .post('/api/posts', 'Post', { body: 'CreatePostInput' });

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 FASTIFY SERVER
// ═══════════════════════════════════════════════════════════════════════════

const app = Fastify({ logger: false });

// Enable CORS for frontend
await app.register(cors, { origin: true });

// ─── Fake Data ───────────────────────────────────────────────────────────────

type User = z.infer<typeof UserSchema>;
type Post = z.infer<typeof PostSchema>;

const users: User[] = [
  { id: '1', email: 'alice@example.com', name: 'Alice', role: 'admin', createdAt: new Date().toISOString() },
  { id: '2', email: 'bob@example.com', name: 'Bob', role: 'user', createdAt: new Date().toISOString() },
  { id: '3', email: 'charlie@example.com', name: null, role: 'guest', createdAt: new Date().toISOString() },
];

const posts: Post[] = [
  { id: '1', title: 'Hello World', content: 'Welcome to TypeOwl!', authorId: '1', published: true, createdAt: new Date().toISOString() },
  { id: '2', title: 'Getting Started', content: 'Let me show you how...', authorId: '1', published: true, createdAt: new Date().toISOString() },
];

// ─── TypeOwl Endpoints ───────────────────────────────────────────────────────

app.get('/__typeowl', async (request, reply) => {
  const response = typeowl.handleRequest('/__typeowl');
  if (response) {
    return reply.type(response.contentType).send(response.body);
  }
  return reply.code(404).send({ error: 'Not found' });
});

app.get('/__typeowl/manifest.json', async (request, reply) => {
  const response = typeowl.handleRequest('/__typeowl/manifest.json');
  if (response) {
    return reply.type(response.contentType).send(response.body);
  }
  return reply.code(404).send({ error: 'Not found' });
});

app.get('/__typeowl/types/:file', async (request, reply) => {
  const { file } = request.params as { file: string };
  const response = typeowl.handleRequest(`/__typeowl/types/${file}`);
  if (response) {
    return reply.type(response.contentType).send(response.body);
  }
  return reply.code(404).send({ error: 'Not found' });
});

// ─── API Endpoints ───────────────────────────────────────────────────────────

// Users
app.get('/api/users', async () => users);

app.get('/api/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = users.find(u => u.id === id);
  if (!user) {
    return reply.code(404).send({ error: 'User not found', code: 404 });
  }
  return user;
});

app.post('/api/users', async (request) => {
  const input = CreateUserSchema.parse(request.body);
  const newUser: User = {
    id: String(users.length + 1),
    email: input.email,
    name: input.name ?? null,
    role: input.role ?? 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  return newUser;
});

app.delete('/api/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    return reply.code(404).send({ error: 'User not found', code: 404 });
  }
  users.splice(index, 1);
  return { success: true, message: 'User deleted' };
});

// Posts
app.get('/api/posts', async () => posts);

app.get('/api/posts/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const post = posts.find(p => p.id === id);
  if (!post) {
    return reply.code(404).send({ error: 'Post not found', code: 404 });
  }
  return post;
});

app.post('/api/posts', async (request) => {
  const input = CreatePostSchema.parse(request.body);
  const newPost: Post = {
    id: String(posts.length + 1),
    title: input.title,
    content: input.content,
    authorId: '1', // Default author
    published: input.published ?? false,
    createdAt: new Date().toISOString(),
  };
  posts.push(newPost);
  return newPost;
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
    GET    /api/users
    GET    /api/users/:id
    POST   /api/users
    DELETE /api/users/:id
    GET    /api/posts
    GET    /api/posts/:id
    POST   /api/posts
  
  TypeOwl Endpoints:
    \x1b[33mhttp://localhost:${PORT}/__typeowl\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/users.d.ts\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/posts.d.ts\x1b[0m
    \x1b[33mhttp://localhost:${PORT}/__typeowl/types/index.d.ts\x1b[0m

  \x1b[2mPress Ctrl+C to stop\x1b[0m
`);
});

