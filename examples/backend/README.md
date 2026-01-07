<p align="center">
  <img src="../frontend/public/typeOwl.logo.png" alt="TypeOwl Logo" width="120" />
</p>

# TypeOwl Example Backend

A Fastify API server that exposes types via TypeOwl.

## Setup

```bash
npm install
npm run dev
```

The server starts on `http://localhost:3001`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create a new user |
| DELETE | `/api/users/:id` | Delete a user |
| GET | `/api/posts` | List all posts |
| GET | `/api/posts/:id` | Get post by ID |
| POST | `/api/posts` | Create a new post |

## TypeOwl Endpoints

| Path | Description |
|------|-------------|
| `/__typeowl` | JSON manifest (metadata + file pointers) |
| `/__typeowl/types/users.d.ts` | User domain types |
| `/__typeowl/types/posts.d.ts` | Post domain types |
| `/__typeowl/types/common.d.ts` | Shared types (ApiError, etc.) |
| `/__typeowl/types/index.d.ts` | All types + ApiEndpoints |

## How It Works

```typescript
import { createTypeOwl } from 'typeowl/server';
import { z } from 'zod';

const typeowl = createTypeOwl({ version: '1.0.0' });

// Register types by domain
typeowl
  .domain('users')
  .registerZod('User', UserSchema)
  .registerZod('CreateUserInput', CreateUserSchema);

// Register endpoints
typeowl
  .domain('main')
  .get('/api/users', 'User[]')
  .post('/api/users', 'User', { body: 'CreateUserInput' });

// Handle TypeOwl requests in your server
app.get('/__typeowl/*', (req, reply) => {
  const response = typeowl.handleRequest(req.url);
  if (response) {
    return reply.type(response.contentType).send(response.body);
  }
});
```

