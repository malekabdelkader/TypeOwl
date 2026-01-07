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
```

### Backend Setup

```typescript
// server.ts
import { createTypeOwl } from 'typeowl/server';
import { z } from 'zod';

const typeowl = createTypeOwl({ version: '1.0.0' });

// Register types by domain
const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.enum(['admin', 'user', 'guest']),
});

typeowl
  .domain('users')
  .registerZod('User', UserSchema)
  .registerZod('CreateUserInput', CreateUserSchema);

typeowl
  .domain('posts')
  .registerZod('Post', PostSchema);

// Register API endpoints
typeowl
  .domain('main')
  .get('/api/users', 'User[]', { query: 'UserQuery' })
  .post('/api/users', 'User', { body: 'CreateUserInput' });

// In your HTTP server, handle TypeOwl requests
app.get('/__typeowl/*', (req, res) => {
  const response = typeowl.handleRequest(req.path);
  if (response) {
    res.type(response.contentType).send(response.body);
  }
});
```

### Frontend Setup

```typescript
// scripts/sync-types.ts
import { syncTypes } from 'typeowl/client';

await syncTypes({
  source: 'http://localhost:3001/__typeowl',
  outputDir: './.typeowl',
});
```

```json
// package.json
{
  "scripts": {
    "dev": "npm run typeowl:sync && vite",
    "typeowl:sync": "tsx scripts/sync-types.ts",
    "typeowl:watch": "tsx scripts/sync-types.ts --watch"
  }
}
```

```typescript
// In your frontend code
import type { User, Post, ApiEndpoints } from '@typeowl';

const users: User[] = await fetch('/api/users').then(r => r.json());
// Full autocomplete! ✨
```

## Features

- 🔄 **Incremental sync** — Only fetches files that changed (via hash comparison)
- 📦 **Domain-based organization** — Separate types by domain (users, posts, common)
- 🗺️ **Endpoint mapping** — Full type safety for API calls via `ApiEndpoints`
- 💾 **Offline cache** — Works when backend is down
- 👀 **Watch mode** — Auto-refresh on changes
- 🚫 **No git conflicts** — Generated files are gitignored

## How It Works

1. **Backend** registers types by domain and exposes them via `/__typeowl`
2. **Frontend** runs `typeowl sync` during development
3. Manifest is fetched (lightweight JSON with file hashes)
4. Only changed type files are downloaded
5. Types are written to `.typeowl/` directory
6. You import types normally — TypeScript sees them as any other module
7. In production, no type endpoints are needed (types are compile-time only)

## Manifest Structure

TypeOwl uses a lightweight manifest that only contains metadata and file pointers:

```json
{
  "manifestVersion": "1.0.0",
  "version": "1.0.0",
  "files": {
    "users": {
      "path": "/__typeowl/types/users.d.ts",
      "hash": "a3f8c2b1",
      "exports": ["User", "CreateUserInput", "UserQuery"]
    },
    "posts": {
      "path": "/__typeowl/types/posts.d.ts",
      "hash": "d4e5f6a7",
      "exports": ["Post", "CreatePostInput"]
    }
  },
  "endpoints": { ... }
}
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

- **Backend**: Fastify server with TypeOwl type endpoints
- **Frontend**: React + Vite app that syncs and uses types

## API Reference

### Server

```typescript
import { createTypeOwl } from 'typeowl/server';

const typeowl = createTypeOwl({
  version: '1.0.0',        // For cache invalidation
  basePath: '/__typeowl',  // Where to expose types
});

// Switch to a domain
typeowl.domain('users');

// Register types
typeowl.registerZod('User', UserSchema);
typeowl.registerObject('Config', { key: 'string', value: 'unknown' });

// Register endpoints
typeowl.get('/api/users', 'User[]', { query: 'UserQuery' });
typeowl.post('/api/users', 'User', { body: 'CreateUserInput' });

// Handle requests
const response = typeowl.handleRequest(req.path);
if (response) {
  res.type(response.contentType).send(response.body);
}
```

### Client

```typescript
import { syncTypes, createTypeOwlClient } from 'typeowl/client';

// One-shot sync
await syncTypes({
  source: 'http://localhost:3001/__typeowl',
  outputDir: '.typeowl',
});

// Or with watch mode
const client = createTypeOwlClient({
  source: 'http://localhost:3001/__typeowl',
  watchInterval: 5000, // Poll every 5 seconds
});

await client.sync();
client.startWatch();
```

## Comparison

| Feature | TypeOwl | tRPC | GraphQL Codegen |
|---------|---------|------|-----------------|
| Works across repos | ✅ | ❌ (needs monorepo) | ✅ |
| No build step | ✅ | ✅ | ❌ |
| REST APIs | ✅ | ❌ | ❌ |
| Incremental sync | ✅ | N/A | ❌ |
| Endpoint type map | ✅ | ✅ | ✅ |

## Roadmap

- [ ] CLI tool (`npx typeowl sync`)
- [ ] Vite/Webpack plugins
- [ ] Database schema integration (Prisma, Drizzle)
- [ ] VS Code extension

## License

MIT
