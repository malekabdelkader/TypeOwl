/**
 * 🎯 TYPE-SAFE API CLIENT
 * 
 * Three ways to fetch data:
 * 🔴 rawFetch   - No TypeOwl, manual type
 * 🟡 typedFetch - Force-cast with exposed static types
 * 🟢 api.*      - Full type safety via typeowl.endpoint()
 */

import type { ApiEndpoints } from '@typeowl';
import type { ApiError } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

type ExtractPaths<Method extends string> = {
  [K in keyof ApiEndpoints]: K extends `${Method} ${infer Path}` ? Path : never;
}[keyof ApiEndpoints];

type GetPath = ExtractPaths<'GET'>;
type PostPath = ExtractPaths<'POST'>;
type PutPath = ExtractPaths<'PUT'>;
type PatchPath = ExtractPaths<'PATCH'>;
type DeletePath = ExtractPaths<'DELETE'>;

type EndpointConfig<Method extends string, Path extends string> = 
  `${Method} ${Path}` extends keyof ApiEndpoints 
    ? ApiEndpoints[`${Method} ${Path}`] 
    : never;

type RequestOptions<Config> = Config extends { body: infer B } 
  ? { body: B } 
  : object;

// ═══════════════════════════════════════════════════════════════════════════
// CORE REQUEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function request<Config extends { response: unknown }>(
  method: string,
  path: string,
  options?: { body?: unknown }
): Promise<Config['response']> {
  const response = await fetch(path, {
    method,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// 🟢 AXIOS-LIKE API CLIENT (for typeowl.endpoint() routes)
// ═══════════════════════════════════════════════════════════════════════════

export const api = {
  get: <P extends GetPath>(path: P) => 
    request<EndpointConfig<'GET', P>>('GET', path),

  post: <P extends PostPath>(path: P, options: RequestOptions<EndpointConfig<'POST', P>>) => 
    request<EndpointConfig<'POST', P>>('POST', path, options as { body?: unknown }),

  put: <P extends PutPath>(path: P, options: RequestOptions<EndpointConfig<'PUT', P>>) => 
    request<EndpointConfig<'PUT', P>>('PUT', path, options as { body?: unknown }),

  patch: <P extends PatchPath>(path: P, options: RequestOptions<EndpointConfig<'PATCH', P>>) => 
    request<EndpointConfig<'PATCH', P>>('PATCH', path, options as { body?: unknown }),

  delete: <P extends DeletePath>(path: P) => 
    request<EndpointConfig<'DELETE', P>>('DELETE', path),
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 RAW FETCH (No TypeOwl - manual type)
// ═══════════════════════════════════════════════════════════════════════════

export async function rawFetch<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// 🟡 TYPED FETCH (Force-cast with exposed static types)
// ═══════════════════════════════════════════════════════════════════════════

export async function typedFetch<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Request failed');
  return response.json() as Promise<T>;
}

