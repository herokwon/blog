import type { RequestEvent, ServerLoadEvent } from '@sveltejs/kit';

import { vi } from 'vitest';

import { EXPIRES_IN_SECONDS } from '$lib/constants';
import type { DBUser, UserSession } from '$lib/types/auth';
import type { DBPost, Post } from '$lib/types/post';

type MockEventOptions = Partial<Pick<RequestEvent, 'params'>> & {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: HeadersInit;
  pathname?: string;
  body?: unknown;
  db?: D1Database;
};

type MockLoadEventOptions<T extends ServerLoadEvent> = Partial<T> &
  Partial<{
    id: string;
    requestUrl: string;
  }>;

/**
 * Stubs the global fetch function to return a specified response or error.
 * @param response - The response to return when the fetch function is called. Should be an object that will be JSON-stringified.
 * @param options - Optional settings for the mock response, including status code, headers, and whether the fetch should be pending (never resolve).
 * @param error - An optional error to reject the fetch promise with. If set to true, it will reject with a generic Error. If set to an object, it will reject with that object.
 * If error is provided, it takes precedence over the response and options parameters.
 * @example
 * // Mock a successful fetch response
 * stubGlobalFetch({ success: true, data: { id: 1 } });
 *
 * // Mock a fetch that returns a 404 error
 * stubGlobalFetch({ success: false, error: { message: 'Not found' } }, { status: 404 });
 */
export const stubGlobalFetch = <T extends Record<string, unknown>>({
  response,
  options = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    pending: false,
  },
  error,
}: {
  response?: T;
  options?: Partial<{ status: number; headers: HeadersInit; pending: boolean }>;
  error?: unknown;
} = {}) => {
  // custom rejection takes precedence
  if (error !== undefined) {
    const rejectValue =
      typeof error === 'boolean' ? new Error('Fetch error') : error;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(rejectValue));
    return;
  }

  // pending (never-resolving) fetch
  if (options?.pending) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
    return;
  }

  // resolved Response
  const { status = 200, headers = { 'Content-Type': 'application/json' } } =
    options;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status, headers }),
      ),
  );
};

/**
 * Creates a mock user session for testing purposes.
 * Allows overriding default properties with custom values.
 * @param overrides - Partial properties to override the default session values.
 * @returns A mock UserSession object with the specified overrides.
 */
export const createMockUserSession = (
  overrides: Partial<UserSession> = {},
): UserSession => ({
  sessionId: 'session-abc',
  expiresAt: Date.now() + EXPIRES_IN_SECONDS,
  userId: 'user-123',
  username: 'testuser',
  role: 'user',
  ...overrides,
});

/**
 * Creates a mock user for testing purposes.
 * Allows overriding default properties with custom values.
 * @param overrides - Partial properties to override the default user values.
 * @returns A mock DBUser object with the specified overrides.
 */
export const createMockUser = (overrides: Partial<DBUser> = {}): DBUser => ({
  id: 'user-123',
  username: 'testuser',
  role: 'user',
  password_hash: 'hashedpassword',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Creates a mock post for testing purposes.
 * Allows overriding default properties with custom values.
 * @param overrides - Partial properties to override the default post values.
 * @returns A mock Post object with the specified overrides.
 */
export const createMockPost = (overrides: Partial<Post> = {}): Post => ({
  id: '4e9344a8-b642-47fb-8e8b-b0f1343f77df',
  title: 'title',
  content: 'content',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Creates a mock database post for testing purposes.
 * Uses snake_case property names matching the database schema.
 * @param overrides - Partial properties to override the default DB post values.
 * @returns A mock DBPost object with the specified overrides.
 */
export const createMockDBPost = (overrides: Partial<DBPost> = {}): DBPost => ({
  id: '4e9344a8-b642-47fb-8e8b-b0f1343f77df',
  title: 'title',
  content: 'content',
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Creates a mock fetch function for testing purposes.
 * @param response - The response to return when the fetch is called.
 * @param options - The options for the mock response.
 * @returns A mock fetch function.
 */
export const createMockFetch = <T extends ServerLoadEvent, R>(
  response: R,
  options: { status?: number; headers?: HeadersInit } = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  },
): T['fetch'] => {
  return vi.fn<T['fetch']>(
    async () => new Response(JSON.stringify(response), options),
  );
};

/**
 * Creates a mock D1 database for testing purposes.
 * Provides mock implementations for common D1 methods like prepare, bind, first, run, and all.
 * @returns An object containing the mock D1 database and spies for its methods.
 */
export const createMockD1 = (): {
  db: D1Database;
  spies: {
    prepare: ReturnType<typeof vi.fn>;
    bind: ReturnType<typeof vi.fn>;
    first: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
  };
} => {
  const prepare = vi.fn().mockReturnThis();
  const bind = vi.fn().mockReturnThis();
  const first = vi.fn();
  const run = vi.fn();
  const all = vi.fn();

  const db = {
    prepare,
    bind,
    first,
    run,
    all,
  } as unknown as D1Database;

  return {
    db,
    spies: { prepare, bind, all, first, run },
  };
};

/**
 * Creates a mock RequestEvent for testing purposes.
 * Allows overriding default properties with custom values.
 * @param options - The options to customize the mock RequestEvent, including method, headers, params, pathname, body, and a mock D1 database.
 * @returns An object containing the mock RequestEvent and spies for its cookies.
 */
export const createMockRequestEvent = ({
  method = 'GET',
  headers = { 'Content-Type': 'application/json' },
  params = {},
  pathname = '',
  body,
  db,
}: MockEventOptions = {}): {
  event: RequestEvent;
  spies: {
    cookies: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
} => {
  const cookies = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  const locals = {
    user: null,
    session: null,
  };

  const url = new URL('http://localhost' + pathname);
  const request = new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });

  const event = {
    request,
    params,
    cookies,
    locals,
    url,
    platform: {
      env: { BLOG_DB: db },
    },
  } as unknown as RequestEvent;

  return {
    event,
    spies: {
      cookies,
    },
  };
};

/**
 * Creates a mock PageServerLoadEvent for testing purposes.
 * Allows overriding default properties with custom values.
 * @param options - The options to customize the mock PageServerLoadEvent, including id, url, route, params, requestUrl, and a custom fetch function.
 * @returns A mock PageServerLoadEvent object with the specified overrides and default implementations for required properties and methods.
 */
export const createMockLoadEvent = <T extends ServerLoadEvent>({
  id,
  url,
  route,
  params,
  requestUrl,
  fetch = vi.fn(),
  ...rest
}: MockLoadEventOptions<T> = {}): T => {
  const resolvedRouteId = route?.id ?? (id ? '/posts/[id]' : '/posts');
  const resolvedUrl =
    url?.toString() ??
    `http://localhost${id ? resolvedRouteId.replace('[id]', id) : ''}`;
  const resolvedRequestUrl = requestUrl ?? resolvedUrl;
  const resolvedParams = params ?? (id ? { id } : {});

  return {
    // basic properties
    cookies: {} as T['cookies'],
    locals: {} as T['locals'],
    platform: undefined,
    isDataRequest: false,
    isSubRequest: false,
    isRemoteRequest: false,
    getClientAddress: () => '127.0.0.1',

    // mockable functions
    parent: vi.fn().mockResolvedValue({}),
    depends: vi.fn(),
    setHeaders: vi.fn(),
    untrack: vi.fn(<T>(fn: () => T) => fn()),

    // tracing properties
    tracing: {
      enabled: false,
      root: {} as T['tracing']['root'],
      current: {} as T['tracing']['current'],
    },

    // dynamic properties
    fetch,
    params: resolvedParams as T['params'],
    request: new Request(resolvedRequestUrl),
    route: { id: resolvedRouteId },
    url: new URL(resolvedUrl),

    // allow overrides
    ...rest,
  } as unknown as T;
};
