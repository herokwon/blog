import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockFetch,
  createMockLoadEvent,
  createMockPost,
} from '$lib/test-utils';
import type { GetPostByIdApiResponse } from '$lib/types/api';

import type { PageServerLoadEvent } from './$types';
import { load } from './+page.server';

vi.mock('@sveltejs/kit', () => ({
  error: (status: number, message: string): never => {
    throw new Error(`${status}:${message}`);
  },
}));

describe('[Page Server] /posts/[id]', () => {
  let mockPost: ReturnType<typeof createMockPost>;

  beforeEach(() => {
    mockPost = createMockPost();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch post by id and return post data', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      GetPostByIdApiResponse
    >({
      success: true,
      data: mockPost,
      error: null,
    });

    const result = await runLoad(mockFetch, mockPost.id);

    expect(mockFetch).toHaveBeenCalledWith(`/api/posts/${mockPost.id}`);
    expect(result.post).toEqual(mockPost);
  });

  it('should throw 404 when api response is not found', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      GetPostByIdApiResponse
    >(
      {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'missing', details: null },
      },
      { status: 404 },
    );

    await expect(runLoad(mockFetch, mockPost.id)).rejects.toThrow(
      '404:Post not found',
    );
  });

  it('should throw 500 when api response fails with non-404 status', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      GetPostByIdApiResponse
    >(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Server exploded',
          details: null,
        },
      },
      { status: 500 },
    );

    await expect(runLoad(mockFetch, mockPost.id)).rejects.toThrow(
      '500:Server exploded',
    );
  });
});

async function runLoad(fetch: PageServerLoadEvent['fetch'], id: string) {
  const result = await load(
    createMockLoadEvent<PageServerLoadEvent>({ fetch, params: { id } }),
  );
  if (!result) throw new Error('Expected load to return data');
  return result;
}
