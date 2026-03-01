import type { RequestEvent } from '@sveltejs/kit';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResponse } from '$lib/types/api';
import type { Post } from '$lib/types/post';

import { POST } from './+server';

type MockBucket = {
  put: (key: string, value: string) => void;
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
}: {
  request: Request;
  platform?: object;
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
    params: {},
    route: { id: '/api/posts' },
    url: new URL(request.url),
    setHeaders: () => {},
    isDataRequest: false,
    isSubRequest: false,
    tracing: { enabled: false, root: null, current: null },
    isRemoteRequest: false,
  } as RequestEvent;
}

describe('POST /api/posts', () => {
  let mockPut: (key: string, value: string) => void;
  let mockBucket: MockBucket;

  beforeEach(() => {
    mockPut = vi.fn<(key: string, value: string) => void>();
    mockBucket = { put: mockPut };
  });

  it('should return 400 for invalid request body', async () => {
    const request = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform(mockBucket);
    const event = createMockEvent({ request, platform });
    const response = await POST(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
  });

  it('should return 500 if BLOG bucket is missing', async () => {
    const requestBody: Post = {
      id: crypto.randomUUID(),
      title: 't',
      content: 'c',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const request = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = { env: {}, ctx: {}, caches: {} };
    const event = createMockEvent({ request, platform });
    const response = await POST(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BUCKET_NOT_FOUND');
  });

  it('should create a post and return success', async () => {
    const requestBody = { title: 't', content: 'c', author: 'a' };
    const request = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform(mockBucket);
    const event = createMockEvent({ request, platform });
    const response = await POST(event);
    const result: ApiResponse<Post> = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject(requestBody);
    expect(typeof result.data?.id).toBe('string');
    expect(typeof result.data?.createdAt).toBe('string');
    expect(typeof result.data?.updatedAt).toBe('string');
    expect(mockPut).toHaveBeenCalledWith(
      result.data?.id,
      JSON.stringify(result.data),
    );
  });

  it('should handle server errors', async () => {
    // Use a Proxy to override request.json() to throw an error, instead of using a real Request
    const request = new Proxy(
      new Request('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({ title: 't', content: 'c', author: 'a' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      {
        get(target, prop) {
          if (prop === 'json') {
            return async () => {
              throw new Error('fail');
            };
          }
          return Reflect.get(target, prop);
        },
      },
    );
    const platform = createMockPlatform(mockBucket);
    const event = createMockEvent({ request, platform });
    const response = await POST(event);
    const result: ApiResponse<null> = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail');
  });
});
