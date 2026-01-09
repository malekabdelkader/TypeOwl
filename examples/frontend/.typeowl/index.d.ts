/**
 * 🦉 TypeOwl API Endpoints
 * Version: 1.0.0
 * DO NOT EDIT - This file is auto-generated
 */

// Import all domain types
import type { Blog, Author, Developer, DeveloperRole, customeType, BlogInput, Product, NoUsageType } from './content';
import type { GetApiBlogsResponse, GetApiBlogsByIdParams, GetApiBlogsByIdResponse, PostApiBlogsBody, PostApiBlogsResponse, GetApiProductsQuery, GetApiProductsResponse, GetApiProductsByIdParams, GetApiProductsByIdResponse, GetApiUsersResponse, GetApiUsersByIdParams, GetApiUsersByIdResponse, PostApiUsersBody, PostApiUsersResponse, DeleteApiUsersByIdParams, DeleteApiUsersByIdResponse } from './endpoints';

// Re-export all types
export type { Blog, Author, Developer, DeveloperRole, customeType, BlogInput, Product, NoUsageType } from './content';
export type { GetApiBlogsResponse, GetApiBlogsByIdParams, GetApiBlogsByIdResponse, PostApiBlogsBody, PostApiBlogsResponse, GetApiProductsQuery, GetApiProductsResponse, GetApiProductsByIdParams, GetApiProductsByIdResponse, GetApiUsersResponse, GetApiUsersByIdParams, GetApiUsersByIdResponse, PostApiUsersBody, PostApiUsersResponse, DeleteApiUsersByIdParams, DeleteApiUsersByIdResponse } from './endpoints';

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiEndpoints {
  'GET /api/blogs': { response: GetApiBlogsResponse };
  'GET /api/blogs/:id': { params: GetApiBlogsByIdParams; response: GetApiBlogsByIdResponse };
  'POST /api/blogs': { body: PostApiBlogsBody; response: PostApiBlogsResponse };
  'GET /api/products': { query: GetApiProductsQuery; response: GetApiProductsResponse };
  'GET /api/products/:id': { params: GetApiProductsByIdParams; response: GetApiProductsByIdResponse };
  'GET /api/users': { response: GetApiUsersResponse };
  'GET /api/users/:id': { params: GetApiUsersByIdParams; response: GetApiUsersByIdResponse };
  'POST /api/users': { body: PostApiUsersBody; response: PostApiUsersResponse };
  'DELETE /api/users/:id': { params: DeleteApiUsersByIdParams; response: DeleteApiUsersByIdResponse };
}

export type ApiEndpoint = keyof ApiEndpoints;
