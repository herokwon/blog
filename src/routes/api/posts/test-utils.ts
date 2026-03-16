import type { RequestEvent } from '@sveltejs/kit';

import { vi } from 'vitest';

import { EXPIRES_IN_SECONDS } from '$lib/constants';
import type { UserSession } from '$lib/types';
import type { Post } from '$lib/types/post';

type MockEventOptions = Partial<Pick<RequestEvent, 'params'>> & {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pathname?: string;
  body?: unknown;
  db?: D1Database;
};

const MOCK_POST: Post = {
  id: '4e9344a8-b642-47fb-8e8b-b0f1343f77df',
  title: 'title',
  content: 'content',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const MOCK_USER_SESSION: UserSession = {
  sessionId: 'session-abc',
  expiresAt: Date.now() + EXPIRES_IN_SECONDS,
  userId: 'user-123',
  username: 'testuser',
  role: 'user',
};

export const createMockUserSession = (
  overrides: Partial<UserSession> = {},
): UserSession => {
  return {
    ...MOCK_USER_SESSION,
    ...overrides,
  };
};

export const createMockPost = (overrides: Partial<Post> = {}): Post => ({
  ...MOCK_POST,
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
  params = {},
  pathname = '/api/posts',
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
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
