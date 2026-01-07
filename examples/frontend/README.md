<p align="center">
  <img src="./public/typeOwl.logo.png" alt="TypeOwl Logo" width="120" />
</p>

# TypeOwl Example Frontend

A React + Vite app that syncs types from the backend using TypeOwl.

## Setup

```bash
# Make sure backend is running first!
cd ../backend && npm install && npm run dev

# Then in a new terminal:
npm install
npm run dev
```

The app starts on `http://localhost:5173`.

## Configuration

TypeOwl uses a config file similar to Vite or Rsbuild:

```typescript
// typeowl.config.ts
import { defineConfig } from 'typeowl';

export default defineConfig({
  // Single backend
  resolvers: [
    {
      name: 'api',
      source: 'http://localhost:3001/__typeowl',
    },
  ],
  
  // Or multiple backends (microservices)
  // resolvers: [
  //   { name: 'api', source: 'http://localhost:3001/__typeowl' },
  //   { name: 'auth', source: 'http://localhost:3002/__typeowl' },
  //   { name: 'payments', source: 'http://localhost:3003/__typeowl' },
  // ],
  
  output: './.typeowl',
  cache: './.typeowl-cache',
  
  // Lifecycle hooks
  hooks: {
    afterResolverSync: (resolver, result) => {
      console.log(`  ✓ ${resolver}: v${result.version}`);
    },
  },
});
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Sync types once, then start Vite |
| `npm run dev:watch` | Sync types continuously + start Vite |
| `npm run typeowl:sync` | One-time type sync |
| `npm run typeowl:watch` | Watch for type changes (polls every 5s) |
| `npm run build` | Production build |

## How It Works

### 1. Configure Resolvers

Define your backend sources in `typeowl.config.ts`:

```typescript
export default defineConfig({
  resolvers: [
    { name: 'api', source: 'http://localhost:3001/__typeowl' },
  ],
});
```

### 2. Sync Types

```bash
npm run typeowl:sync
# → Loads typeowl.config.ts
# → Fetches types from each resolver
# → Writes to .typeowl/
```

### 3. Import Types

```typescript
// Import all types from the index
import type { User, Post, ApiEndpoints } from '@typeowl';

// Or import from specific domains
import type { User } from '@typeowl/users';
import type { Post } from '@typeowl/posts';
import type { ApiError } from '@typeowl/common';
```

### 4. Type-Safe API Calls

```typescript
// The API knows exact request/response types!
const users: User[] = await api('GET /api/users');

const newUser: User = await api('POST /api/users', {
  body: { email: 'test@example.com', name: 'Test' }
});
```

## Generated Files

After syncing, you'll have:

```
.typeowl/
├── index.d.ts    # Re-exports all types + ApiEndpoints
├── users.d.ts    # User, CreateUserInput, UserQuery, etc.
├── posts.d.ts    # Post, CreatePostInput
├── common.d.ts   # ApiError, ApiSuccess
├── main.d.ts     # (endpoints domain - usually empty)
└── package.json  # Module config
```

## Multi-Backend Setup

For microservices architecture with multiple backends:

```typescript
// typeowl.config.ts
export default defineConfig({
  resolvers: [
    { name: 'api', source: 'http://localhost:3001/__typeowl' },
    { name: 'auth', source: 'http://localhost:3002/__typeowl' },
    { name: 'payments', source: 'http://localhost:3003/__typeowl' },
  ],
});
```

This creates separate directories:

```
.typeowl/
├── api/          # Types from api backend
│   ├── index.d.ts
│   ├── users.d.ts
│   └── ...
├── auth/         # Types from auth backend
│   ├── index.d.ts
│   └── ...
└── payments/     # Types from payments backend
    ├── index.d.ts
    └── ...
```

Import with namespace:

```typescript
import type { User } from '@typeowl/api';
import type { Session } from '@typeowl/auth';
import type { Invoice } from '@typeowl/payments';
```

## Watch Mode

For continuous sync during development:

```bash
npm run dev:watch
```

This runs type sync in watch mode (polls every 5 seconds) alongside Vite.
When you change types in the backend, they'll automatically update!

## Environment Variables

You can use environment variables for different environments:

```typescript
// typeowl.config.ts
export default defineConfig({
  resolvers: [
    {
      name: 'api',
      source: process.env.TYPEOWL_API_URL || 'http://localhost:3001/__typeowl',
    },
  ],
});
```
