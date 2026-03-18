import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockFetch,
  createMockLoadEvent,
  createMockPost,
} from '$lib/test-utils';
import type { ListPostsApiResponse } from '$lib/types/api';

import type { PageServerLoadEvent } from './$types';
import { load } from './+page.server';

describe('[Page Server] /posts', () => {
  let mockPost: ReturnType<typeof createMockPost>;

  beforeEach(() => {
    mockPost = createMockPost();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('should return posts on success response', async () => {
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
    expect(result.loadError).toBeUndefined();
  });

  it('should return empty posts and loadError on failure response', async () => {
    const mockFetch = createMockFetch<
      PageServerLoadEvent,
      ListPostsApiResponse
    >({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load posts',
        details: null,
      },
    });

    const result = await runLoad(mockFetch);

    expect(result.posts).toEqual([]);
    expect(result.loadError).toBe('Failed to load posts');
  });
});

async function runLoad(fetch: PageServerLoadEvent['fetch']) {
  const result = await load(
    createMockLoadEvent<PageServerLoadEvent>({ fetch }),
  );

  if (!result) throw new Error('Expected load to return data');
  return result;
}
