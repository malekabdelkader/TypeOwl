<p align="center">
  <img src="https://typeowl.netlify.app/typeOwl.logo.png" alt="TypeOwl Logo" width="180" />
</p>

<h1 align="center">TypeOwl</h1>

<p align="center">
  <em>Runtime type synchronization between backend and frontend — types that fly across repos.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/typeowl"><img src="https://img.shields.io/npm/v/typeowl.svg?style=flat-square&color=f59e0b" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/typeowl"><img src="https://img.shields.io/npm/dm/typeowl.svg?style=flat-square&color=10b981" alt="npm downloads"></a>
  <a href="https://github.com/malekabdelkader/TypeOwl/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/typeowl.svg?style=flat-square&color=94a1b2" alt="license"></a>
  <a href="https://typeowl.netlify.app"><img src="https://img.shields.io/badge/docs-typeowl.netlify.app-blue?style=flat-square" alt="documentation"></a>
</p>

<p align="center">
  <strong>⚠️ Experimental</strong> — API may change before v1.0
</p>

<p align="center">
  <a href="https://typeowl.netlify.app">📚 Documentation</a> •
  <a href="https://www.npmjs.com/package/typeowl">📦 NPM Package</a> •
  <a href="https://github.com/malekabdelkader/TypeOwl">🐙 GitHub</a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#three-ways-to-define-types">Type Definition Options</a> •
  <a href="#features">Features</a> •
  <a href="#examples">Examples</a>
</p>

---

TypeOwl solves the **multi-repo type sharing problem**. When your backend and frontend live in separate repositories (or are managed by different teams), TypeOwl lets types travel over HTTP during development.

## The Problem

```typescript
// Backend repo (Team A)
interface User {
  id: string;
  email: string;
  name: string | null;
}

// Frontend repo (Team B)
// How do they get these types? 🤔
// - Copy/paste? Drifts out of sync
// - NPM package? Publishing overhead
// - Monorepo? Not always possible
```

## The Solution

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (deployed)                           │
│                                                                 │
│   /api/users              ← Your actual API                    │
│   /__typeowl              ← Lightweight manifest (JSON)        │
│   /__typeowl/types/*.d.ts ← TypeScript definitions             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                        HTTP (dev-time)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (npm run dev)                       │
│                                                                 │
│   1. typeowl sync       ← Fetches manifest, compares hashes    │
│   2. Downloads changed type files only (incremental!)          │
│   3. import type { User } from '@typeowl'  ← Full autocomplete!│
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Install

```bash
npm install typeowl

# Optional: Install Zod for runtime validation (typeowl.endpoint)
npm install zod
```

### Backend Setup

**1. Create config file:**

```typescript
// typeowl.server.config.ts
import { defineServerConfig } from 'typeowl/server';
import type { FastifyInstance } from 'fastify';

export default defineServerConfig({
  version: '1.0.0',
  
  // Security: Only these paths can have types extracted
  typeSources: './src/types/',
  
  // Extract types from files (creates content.d.ts)
  extract: {
    content: {
      from: './src/types/',
      types: '*',  // Extract ALL exported types, or specify: ['Blog', 'Product']
    },
  },
  
  // Dynamic mode: serve types at runtime
  mode: 'dynamic',
  
  // Register TypeOwl routes (framework-specific)
  registerRoutes: (appInstance, typeowl, config) => {
    const app = appInstance as FastifyInstance;
    const basePath = typeowl.getBasePath();

    // Manifest endpoint
    app.get(basePath, async (request, reply) => {
      const response = typeowl.handleRequest(basePath);
      if (response) return reply.type(response.contentType).send(response.body);
      return reply.code(404).send({ error: 'Not found' });
    });

    // Type files endpoint
    app.get(`${basePath}/types/:file`, async (request, reply) => {
      const { file } = request.params as { file: string };
      const response = typeowl.handleRequest(`${basePath}/types/${file}`);
      if (response) return reply.type(response.contentType).send(response.body);
      return reply.code(404).send({ error: 'Not found' });
    });
  },
});
```

**2. Use in your server:**

```typescript
// server.ts
import Fastify from 'fastify';
import { z } from 'zod';
import { initTypeOwl } from 'typeowl/server';

// Auto-loads config from typeowl.server.config.ts
const typeowl = await initTypeOwl();

const app = Fastify();

// Mount TypeOwl routes (uses registerRoutes from config)
await typeowl.mount(app);

// Define schemas
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'user', 'guest']),
});

// 🟢 typeowl.endpoint() - Full type generation + validation
typeowl.endpoint(app, 'GET', '/api/users', {
  response: z.array(UserSchema),
}, async () => users);

typeowl.endpoint(app, 'POST', '/api/users', {
  body: CreateUserSchema,
  response: UserSchema,
}, async ({ body }) => {
  // body is validated and typed!
  return createUser(body);
});

// You can also reference extracted types by name!
typeowl.endpoint(app, 'GET', '/api/products', {
  response: 'Product[]',  // References Product from extract config
}, async () => products);

app.listen({ port: 3001 });
```

### Frontend Setup

**1. Create config file:**

```typescript
// typeowl.config.ts
import { defineConfig } from 'typeowl';

export default defineConfig({
  resolvers: [
    {
      name: 'api',
      source: 'http://localhost:3001/__typeowl',
    },
  ],
  output: './.typeowl',
  cache: './.typeowl-cache',
});
```

**2. Sync types using CLI:**

```bash
# One-time sync
npx typeowl sync

# Watch mode (polls every 5 seconds by default)
npx typeowl watch

# Watch with custom interval (in seconds)
npx typeowl watch --interval 10
```

**3. Add to package.json:**

```json
{
  "scripts": {
    "dev": "npx typeowl sync && vite",
    "dev:watch": "concurrently \"npx typeowl watch\" \"vite\""
  }
}
```

**4. Configure TypeScript paths:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@typeowl": ["./.typeowl/index.d.ts"],
      "@typeowl/*": ["./.typeowl/*"]
    }
  }
}
```

**5. Use in your frontend:**

```typescript
import type { User, Blog, Product, ApiEndpoints } from '@typeowl';

// Full autocomplete and type safety! ✨
const users: User[] = await fetch('/api/users').then(r => r.json());
```

## Three Ways to Define Types

TypeOwl supports three approaches, from zero-config to full validation:

### 🔴 Option 1: No TypeOwl (Raw Handlers)

```typescript
// Backend: Regular handler, no TypeOwl
app.get('/api/health', async () => {
  return { status: 'ok' };
});

// Frontend: Manual type or `any`
const health = await fetch('/api/health').then(r => r.json()) as HealthResponse;
```

### 🟡 Option 2: Static Types (Extract from Files)

```typescript
// src/types/Blog.ts
export type Blog = {
  id: string;
  title: string;
  content: string;
};

// typeowl.server.config.ts
extract: {
  content: { 
    from: './src/types/', 
    types: '*',  // Extract all, or specify: ['Blog', 'Product']
  },
}

// Frontend: Force-cast with exposed type
import type { Blog } from '@typeowl';
const blogs = await fetch('/api/blogs').then(r => r.json()) as Blog[];
```

### 🟢 Option 3: typeowl.endpoint() (Full Type Safety + Validation)

```typescript
// Backend: Auto-validates AND registers types
// With Zod schemas:
typeowl.endpoint(app, 'GET', '/api/users', {
  response: z.array(UserSchema),
}, async () => users);

typeowl.endpoint(app, 'POST', '/api/users', {
  body: CreateUserSchema,
  response: UserSchema,
}, async ({ body }) => {
  // body is validated by Zod before reaching here!
  return createUser(body);
});

// Or with type references (no Zod needed for response):
typeowl.endpoint(app, 'GET', '/api/products', {
  response: 'Product[]',  // References extracted type
}, async () => products);

// Frontend: Fully typed ApiEndpoints
import type { ApiEndpoints } from '@typeowl';
// ApiEndpoints['GET /api/users'] = { response: User[] }
// ApiEndpoints['POST /api/users'] = { body: CreateUser; response: User }
```

## Building a Typed API Client

Use the generated `ApiEndpoints` to build a fully typed fetch wrapper:

```typescript
// api/client.ts
import type { ApiEndpoints } from '@typeowl';

type ExtractPaths<Method extends string> = {
  [K in keyof ApiEndpoints]: K extends `${Method} ${infer Path}` ? Path : never;
}[keyof ApiEndpoints];

type GetPath = ExtractPaths<'GET'>;
type PostPath = ExtractPaths<'POST'>;

type EndpointConfig<M extends string, P extends string> = 
  `${M} ${P}` extends keyof ApiEndpoints 
    ? ApiEndpoints[`${M} ${P}`] 
    : never;

export const api = {
  get: <P extends GetPath>(path: P) => 
    fetch(path).then(r => r.json()) as Promise<EndpointConfig<'GET', P>['response']>,

  post: <P extends PostPath>(path: P, body: EndpointConfig<'POST', P>['body']) => 
    fetch(path, { 
      method: 'POST', 
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()) as Promise<EndpointConfig<'POST', P>['response']>,
};

// Usage - fully typed!
const users = await api.get('/api/users');     // User[]
const user = await api.post('/api/users', { name: 'John', email: 'john@example.com' }); // User
```

## Features

- 🔄 **Incremental sync** — Only fetches files that changed (via hash comparison)
- 📦 **Domain-based organization** — Separate types by domain (users, posts, content)
- 🗺️ **Endpoint mapping** — Full type safety for API calls via `ApiEndpoints`
- ✅ **Runtime validation** — `typeowl.endpoint()` validates with Zod (optional)
- 📁 **Static type extraction** — Extract types directly from `.ts` files (no Zod needed!)
- 🔀 **Mixed mode** — Use Zod for body validation, type references for responses
- 💾 **Offline cache** — Works when backend is down
- 👀 **Watch mode** — Auto-refresh on changes
- 🔒 **Guard config** — Protect TypeOwl endpoints with API keys

### Zod is Optional

| Feature | Requires Zod? |
|---------|---------------|
| Static type extraction (`extract` config) | ❌ No |
| `typeowl.endpoint()` with type references | ❌ No |
| `registerType()`, `registerObject()` | ❌ No |
| Client-side type sync | ❌ No |
| `registerZod()` | ✅ Yes |
| `typeowl.endpoint()` with Zod schemas (validation) | ✅ Yes |

## Server Configuration

```typescript
// typeowl.server.config.ts
import { defineServerConfig } from 'typeowl/server';

export default defineServerConfig({
  // Base path for TypeOwl endpoints
  basePath: '/__typeowl',
  
  // Version for cache invalidation
  version: '1.0.0',
  
  // Include git commit in manifest
  includeGitCommit: false,
  
  // Allowed paths for type extraction (security)
  typeSources: './src/types/',
  
  // Static type extraction
  extract: {
    content: { from: './src/types/', types: '*' },  // All types
    models: { from: './src/models/', types: ['User', 'Order'] },  // Specific types
  },
  
  // Serving mode
  mode: 'dynamic',  // 'dynamic' (runtime) or 'static' (CLI generated)
  
  // Register HTTP routes (required for dynamic mode)
  registerRoutes: (app, typeowl, config) => {
    // Your framework-specific route registration
  },
  
  // Security: protect TypeOwl endpoints
  guard: {
    enabled: 'development', // true | false | 'development'
    apiKey: process.env.TYPEOWL_API_KEY,
  },
});
```

## Client Configuration

```typescript
// typeowl.config.ts
import { defineConfig } from 'typeowl';

export default defineConfig({
  // Single backend (shorthand)
  resolvers: 'http://localhost:3001/__typeowl',
  
  // Or named resolver
  resolvers: {
    name: 'api',
    source: 'http://localhost:3001/__typeowl',
  },
  
  // Or multiple backends (microservices)
  resolvers: [
    { name: 'api', source: 'http://localhost:3001/__typeowl' },
    { name: 'auth', source: 'http://localhost:3002/__typeowl' },
  ],
  
  // Output directory
  output: './.typeowl',
  
  // Cache for offline fallback
  cache: './.typeowl-cache',
  
  // Watch mode (poll interval in ms, or true for 5000ms)
  watch: 5000,
  
  // Lifecycle hooks
  hooks: {
    beforeSync: () => console.log('Starting sync...'),
    afterResolverSync: (resolver, result) => {
      console.log(`${resolver}: v${result.version}`);
    },
    afterSync: (results) => {
      console.log('Sync complete!');
    },
  },
});
```

## Examples

See the `examples/` directory for complete working examples:

```bash
# Terminal 1: Start the backend
cd examples/backend
npm install
npm run dev

# Terminal 2: Start the frontend
cd examples/frontend
npm install
npm run dev
```

- **Backend**: Fastify server with all three type definition approaches
- **Frontend**: React + Vite app with typed API client

## Comparison

| Feature | TypeOwl | tRPC | GraphQL Codegen |
|---------|---------|------|-----------------|
| Works across repos | ✅ | ❌ (needs monorepo) | ✅ |
| No build step | ✅ | ✅ | ❌ |
| REST APIs | ✅ | ❌ | ❌ |
| Runtime validation | ✅ | ✅ | ❌ |
| Incremental sync | ✅ | N/A | ❌ |
| Static type extraction | ✅ | ❌ | ❌ |
| Endpoint type map | ✅ | ✅ | ✅ |

## Roadmap

- [x] CLI tool (`npx typeowl sync`, `npx typeowl watch`, `npx typeowl generate`)
- [ ] Named endpoints (config-based mapper)
- [ ] Vite/Webpack plugins
- [ ] Database schema integration (Prisma, Drizzle)
- [ ] VS Code extension

## License

MIT
