/**
 * 🦉 TypeOwl API Endpoints
 * Version: 1.0.0
 * DO NOT EDIT - This file is auto-generated
 */

// Import all domain types
import type { Blog, Author, Developer, DeveloperRole, customeType, BlogInput, Product, CreateUserInput, User, IdParams, ProductQuery, DeleteResponse } from './content';

// Re-export all types
export type { Blog, Author, Developer, DeveloperRole, customeType, BlogInput, Product, CreateUserInput, User, IdParams, ProductQuery, DeleteResponse } from './content';

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiEndpoints {
  'GET /api/blogs': { response: Blog[] };
  'GET /api/blogs/:id': { params: IdParams; response: Blog | null };
  'POST /api/blogs': { body: BlogInput; response: Blog };
  'GET /api/products': { query: ProductQuery; response: Product[] };
  'GET /api/products/:id': { params: IdParams; response: Product | null };
  'GET /api/users': { response: User[] };
  'GET /api/users/:id': { params: IdParams; response: User | null };
  'POST /api/users': { body: CreateUserInput; response: User };
  'DELETE /api/users/:id': { params: IdParams; response: DeleteResponse };
}

export type ApiEndpoint = keyof ApiEndpoints;
