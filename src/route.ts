/**
 * 🦉 TypeOwl Route Builder (Zod-based)
 * 
 * Framework-agnostic route definition with Zod validation.
 * Define routes once, wire up with your server framework.
 * 
 * @example
 * const createBlog = route.post('/api/blogs')
 *   .withBody(BlogInputSchema)
 *   .returns(BlogSchema);
 * 
 * // Use with Fastify, Express, Hono, etc.
 * app.post(createBlog.path, async (request) => {
 *   const input = createBlog.body(request.body);  // Validates!
 *   return createBlog.response(newBlog);
 * });
 */

import type { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Route definition with Zod schemas for validation.
 */
export interface RouteDefinition<
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
  TParams extends z.ZodType | undefined = undefined,
  TBody extends z.ZodType | undefined = undefined,
  TQuery extends z.ZodType | undefined = undefined,
  TResponse extends z.ZodType | undefined = undefined
> {
  /** HTTP method */
  readonly method: TMethod;
  /** URL path pattern */
  readonly path: TPath;
  
  /** Zod schemas (for TypeOwl to extract types) */
  readonly schemas: {
    params?: TParams;
    body?: TBody;
    query?: TQuery;
    response?: TResponse;
  };
  
  /**
   * Parse and validate URL params.
   * @throws ZodError if validation fails
   */
  params: TParams extends z.ZodType 
    ? (data: unknown) => z.infer<TParams>
    : (data: unknown) => Record<string, string>;
  
  /**
   * Parse and validate request body.
   * @throws ZodError if validation fails
   */
  body: TBody extends z.ZodType
    ? (data: unknown) => z.infer<TBody>
    : (data: unknown) => unknown;
  
  /**
   * Parse and validate query params.
   * @throws ZodError if validation fails
   */
  query: TQuery extends z.ZodType
    ? (data: unknown) => z.infer<TQuery>
    : (data: unknown) => Record<string, string>;
  
  /**
   * Type-check response (validates in dev mode).
   */
  response: TResponse extends z.ZodType
    ? (data: z.infer<TResponse>) => z.infer<TResponse>
    : <T>(data: T) => T;
}

/**
 * Fluent builder for route definitions.
 */
export interface RouteBuilder<
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
  TParams extends z.ZodType | undefined = undefined,
  TBody extends z.ZodType | undefined = undefined,
  TQuery extends z.ZodType | undefined = undefined,
  TResponse extends z.ZodType | undefined = undefined
> extends RouteDefinition<TMethod, TPath, TParams, TBody, TQuery, TResponse> {
  /** Define URL params schema */
  withParams<T extends z.ZodType>(schema: T): RouteBuilder<TMethod, TPath, T, TBody, TQuery, TResponse>;
  
  /** Define request body schema */
  withBody<T extends z.ZodType>(schema: T): RouteBuilder<TMethod, TPath, TParams, T, TQuery, TResponse>;
  
  /** Define query params schema */
  withQuery<T extends z.ZodType>(schema: T): RouteBuilder<TMethod, TPath, TParams, TBody, T, TResponse>;
  
  /** Define response schema */
  returns<T extends z.ZodType>(schema: T): RouteBuilder<TMethod, TPath, TParams, TBody, TQuery, T>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📝 ROUTE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/** All registered routes for TypeOwl to collect */
const routeRegistry: RouteDefinition[] = [];

/** Get all registered routes */
export function getRegisteredRoutes(): RouteDefinition[] {
  return [...routeRegistry];
}

/** Clear registry (for testing) */
export function clearRouteRegistry(): void {
  routeRegistry.length = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a route builder for a specific HTTP method.
 */
function createRouteBuilder<TMethod extends HttpMethod>(method: TMethod) {
  return function <TPath extends string>(path: TPath): RouteBuilder<TMethod, TPath> {
    // Store schemas
    let paramsSchema: z.ZodType | undefined;
    let bodySchema: z.ZodType | undefined;
    let querySchema: z.ZodType | undefined;
    let responseSchema: z.ZodType | undefined;
    
    // Create parser function
    const createParser = (getSchema: () => z.ZodType | undefined, fallback: unknown) => {
      return (data: unknown) => {
        const schema = getSchema();
        if (schema) {
          return schema.parse(data);  // Throws ZodError if invalid
        }
        return fallback ?? data;
      };
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      method,
      path,
      
      get schemas() {
        return {
          params: paramsSchema,
          body: bodySchema,
          query: querySchema,
          response: responseSchema,
        };
      },
      
      // Parser functions - validate with Zod
      params: createParser(() => paramsSchema, {}),
      body: createParser(() => bodySchema, undefined),
      query: createParser(() => querySchema, {}),
      response(data: unknown) {
        // In dev mode, validate response too
        if (responseSchema && process.env.NODE_ENV !== 'production') {
          return responseSchema.parse(data);
        }
        return data;
      },
      
      // Builder methods (with- prefix to avoid name collision)
      withParams<T extends z.ZodType>(schema: T) {
        paramsSchema = schema;
        return this;
      },
      withBody<T extends z.ZodType>(schema: T) {
        bodySchema = schema;
        return this;
      },
      withQuery<T extends z.ZodType>(schema: T) {
        querySchema = schema;
        return this;
      },
      returns<T extends z.ZodType>(schema: T) {
        responseSchema = schema;
        // Register route when .returns() is called (route is complete)
        routeRegistry.push(this);
        return this;
      },
    };
    
    return builder;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Framework-agnostic route builder with Zod validation.
 * 
 * @example
 * import { route } from 'typeowl/server';
 * import { z } from 'zod';
 * 
 * const BlogSchema = z.object({ id: z.string(), title: z.string() });
 * 
 * const getBlogs = route.get('/api/blogs').returns(z.array(BlogSchema));
 * 
 * // Wire up with your framework
 * app.get(getBlogs.path, async () => getBlogs.response(blogs));
 */
export const route = {
  get: createRouteBuilder('GET'),
  post: createRouteBuilder('POST'),
  put: createRouteBuilder('PUT'),
  patch: createRouteBuilder('PATCH'),
  del: createRouteBuilder('DELETE'),
} as const;

export default route;
