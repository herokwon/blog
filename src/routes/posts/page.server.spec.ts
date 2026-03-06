import { describe, expect, it, vi } from 'vitest';

import type { ApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';

import type { PageServerLoadEvent } from './$types';
import { load } from './+page.server';

const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174210',
  title: 'Hello World',
  content: 'Some content',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-02-20T00:00:00.000Z',
};

function createMockFetch(response: ApiResponse<Post[]>) {
  return vi.fn<PageServerLoadEvent['fetch']>(
    async () =>
      new Response(JSON.stringify(response), {
        headers: { 'content-type': 'application/json' },
      }),
  );
}

function createLoadEvent(
  fetch: PageServerLoadEvent['fetch'],
): PageServerLoadEvent {
  return {
    cookies: {} as PageServerLoadEvent['cookies'],
    fetch,
    getClientAddress: () => '127.0.0.1',
    locals: {} as PageServerLoadEvent['locals'],
    params: {} as PageServerLoadEvent['params'],
    platform: undefined,
    request: new Request('http://localhost/posts'),
    route: { id: '/posts' },
    setHeaders: vi.fn(),
    url: new URL('http://localhost/posts'),
    isDataRequest: false,
    isSubRequest: false,
    isRemoteRequest: false,
    parent: async () => ({}),
    depends: vi.fn(),
    untrack: <T>(fn: () => T) => fn(),
    tracing: {
      enabled: false,
      root: {} as PageServerLoadEvent['tracing']['root'],
      current: {} as PageServerLoadEvent['tracing']['current'],
    },
  };
}

async function runLoad(fetch: PageServerLoadEvent['fetch']) {
  const result = await load(createLoadEvent(fetch));
  if (!result) throw new Error('Expected load to return data');
  return result;
}

describe('[Routes] /posts - load', () => {
  it('should fetch from /api/posts', async () => {
    const mockFetch = createMockFetch({
      success: true,
      data: [mockPost],
      error: null,
    });

    await runLoad(mockFetch);

    expect(mockFetch).toHaveBeenCalledWith('/api/posts');
  });

  it('should return posts on success response', async () => {
    const mockFetch = createMockFetch({
      success: true,
      data: [mockPost],
      error: null,
    });

    const result = await runLoad(mockFetch);

    expect(result.posts).toEqual([mockPost]);
    expect(result.loadError).toBeUndefined();
  });

  it('should return empty posts and loadError on failure response', async () => {
    const mockFetch = createMockFetch({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load posts',
      },
    } as ApiResponse<Post[]>);

    const result = await runLoad(mockFetch);

    expect(result.posts).toEqual([]);
    expect(result.loadError).toBe('Failed to load posts');
  });
});
