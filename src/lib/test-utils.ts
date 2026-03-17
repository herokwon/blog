import type { RequestEvent } from '@sveltejs/kit';

import { vi } from 'vitest';

import { EXPIRES_IN_SECONDS } from '$lib/constants';
import type { DBUser, UserSession } from '$lib/types/auth';
import type { Post } from '$lib/types/post';

import type { PageServerLoadEvent as AdminPostsPageServerLoadEvent } from '../routes/admin/posts/$types';
import type { PageServerLoadEvent as AdminPostEditPageServerLoadEvent } from '../routes/admin/posts/[id]/edit/$types';
import type { PageServerLoadEvent as PostsPageServerLoadEvent } from '../routes/posts/$types';
import type { PageServerLoadEvent as PostPageServerLoadEvent } from '../routes/posts/[id]/$types';

type PageServerLoadEvent =
  | PostsPageServerLoadEvent
  | PostPageServerLoadEvent
  | AdminPostsPageServerLoadEvent
  | AdminPostEditPageServerLoadEvent;

type MockEventOptions = Partial<Pick<RequestEvent, 'params'>> & {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: HeadersInit;
  pathname?: string;
  body?: unknown;
  db?: D1Database;
};

type MockLoadEventOptions<T extends PageServerLoadEvent> = Partial<T> & {
  id?: string;
  requestUrl?: string;
};

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

export const createMockUser = (overrides: Partial<DBUser> = {}): DBUser => ({
  id: 'user-123',
  username: 'testuser',
  role: 'user',
  password_hash: 'hashedpassword',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const createMockPost = (overrides: Partial<Post> = {}): Post => ({
  id: '4e9344a8-b642-47fb-8e8b-b0f1343f77df',
  title: 'title',
  content: 'content',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...overrides,
});

export const createMockFetch = <T extends PageServerLoadEvent, R>(
  response: R,
  options: { status?: number; headers?: HeadersInit } = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  },
) => {
  return vi.fn<T['fetch']>(
    async () => new Response(JSON.stringify(response), options),
  );
};

export const createMockD1 = () => {
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

export const createMockRequestEvent = ({
  method = 'GET',
  headers = { 'Content-Type': 'application/json' },
  params = {},
  pathname = '',
  body,
  db,
}: MockEventOptions = {}) => {
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

export function createMockLoadEvent<T extends PageServerLoadEvent>({
  id,
  url,
  route,
  params,
  requestUrl,
  fetch = vi.fn(),
  ...rest
}: MockLoadEventOptions<T> = {}): T {
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
}
