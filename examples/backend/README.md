<p align="center">
  <img src="../frontend/public/typeOwl.logo.png" alt="TypeOwl Logo" width="120" />
</p>

# TypeOwl Example Backend

A Fastify API server demonstrating TypeOwl's **pure TypeScript** approach for type sharing.

## Setup

```bash
npm install
npm run dev
```

The server starts on `http://localhost:3001`.

## How Types Are Defined

TypeOwl uses **pure TypeScript types** — no special schemas required:

```typescript
import { route } from 'typeowl/server';

// Define types with regular TypeScript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
}

interface IdParams {
  id: string;
}

// Define routes with type parameters
const getUsers = route.get('/api/users').returns<User[]>();
const getUserById = route.get('/api/users/:id').params<IdParams>().returns<User | null>();
const createUser = route.post('/api/users').body<CreateUserInput>().returns<User>();

// Wire up with your framework
app.get(getUsers.path, async () => users);
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/blogs` | List all blogs |
| GET | `/api/blogs/:id` | Get blog by ID |
| POST | `/api/blogs` | Create a blog |
| GET | `/api/products` | List/search products |
| GET | `/api/products/:id` | Get product by ID |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create a user |
| DELETE | `/api/users/:id` | Delete a user |

## TypeOwl Endpoints

| Path | Description |
|------|-------------|
| `/__typeowl` | JSON manifest (metadata + file pointers) |
| `/__typeowl/types/content.d.ts` | Extracted types (User, Blog, Product, etc.) |

## Configuration

```typescript
// typeowl.server.config.ts
export default defineServerConfig({
  version: '1.0.0',
  typeSources: './src/types/',      // Type files to extract
  routes: './src/server.ts',        // Route files to scan
  // onConflict: 'rename',          // Auto-rename duplicates: User -> User1
});
```

## Works With

- Fastify
- Express
- Hono
- Next.js API Routes
- Koa
