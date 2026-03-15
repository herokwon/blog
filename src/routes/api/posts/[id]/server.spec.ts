import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ApiError,
  DeletePostByIdApiResponse,
  GetPostByIdApiResponse,
  UpdatePostByIdApiResponse,
} from '$lib/types/api';

import {
  createMockD1,
  createMockPost,
  createMockRequestEvent,
} from '../test-utils';
import { DELETE, GET, PUT } from './+server';

describe('[API] /api/posts/[id]', () => {
  let mock: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    mock = createMockD1();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/posts/[id]', () => {
    it('should return 400 when post id is missing', async () => {
      const event = createMockRequestEvent({
        db: mock.db,
      });
      const response = await GET(event);
      const result: GetPostByIdApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(response.statusText).toBe('Bad Request');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toBe('Post id is required');
      expect(result.error?.details).toBeNull();
    });

    it('should return 500 if BLOG_DB binding is missing', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        params: { id: post.id },
      });
      const response = await GET(event);
      const result: GetPostByIdApiResponse = await response.json();

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('DATABASE_BINDING_MISSING');
      expect(result.error?.message).toBe(
        'The server is not configured correctly',
      );
      expect(result.error?.details).toEqual({
        resource: 'BLOG_DB',
        hint: 'Please check your wrangler config file or environment variables',
      } satisfies ApiError['details']);
    });

    it('should return 404 when post does not exist', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [] });

      const response = await GET(event);
      const result: GetPostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('POST_NOT_FOUND');
      expect(result.error?.message).toBe('Post not found');
      expect(result.error?.details).toEqual({
        id: post.id,
      } satisfies ApiError['details']);
    });

    it('should return post when found', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [post] });

      const response = await GET(event);
      const result: GetPostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(post);
      expect(result.error).toBeNull();
    });

    it('should handle server errors', async () => {
      mock.spies.run.mockRejectedValue(new Error('fail'));

      const post = createMockPost();
      const event = createMockRequestEvent({
        params: { id: post.id },
        db: mock.db,
      });
      const response = await GET(event);
      const result: GetPostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error" message when thrown value is not an Error', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue('non-error');

      const response = await GET(event);
      const result: GetPostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe(
        'Unknown error occurred on the server',
      );
      expect(result.error?.details).toBeNull();
    });
  });

  describe('PUT /api/posts/[id]', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return 400 when post id is missing', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'PUT',
        body: { ...post },
        db: mock.db,
      });
      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toBe('Post id is required');
      expect(result.error?.details).toBeNull();
    });

    it('should return 400 for malformed JSON body', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'PUT',
        params: { id: post.id },
        body: 'not a json',
        db: mock.db,
      });
      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toBe(
        'Request body must be a valid JSON object',
      );
      expect(result.error?.details).toBeNull();
    });

    it.each([{ content: 'content' }, { title: '', content: 'content' }])(
      'should return 400 when title is missing or invalid',
      async body => {
        const post = createMockPost();
        const event = createMockRequestEvent({
          method: 'PUT',
          params: { id: post.id },
          body,
          db: mock.db,
        });
        const response = await PUT(event);
        const result: UpdatePostByIdApiResponse = await response.json();

        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_REQUEST');
        expect(result.error?.details).toEqual({
          title: 'Missing or invalid (must be a non-empty string)',
          content: null,
        } satisfies ApiError['details']);
      },
    );

    it.each([{ title: 'title' }, { title: 'title', content: '' }])(
      'should return 400 when content is missing or invalid',
      async body => {
        const post = createMockPost();
        const event = createMockRequestEvent({
          method: 'PUT',
          params: { id: post.id },
          body,
          db: mock.db,
        });
        const response = await PUT(event);
        const result: UpdatePostByIdApiResponse = await response.json();

        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_REQUEST');
        expect(result.error?.details).toEqual({
          title: null,
          content: 'Missing or invalid (must be a non-empty string)',
        } satisfies ApiError['details']);
      },
    );

    it('should return 500 if BLOG_DB binding is missing', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'PUT',
        params: { id: post.id },
        body: { ...post },
      });
      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('DATABASE_BINDING_MISSING');
      expect(result.error?.message).toBe(
        'The server is not configured correctly',
      );
      expect(result.error?.details).toEqual({
        resource: 'BLOG_DB',
        hint: 'Please check your wrangler config file or environment variables',
      } satisfies ApiError['details']);
    });

    it('should return 404 when post does not exist', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'PUT',
        params: { id: post.id },
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [] });

      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('POST_NOT_FOUND');
      expect(result.error?.message).toBe('Post not found');
      expect(result.error?.details).toEqual({
        id: post.id,
      } satisfies ApiError['details']);
    });

    it('should update post and set updatedAt', async () => {
      vi.useFakeTimers();

      const updatedAt = new Date('2026-04-01T00:00:00.000Z').toISOString();
      vi.setSystemTime(updatedAt);

      const existingPost = createMockPost();
      const updatedPost = createMockPost({
        title: 'updated title',
        content: 'updated content',
        updatedAt,
      });
      const event = createMockRequestEvent({
        method: 'PUT',
        params: { id: existingPost.id },
        body: { ...updatedPost },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [updatedPost] });

      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(existingPost.id);
      expect(result.data?.title).toBe(updatedPost.title);
      expect(result.data?.content).toBe(updatedPost.content);
      expect(result.data?.createdAt).toBe(existingPost.createdAt);
      expect(result.data?.updatedAt).not.toBe(existingPost.updatedAt);
      expect(result.data?.updatedAt).toBe(updatedAt);
      expect(result.error).toBeNull();
    });

    it('should handle server errors', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'PUT',
        params: { id: post.id },
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue(new Error('fail'));

      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error" message when thrown value is not an Error', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'PUT',
        params: { id: post.id },
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue('non-error');

      const response = await PUT(event);
      const result: UpdatePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe(
        'Unknown error occurred on the server',
      );
      expect(result.error?.details).toBeNull();
    });
  });

  describe('DELETE /api/posts/[id]', () => {
    it('should return 400 when post id is missing', async () => {
      const event = createMockRequestEvent({
        method: 'DELETE',
        db: mock.db,
      });
      const response = await DELETE(event);
      const result: DeletePostByIdApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(response.statusText).toBe('Bad Request');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toBe('Post id is required');
      expect(result.error?.details).toBeNull();
    });

    it('should return 500 if BLOG_DB binding is missing', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'DELETE',
        params: { id: post.id },
      });
      const response = await DELETE(event);
      const result: DeletePostByIdApiResponse = await response.json();

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('DATABASE_BINDING_MISSING');
      expect(result.error?.message).toBe(
        'The server is not configured correctly',
      );
      expect(result.error?.details).toEqual({
        resource: 'BLOG_DB',
        hint: 'Please check your wrangler config file or environment variables',
      } satisfies ApiError['details']);
    });

    it('should return 404 when post does not exist', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'DELETE',
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [] });

      const response = await DELETE(event);
      const result: DeletePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('POST_NOT_FOUND');
      expect(result.error?.message).toBe('Post not found');
      expect(result.error?.details).toEqual({
        id: post.id,
      } satisfies ApiError['details']);
    });

    it('should return post when found', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'DELETE',
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [post] });

      const response = await DELETE(event);
      const result: DeletePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(null);
      expect(result.error).toBeNull();
    });

    it('should handle server errors', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'DELETE',
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue(new Error('fail'));

      const response = await DELETE(event);
      const result: DeletePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error" message when thrown value is not an Error', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'DELETE',
        params: { id: post.id },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue('non-error');

      const response = await DELETE(event);
      const result: DeletePostByIdApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe(
        'Unknown error occurred on the server',
      );
      expect(result.error?.details).toBeNull();
    });
  });
});
