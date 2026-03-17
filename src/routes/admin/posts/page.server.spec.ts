import { describe, expect, it } from 'vitest';

import {
  createMockFetch,
  createMockLoadEvent,
  createMockPost,
} from '$lib/test-utils';
import type { ListPostsApiResponse } from '$lib/types/api';

import type { PageServerLoadEvent } from './$types';
import { load } from './+page.server';

const mockPost = createMockPost();

async function runLoad(fetch: PageServerLoadEvent['fetch']) {
  const result = await load(
    createMockLoadEvent<PageServerLoadEvent>({
      fetch,
    }),
  );
  if (!result) throw new Error('Expected load to return data');
  return result;
}

describe('[Page Server] /admin/posts', () => {
  it('should fetch from /api/posts', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: true,
      data: [mockPost],
      error: null,
    });

    await runLoad(mockFetch);

    expect(mockFetch).toHaveBeenCalledWith('/api/posts');
  });

  it('should return posts on successful response', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: true,
      data: [mockPost],
      error: null,
    });
    const result = await runLoad(mockFetch);

    expect(result.posts).toEqual([mockPost]);
  });

  it('should return empty posts array on successful response with no posts', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: true,
      data: [],
      error: null,
    });
    const result = await runLoad(mockFetch);

    expect(result.posts).toHaveLength(0);
  });

  it('should not include loadError on successful response', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: true,
      data: [mockPost],
      error: null,
    });
    const result = await runLoad(mockFetch);

    expect(result.loadError).toBeUndefined();
  });

  it('should return empty posts on API error response', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
        details: null,
      },
    });
    const result = await runLoad(mockFetch);

    expect(result.posts).toHaveLength(0);
  });

  it('should return loadError with error message on API error response', async () => {
    const errorMessage = 'Failed to load posts';
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
        details: null,
      },
    });
    const result = await runLoad(mockFetch);

    expect(result.loadError).toBe(errorMessage);
  });
});
