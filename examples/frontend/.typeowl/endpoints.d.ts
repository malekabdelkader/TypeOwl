/**
 * 🦉 TypeOwl Generated Types
 * Domain: endpoints
 * Version: 1.0.0
 * Generated: 2026-01-09T17:21:02.401Z
 * DO NOT EDIT - This file is auto-generated
 */

export type GetApiBlogsResponse = { id: string; title: string; content: string; published: boolean; createdAt: string }[];

export interface GetApiBlogsByIdParams {
  id: string;
}

export type GetApiBlogsByIdResponse = { id: string; title: string; content: string; published: boolean; createdAt: string } | null;

export interface PostApiBlogsBody {
  title: string;
  content: string;
}

export interface PostApiBlogsResponse {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
}

export interface GetApiProductsQuery {
  search?: string | undefined;
  limit?: number | undefined;
}

export type GetApiProductsResponse = ({ id: string; name: string; price: number; description?: string | undefined; inStock: boolean })[];

export interface GetApiProductsByIdParams {
  id: string;
}

export type GetApiProductsByIdResponse = { id: string; name: string; price: number; description?: string | undefined; inStock: boolean } | null;

export type GetApiUsersResponse = ({ id: string; email: string; name: string; role: 'admin' | 'user' | 'guest' })[];

export interface GetApiUsersByIdParams {
  id: string;
}

export type GetApiUsersByIdResponse = { id: string; email: string; name: string; role: 'admin' | 'user' | 'guest' } | null;

export interface PostApiUsersBody {
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface PostApiUsersResponse {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
}

export interface DeleteApiUsersByIdParams {
  id: string;
}

export interface DeleteApiUsersByIdResponse {
  success: boolean;
  message: string;
}
