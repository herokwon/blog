import { describe, expect, it, vi } from 'vitest';

import type {
  DeletePostByIdApiResponse,
  GetPostByIdApiResponse,
  UpdatePostByIdApiResponse,
} from '$lib/types/api';
import type { Post } from '$lib/types/post';

import { createMockEvent, createMockPlatform } from '../test-utils';
import { DELETE, GET, PUT } from './+server';

const MOCK_POST_ID = '4e9344a8-b642-47fb-8e8b-b0f1343f77df';

function createMockEventWithPost(
  args: Omit<Parameters<typeof createMockEvent>[0], 'routeId'>,
) {
  return createMockEvent({
    ...args,
    routeId: `/api/posts/${args.postId}`,
  });
}

describe('GET /api/posts/[id]', () => {
  it('should return 400 when post id is missing', async () => {
    const request = new Request('http://localhost/api/posts/', {
      method: 'GET',
    });
    const platform = createMockPlatform();
    const event = createMockEventWithPost({ request, platform });
    const response = await GET(event);
    const result: GetPostByIdApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
  });

  it('should return 500 if BLOG bucket is missing', async () => {
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'GET',
    });
    const platform = { env: {}, ctx: {}, caches: {} };
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await GET(event);
    const result: GetPostByIdApiResponse = await response.json();

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
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await GET(event);
    const result: GetPostByIdApiResponse = await response.json();

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
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await GET(event);
    const result: GetPostByIdApiResponse = await response.json();

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
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await GET(event);
    const result: GetPostByIdApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail');
  });
});

describe('PUT /api/posts/[id]', () => {
  it('should return 400 when post id is missing', async () => {
    const request = new Request('http://localhost/api/posts/', {
      method: 'PUT',
      body: JSON.stringify({ title: 'updated', content: 'updated content' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform();
    const event = createMockEventWithPost({ request, platform });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(result.error?.message).toBe('Post id is required');
  });

  it('should return 400 for malformed JSON body', async () => {
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'PUT',
      body: '{"title":"updated",',
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform({ get: vi.fn(), put: vi.fn() });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(result.error?.message).toBe(
      'Request body must be a valid JSON object',
    );
  });

  it('should return 400 for invalid request body shape', async () => {
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform({ get: vi.fn(), put: vi.fn() });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(result.error?.message).toBe(
      'Request body must be a JSON object with string properties "title" and "content"',
    );
  });

  it('should return 500 if BLOG bucket is missing', async () => {
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'updated', content: 'updated content' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = { env: {}, ctx: {}, caches: {} };
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BUCKET_NOT_FOUND');
  });

  it('should return 404 when post does not exist', async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'updated', content: 'updated content' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform({ get: mockGet });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('POST_NOT_FOUND');
    expect(mockGet).toHaveBeenCalledWith(MOCK_POST_ID);
  });

  it('should update post and set updatedAt', async () => {
    const oldUpdatedAt = '2026-03-01T00:00:00.000Z';
    const existingPost: Post = {
      id: MOCK_POST_ID,
      title: 'title',
      content: 'content',
      createdAt: '2026-02-28T00:00:00.000Z',
      updatedAt: oldUpdatedAt,
    };
    const mockGet = vi
      .fn()
      .mockResolvedValue({ json: async () => existingPost });
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'updated', content: 'updated content' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform({ get: mockGet, put: mockPut });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(existingPost.id);
    expect(result.data?.title).toBe('updated');
    expect(result.data?.content).toBe('updated content');
    expect(result.data?.createdAt).toBe(existingPost.createdAt);
    expect(result.data?.updatedAt).not.toBe(oldUpdatedAt);

    expect(mockGet).toHaveBeenCalledWith(MOCK_POST_ID);
    expect(mockPut).toHaveBeenCalledWith(
      MOCK_POST_ID,
      JSON.stringify(result.data),
    );
  });

  it('should handle server errors', async () => {
    const mockGet = vi.fn().mockRejectedValue(new Error('fail'));
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'updated', content: 'updated content' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const platform = createMockPlatform({ get: mockGet });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await PUT(event);
    const result: UpdatePostByIdApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail');
  });
});

describe('DELETE /api/posts/[id]', () => {
  it('should return 400 when post id is missing', async () => {
    const request = new Request('http://localhost/api/posts/', {
      method: 'DELETE',
    });
    const platform = createMockPlatform();
    const event = createMockEventWithPost({ request, platform });
    const response = await DELETE(event);
    const result: DeletePostByIdApiResponse = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
  });

  it('should return 500 if BLOG bucket is missing', async () => {
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'DELETE',
    });
    const platform = { env: {}, ctx: {}, caches: {} };
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await DELETE(event);
    const result: DeletePostByIdApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BUCKET_NOT_FOUND');
  });

  it('should return 404 when post does not exist', async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const platform = createMockPlatform({ get: mockGet });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'DELETE',
    });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await DELETE(event);
    const result: DeletePostByIdApiResponse = await response.json();

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
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const platform = createMockPlatform({ get: mockGet, delete: mockDelete });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'DELETE',
    });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await DELETE(event);
    const result: DeletePostByIdApiResponse = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(null);
    expect(mockGet).toHaveBeenCalledWith(MOCK_POST_ID);
    expect(mockDelete).toHaveBeenCalledWith(MOCK_POST_ID);
  });

  it('should handle server errors during get (existence check)', async () => {
    const mockGet = vi.fn().mockRejectedValue(new Error('fail-get'));
    const platform = createMockPlatform({ get: mockGet });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'DELETE',
    });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await DELETE(event);
    const result: DeletePostByIdApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail-get');
  });

  it('should handle server errors during delete (delete operation)', async () => {
    const post: Post = {
      id: MOCK_POST_ID,
      title: 'title',
      content: 'content',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    const mockGet = vi.fn().mockResolvedValue({ json: async () => post });
    const mockDelete = vi.fn().mockRejectedValue(new Error('fail-delete'));
    const platform = createMockPlatform({ get: mockGet, delete: mockDelete });
    const request = new Request(`http://localhost/api/posts/${MOCK_POST_ID}`, {
      method: 'DELETE',
    });
    const event = createMockEventWithPost({
      request,
      platform,
      postId: MOCK_POST_ID,
    });
    const response = await DELETE(event);
    const result: DeletePostByIdApiResponse = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
    expect(result.error?.message).toBe('fail-delete');
  });
});
