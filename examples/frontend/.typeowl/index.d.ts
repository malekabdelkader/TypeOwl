/**
 * 🦉 TypeOwl API Endpoints
 * Version: 1.0.0
 * DO NOT EDIT - This file is auto-generated
 */

// Import all domain types
import type { Blog, Author, Developer, DeveloperRole, customeType, BlogInput, Product, NoUsageType } from './content';
import type { GetApiUsersResponse, GetApiUsersByIdParams, GetApiUsersByIdResponse, PostApiUsersBody, PostApiUsersResponse, DeleteApiUsersByIdParams, DeleteApiUsersByIdResponse, GetApiProductsByIdParams } from './endpoints';

// Re-export all types
export type { Blog, Author, Developer, DeveloperRole, customeType, BlogInput, Product, NoUsageType } from './content';
export type { GetApiUsersResponse, GetApiUsersByIdParams, GetApiUsersByIdResponse, PostApiUsersBody, PostApiUsersResponse, DeleteApiUsersByIdParams, DeleteApiUsersByIdResponse, GetApiProductsByIdParams } from './endpoints';

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiEndpoints {
  'GET /api/users': { response: GetApiUsersResponse };
  'GET /api/users/:id': { params: GetApiUsersByIdParams; response: GetApiUsersByIdResponse };
  'POST /api/users': { body: PostApiUsersBody; response: PostApiUsersResponse };
  'DELETE /api/users/:id': { params: DeleteApiUsersByIdParams; response: DeleteApiUsersByIdResponse };
  'POST /api/blogs': { body: BlogInput; response: Blog };
  'GET /api/products': { response: Product[] };
  'GET /api/products/:id': { params: GetApiProductsByIdParams; response: Product | null };
}

export type ApiEndpoint = keyof ApiEndpoints;
