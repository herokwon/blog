import { describe, expect, it, vi } from 'vitest';

import type { GetPostByIdApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';

import type { PageServerLoadEvent } from './$types';
import { load } from './+page.server';

vi.mock('@sveltejs/kit', () => ({
  error: (status: number, message: string): never => {
    throw new Error(`${status}:${message}`);
  },
}));

const mockPost: Post = {
  id: '123e4567-e89b-12d3-a456-426614174221',
  title: 'Post detail',
  content: 'content',
  createdAt: '2026-03-03T00:00:00.000Z',
  updatedAt: '2026-03-04T00:00:00.000Z',
};

function createMockFetch(response: GetPostByIdApiResponse, status = 200) {
  return vi.fn<PageServerLoadEvent['fetch']>(
    async () =>
      new Response(JSON.stringify(response), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

function createLoadEvent(
  fetch: PageServerLoadEvent['fetch'],
  id: string,
): PageServerLoadEvent {
  return {
    cookies: {} as PageServerLoadEvent['cookies'],
    fetch,
    getClientAddress: () => '127.0.0.1',
    locals: {} as PageServerLoadEvent['locals'],
    params: { id },
    platform: undefined,
    request: new Request(`http://localhost/admin/posts/${id}/edit`),
    route: { id: '/admin/posts/[id]/edit' },
    setHeaders: vi.fn(),
    url: new URL(`http://localhost/admin/posts/${id}/edit`),
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

async function runLoad(fetch: PageServerLoadEvent['fetch'], id: string) {
  const result = await load(createLoadEvent(fetch, id));
  if (!result) throw new Error('Expected load to return data');
  return result;
}

describe('[Routes] /admin/posts/[id]/edit - load', () => {
  it('should fetch post by id and return post data', async () => {
    const mockFetch = createMockFetch({
      success: true,
      data: mockPost,
      error: null,
    });

    const result = await runLoad(mockFetch, mockPost.id);

    expect(mockFetch).toHaveBeenCalledWith(`/api/posts/${mockPost.id}`);
    expect(result.post).toEqual(mockPost);
  });

  it('should throw 404 when api response is not found', async () => {
    const mockFetch = createMockFetch(
      {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'missing', details: null },
      },
      404,
    );

    await expect(runLoad(mockFetch, mockPost.id)).rejects.toThrow(
      '404:Post not found',
    );
  });

  it('should throw 500 when api response fails with non-404 status', async () => {
    const mockFetch = createMockFetch(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Server exploded',
          details: null,
        },
      },
      500,
    );

    await expect(runLoad(mockFetch, mockPost.id)).rejects.toThrow(
      '500:Server exploded',
    );
  });
});
