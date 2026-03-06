import type { RequestEvent } from '@sveltejs/kit';

import { describe, expect, it, vi } from 'vitest';

import type { ApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';

import { GET } from './+server';

type MockBucket = {
  get?: (key: string) => Promise<{ json: <T>() => Promise<T> } | null>;
};

function createMockPlatform(bucketImpl?: MockBucket) {
  return {
    env: {
      BLOG: bucketImpl,
    },
    ctx: {},
    caches: {},
  };
}

function createMockEvent({
  request,
  platform,
  postId,
}: {
  request: Request;
  platform?: object;
  postId?: string;
}): RequestEvent {
  return {
    request,
    platform,
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => '',
    },
    fetch: global.fetch,
    getClientAddress: () => '',
    locals: {},
    params: { id: postId ?? '' },
    route: { id: '/api/posts/[id]' },
    url: new URL(request.url),
    setHeaders: () => {},
    isDataRequest: false,
    isSubRequest: false,
    tracing: { enabled: false, root: null, current: null },
    isRemoteRequest: false,
  } as unknown as RequestEvent;
}

const MOCK_POST_ID = crypto.randomUUID();

describe('GET /api/posts/[id]', () => {
  it('should return 400 when post id is missing', async () => {
    const request = new Request('http://localhost/api/posts/', {
      method: 'GET',
    });
    const platform = createMockPlatform();
    const event = createMockEvent({ request, platform, postId: '' });
    const response = await GET(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
  });

  it('should return 500 if BLOG bucket is missing', async () => {
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'GET',
    });
    const platform = { env: {}, ctx: {}, caches: {} };
    const event = createMockEvent({ request, platform, postId: MOCK_POST_ID });
    const response = await GET(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BUCKET_NOT_FOUND');
  });

  it('should return 404 when post does not exist', async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const platform = createMockPlatform({ get: mockGet });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'GET',
    });
    const event = createMockEvent({ request, platform, postId: MOCK_POST_ID });
    const response = await GET(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('POST_NOT_FOUND');
    expect(mockGet).toHaveBeenCalledWith(MOCK_POST_ID);
  });

  it('should return post when found', async () => {
    const post: Post = {
      id: MOCK_POST_ID,
      title: 'title',
      content: 'content',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    const mockGet = vi.fn().mockResolvedValue({ json: async () => post });
    const platform = createMockPlatform({ get: mockGet });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'GET',
    });
    const event = createMockEvent({ request, platform, postId: MOCK_POST_ID });
    const response = await GET(event);
    const result: ApiResponse<Post> = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(post);
    expect(mockGet).toHaveBeenCalledWith(MOCK_POST_ID);
  });

  it('should handle server errors', async () => {
    const mockGet = vi.fn().mockRejectedValue(new Error('fail'));
    const platform = createMockPlatform({ get: mockGet });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'GET',
    });
    const event = createMockEvent({ request, platform, postId: MOCK_POST_ID });
    const response = await GET(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail');
  });
});
