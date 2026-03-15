import { vi } from 'vitest';

import type { Post } from '$lib/types/post';

import type { RequestEvent } from './$types';

type MockEventOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url?: string;
  params?: Record<string, string>;
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

export const createMockPost = (overrides: Partial<Post> = {}): Post => ({
  ...MOCK_POST,
  ...overrides,
});

export const createMockD1 = () => {
  const prepare = vi.fn().mockReturnThis();
  const bind = vi.fn().mockReturnThis();
  const all = vi.fn();
  const run = vi.fn();

  const db = {
    prepare,
    bind,
    all,
    run,
  } as unknown as D1Database;

  return {
    db,
    spies: { prepare, bind, all, run },
  };
};

export const createMockRequestEvent = ({
  method = 'GET',
  url = '/api/posts',
  params = {},
  body,
  db,
}: MockEventOptions = {}): RequestEvent => {
  const request = new Request('http://localhost' + url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
  });

  return {
    request,
    params,
    platform: {
      env: { BLOG_DB: db },
    },
  } as unknown as RequestEvent;
};
