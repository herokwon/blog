import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CreatePostApiResponse,
  ListPostsApiResponse,
} from '$lib/types/api';
import type { Post } from '$lib/types/post';

import { GET, POST } from './+server';
import {
  createMockEvent,
  createMockPlatform,
  type MockBucket,
} from './test-utils';

const MOCK_FIRST_POST_ID = '7b0f4f50-40ef-4625-b4f7-743f72f36f8f';
const MOCK_SECOND_POST_ID = 'f2fb88b6-aeb8-4459-a2f4-073022eb35f9';
const MOCK_REQUEST_POST_ID = '91bb149f-9a73-47c8-b3da-f2327e63ca02';

function createMockEventWithPosts(
  args: Omit<Parameters<typeof createMockEvent>[0], 'routeId'>,
) {
  return createMockEvent({ ...args, routeId: '/api/posts' });
}

describe('GET /api/posts', () => {
  it('should return 500 if BLOG bucket is missing', async () => {
    const request = new Request('http://localhost/api/posts', {
      method: 'GET',
    });
    const platform = { env: {}, ctx: {}, caches: {} };
    const event = createMockEventWithPosts({ request, platform });
    const response = await GET(event);
    const result: ListPostsApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BUCKET_NOT_FOUND');
  });

  it('should return sorted posts from multiple list pages', async () => {
    const firstPost: Post = {
      id: MOCK_FIRST_POST_ID,
      title: 'first',
      content: 'content-1',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    const secondPost: Post = {
      id: MOCK_SECOND_POST_ID,
      title: 'second',
      content: 'content-2',
      createdAt: '2026-03-02T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
    };

    const mockList = vi
      .fn()
      .mockResolvedValueOnce({
        objects: [{ key: firstPost.id }],
        truncated: true,
        cursor: 'next-page',
      })
      .mockResolvedValueOnce({
        objects: [{ key: secondPost.id }],
        truncated: false,
      });

    const mockGet = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => firstPost })
      .mockResolvedValueOnce({ json: async () => secondPost });

    const request = new Request('http://localhost/api/posts', {
      method: 'GET',
    });
    const platform = createMockPlatform({ list: mockList, get: mockGet });
    const event = createMockEventWithPosts({ request, platform });
    const response = await GET(event);
    const result: ListPostsApiResponse = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data?.map(post => post.id)).toEqual([
      secondPost.id,
      firstPost.id,
    ]);
    expect(mockList).toHaveBeenNthCalledWith(1, { cursor: undefined });
    expect(mockList).toHaveBeenNthCalledWith(2, { cursor: 'next-page' });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should handle server errors', async () => {
    const mockList = vi.fn().mockRejectedValue(new Error('fail'));
    const request = new Request('http://localhost/api/posts', {
      method: 'GET',
    });
    const platform = createMockPlatform({ list: mockList });
    const event = createMockEventWithPosts({ request, platform });
    const response = await GET(event);
    const result: ListPostsApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail');
  });
});

describe('POST /api/posts', () => {
  let mockPut: (key: string, value: string) => void;
  let mockBucket: MockBucket;

  beforeEach(() => {
    mockPut = vi.fn<(key: string, value: string) => void>();
    mockBucket = { put: mockPut };
  });

  it('should return 400 for malformed JSON body', async () => {
    const request = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: 'not a json',
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform(mockBucket);
    const event = createMockEventWithPosts({ request, platform });
    const response = await POST(event);
    const result: CreatePostApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(result.error?.message).toBe(
      'Request body must be a valid JSON object',
    );
  });

  it('should return 400 for invalid request body', async () => {
    const request = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform(mockBucket);
    const event = createMockEventWithPosts({ request, platform });
    const response = await POST(event);
    const result: CreatePostApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(result.error?.message).toBe(
      'Request body must be a JSON object with string properties "title" and "content"',
    );
  });

  it('should return 500 if BLOG bucket is missing', async () => {
    const requestBody: Post = {
      id: MOCK_REQUEST_POST_ID,
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
    const event = createMockEventWithPosts({ request, platform });
    const response = await POST(event);
    const result: CreatePostApiResponse = await response.json();

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
    const event = createMockEventWithPosts({ request, platform });
    const response = await POST(event);
    const result: CreatePostApiResponse = await response.json();

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
    mockPut = vi.fn(() => {
      throw new Error('fail');
    });
    mockBucket = { put: mockPut };

    const request = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 't', content: 'c' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform(mockBucket);
    const event = createMockEventWithPosts({ request, platform });
    const response = await POST(event);
    const result: CreatePostApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail');
  });
});
