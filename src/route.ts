/**
 * 🦉 TypeOwl Route Builder
 * 
 * Framework-agnostic route definition with pure TypeScript types.
 * Define routes once with type generics, wire up with your server framework.
 * TypeOwl extracts types at build time using TypeChecker.
 * 
 * @example
 * interface User { id: string; name: string; }
 * interface IdParams { id: string; }
 * 
 * const getUserById = route
 *   .get('/api/users/:id')
 *   .params<IdParams>()
 *   .returns<User | null>();
 * 
 * // Use with Fastify, Express, Hono, etc.
 * app.get(getUserById.path, async (request) => {
 *   const params = request.params as IdParams;
 *   return user;
 * });
 */

// ═══════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Finalized route definition with type information
 */
export interface RouteDefinition<
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
  TParams = never,
  TBody = never,
  TQuery = never,
  TResponse = unknown
> {
  /** HTTP method */
  readonly method: TMethod;
  /** URL path pattern */
  readonly path: TPath;
  
  /** Direct type access for validation (e.g., typia.assert<route.bodyType>()) */
  readonly paramsType: TParams;
  readonly bodyType: TBody;
  readonly queryType: TQuery;
  readonly responseType: TResponse;
  
  /** Type markers for TypeChecker extraction (internal) */
  readonly _types: {
    params: TParams;
    body: TBody;
    query: TQuery;
    response: TResponse;
  };
}

/**
 * Route builder with fluent API
 */
export interface RouteBuilder<
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
  TParams = never,
  TBody = never,
  TQuery = never,
  TResponse = never
> {
  /** HTTP method */
  readonly method: TMethod;
  /** URL path pattern */
  readonly path: TPath;

  /** Define URL params type */
  params<T>(): RouteBuilder<TMethod, TPath, T, TBody, TQuery, TResponse>;
  
  /** Define request body type */
  body<T>(): RouteBuilder<TMethod, TPath, TParams, T, TQuery, TResponse>;
  
  /** Define query params type */
  query<T>(): RouteBuilder<TMethod, TPath, TParams, TBody, T, TResponse>;
  
  /** Define response type and finalize route */
  returns<T>(): RouteDefinition<TMethod, TPath, TParams, TBody, TQuery, T>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📝 ROUTE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/** Route info for registry (runtime-safe, no type info) */
export interface RegisteredRoute {
  method: HttpMethod;
  path: string;
  hasParams: boolean;
  hasBody: boolean;
  hasQuery: boolean;
  hasResponse: boolean;
}

/** All registered routes for TypeOwl to collect */
const routeRegistry: RegisteredRoute[] = [];

/** Get all registered routes */
export function getRegisteredRoutes(): RegisteredRoute[] {
  return [...routeRegistry];
}

/** Clear registry (for testing) */
export function clearRouteRegistry(): void {
  routeRegistry.length = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

interface BuilderState {
  method: HttpMethod;
  path: string;
  hasParams: boolean;
  hasBody: boolean;
  hasQuery: boolean;
}

/**
 * Create a route builder for a specific HTTP method
 */
function createRouteBuilder<TMethod extends HttpMethod>(method: TMethod) {
  return function <TPath extends string>(path: TPath): RouteBuilder<TMethod, TPath> {
    const state: BuilderState = {
      method,
      path,
      hasParams: false,
      hasBody: false,
      hasQuery: false,
    };

    const builder: RouteBuilder<TMethod, TPath> = {
      method,
      path,

      params<T>() {
        state.hasParams = true;
        return this as unknown as RouteBuilder<TMethod, TPath, T, never, never, never>;
      },

      body<T>() {
        state.hasBody = true;
        return this as unknown as RouteBuilder<TMethod, TPath, never, T, never, never>;
      },

      query<T>() {
        state.hasQuery = true;
        return this as unknown as RouteBuilder<TMethod, TPath, never, never, T, never>;
      },

      returns<T>() {
        // Register route when finalized
        routeRegistry.push({
          method: state.method,
          path: state.path,
          hasParams: state.hasParams,
          hasBody: state.hasBody,
          hasQuery: state.hasQuery,
          hasResponse: true,
        });

        // Return the finalized route definition
        const definition: RouteDefinition<TMethod, TPath, never, never, never, T> = {
          method: state.method as TMethod,
          path: state.path as TPath,
          // Direct type access (phantom types - undefined at runtime, typed at compile time)
          paramsType: undefined as never,
          bodyType: undefined as never,
          queryType: undefined as never,
          responseType: undefined as unknown as T,
          _types: {
            params: undefined as never,
            body: undefined as never,
            query: undefined as never,
            response: undefined as unknown as T,
          },
        };

        return definition;
      },
    };

    return builder;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Framework-agnostic route builder with pure TypeScript types.
 * TypeOwl extracts types at build time - no runtime schema needed!
 * 
 * @example
 * import { route } from 'typeowl/server';
 * 
 * interface User { id: string; name: string; role: 'admin' | 'user'; }
 * interface IdParams { id: string; }
 * 
 * const getUserById = route
 *   .get('/api/users/:id')
 *   .params<IdParams>()
 *   .returns<User | null>();
 * 
 * // Wire up with your framework
 * app.get(getUserById.path, async (request) => {
 *   const { id } = request.params as IdParams;
 *   return user;
 * });
 */
export const route = {
  get: createRouteBuilder('GET'),
  post: createRouteBuilder('POST'),
  put: createRouteBuilder('PUT'),
  patch: createRouteBuilder('PATCH'),
  del: createRouteBuilder('DELETE'),
} as const;

export default route;
