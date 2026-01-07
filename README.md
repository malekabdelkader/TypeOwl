# 🦉 TypeOwl

> Runtime type synchronization between backend and frontend — types that fly across repos.

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

export default defineServerConfig({
  version: '1.0.0',
  
  // Security: Only these paths can have types extracted
  typeSources: './src/types/',
  
  // Extract types from files (creates content.d.ts)
  extract: {
    content: {
      from: './src/types/',
      types: ['Blog', 'Product'],
    },
  },
  
  // Register TypeOwl routes (framework-specific)
  registerRoutes: (app, typeowl) => {
    // For Fastify:
    app.get('/__typeowl', (req, reply) => { /* ... */ });
    app.get('/__typeowl/*', (req, reply) => { /* ... */ });
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

// Mount TypeOwl routes
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

app.listen({ port: 3001 });
```

### Frontend Setup

**1. Create config file:**

```typescript
// typeowl.config.ts
import { defineConfig } from 'typeowl';

export default defineConfig({
  resolvers: {
    name: 'api',
    source: 'http://localhost:3001/__typeowl',
  },
  output: './.typeowl',
});
```

**2. Create sync script:**

```typescript
// scripts/sync-types.ts
import { loadConfigAndSync } from 'typeowl';

await loadConfigAndSync();
```

**3. Add to package.json:**

```json
{
  "scripts": {
    "dev": "npm run typeowl:sync && vite",
    "typeowl:sync": "tsx scripts/sync-types.ts"
  }
}
```

**4. Configure TypeScript paths:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@typeowl": ["./.typeowl/index.d.ts"]
    }
  }
}
```

**5. Use in your frontend:**

```typescript
import type { User, Blog, ApiEndpoints } from '@typeowl';

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
  content: { from: './src/types/', types: ['Blog'] },
}

// Frontend: Force-cast with exposed type
import type { Blog } from '@typeowl';
const blogs = await fetch('/api/blogs').then(r => r.json()) as Blog[];
```

### 🟢 Option 3: typeowl.endpoint() (Full Type Safety + Validation)

```typescript
// Backend: Auto-validates AND registers types
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

// Frontend: Fully typed ApiEndpoints
import type { ApiEndpoints } from '@typeowl';
// ApiEndpoints['GET /api/users'] = { response: User[] }
// ApiEndpoints['POST /api/users'] = { body: CreateUser; response: User }
```

## Building a Typed API Client

Use the generated `ApiEndpoints` to build an axios-like client:

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
- 💾 **Offline cache** — Works when backend is down
- 👀 **Watch mode** — Auto-refresh on changes
- 🔒 **Guard config** — Protect TypeOwl endpoints with API keys

### Zod is Optional

| Feature | Requires Zod? |
|---------|---------------|
| Static type extraction (`extract` config) | ❌ No |
| `registerType()`, `registerObject()` | ❌ No |
| Client-side type sync | ❌ No |
| `registerZod()` | ✅ Yes |
| `typeowl.endpoint()` (auto-validation) | ✅ Yes |

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
    content: { from: './src/types/', types: ['Blog', 'Product'] },
    models: { from: './src/models/', types: ['User', 'Order'] },
  },
  
  // Dynamic mode: register HTTP routes
  mode: 'dynamic',
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
  // Single backend
  resolvers: 'http://localhost:3001/__typeowl',
  
  // Or multiple backends
  resolvers: [
    { name: 'api', source: 'http://localhost:3001/__typeowl' },
    { name: 'auth', source: 'http://localhost:3002/__typeowl' },
  ],
  
  // Output directory
  output: './.typeowl',
  
  // Cache for offline fallback
  cache: './.typeowl-cache',
  
  // Watch mode (poll interval in ms)
  watch: 5000,
  
  // Request hooks
  headers: { 'X-TypeOwl-Key': 'my-api-key' },
  onRequest: (url, init) => init,
  onResponse: (response) => response,
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

- [ ] CLI tool (`npx typeowl sync`)
- [ ] Named endpoints (config-based mapper)
- [ ] Vite/Webpack plugins
- [ ] Database schema integration (Prisma, Drizzle)
- [ ] VS Code extension

## License

MIT
