import type { RequestEvent } from '@sveltejs/kit';

import { vi } from 'vitest';

import { EXPIRES_IN_SECONDS } from '$lib/constants';
import type { DBUser, UserSession } from '$lib/types/auth';
import type { Post } from '$lib/types/post';

type MockEventOptions = Partial<Pick<RequestEvent, 'params'>> & {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: HeadersInit;
  pathname?: string;
  body?: unknown;
  db?: D1Database;
};

export const createMockUserSession = (
  overrides: Partial<UserSession> = {},
): UserSession => {
  return {
    sessionId: 'session-abc',
    expiresAt: Date.now() + EXPIRES_IN_SECONDS,
    userId: 'user-123',
    username: 'testuser',
    role: 'user',
    ...overrides,
  };
};

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
