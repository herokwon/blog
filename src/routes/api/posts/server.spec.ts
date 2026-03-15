import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ApiError,
  CreatePostApiResponse,
  ListPostsApiResponse,
} from '$lib/types/api';

import { GET, POST } from './+server';
import {
  createMockD1,
  createMockPost,
  createMockRequestEvent,
} from './test-utils';

describe('[API] /api/posts', () => {
  let mock: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    mock = createMockD1();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/posts', () => {
    it('should return 500 if BLOG_DB binding is missing', async () => {
      const event = createMockRequestEvent();
      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

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

    it('should return posts ordered by createdAt descending', async () => {
      const post1 = createMockPost();
      const post2 = createMockPost({
        id: 'f2fb88b6-aeb8-4459-a2f4-073022eb35f9',
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      });
      const event = createMockRequestEvent({
        db: mock.db,
      });

      mock.spies.all.mockResolvedValue({
        results: [post1, post2].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      });

      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

      expect(mock.spies.all).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(result.success).toBe(true);
      expect(result.data?.map(p => p.id)).toEqual([post2.id, post1.id]);
      expect(result.error).toBeNull();
    });

    it('should handle server errors', async () => {
      const event = createMockRequestEvent({
        db: mock.db,
      });

      mock.spies.all.mockRejectedValue(new Error('fail'));

      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

      expect(mock.spies.all).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error occurred on the server" when thrown value is not an Error', async () => {
      const event = createMockRequestEvent({
        db: mock.db,
      });

      mock.spies.all.mockRejectedValue('non-error');

      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

      expect(mock.spies.all).toHaveBeenCalledTimes(1);

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

  describe('POST /api/posts', () => {
    it('should return 400 for malformed JSON body', async () => {
      const event = createMockRequestEvent({
        method: 'POST',
        body: 'not a json',
        db: mock.db,
      });
      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(response.statusText).toBe('Bad Request');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toBe(
        'Request body must be a valid JSON object',
      );
      expect(result.error?.details).toBeNull();
    });

    it('should return 400 for invalid request body', async () => {
      const event = createMockRequestEvent({
        method: 'POST',
        body: { foo: 'bar' },
        db: mock.db,
      });
      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(response.statusText).toBe('Bad Request');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toBe(
        'Request body must be a JSON object with string properties "title" and "content"',
      );
      expect(result.error?.details).toEqual({
        title: 'Missing or invalid (must be a non-empty string)',
        content: 'Missing or invalid (must be a non-empty string)',
      } satisfies ApiError['details']);
    });

    it.each([{ content: 'content' }, { title: '', content: 'content' }])(
      'should return 400 when title is missing or invalid',
      async body => {
        const event = createMockRequestEvent({
          method: 'POST',
          body,
          db: mock.db,
        });
        const response = await POST(event);
        const result: CreatePostApiResponse = await response.json();

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
        const event = createMockRequestEvent({
          method: 'POST',
          body,
          db: mock.db,
        });
        const response = await POST(event);
        const result: CreatePostApiResponse = await response.json();

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
        method: 'POST',
        body: { ...post },
      });
      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

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

    it('should create a post and return 201', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [post] });

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(201);
      expect(response.statusText).toBe('Created');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(post);
      expect(result.error).toBeNull();
    });

    it('should return 500 if post creation returns no row', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockResolvedValue({ results: [] });

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('POST_CREATION_FAILED');
      expect(result.error?.message).toBe(
        'Failed to retrieve the created post from the database',
      );
      expect(result.error?.details).toBeNull();
    });

    it('should handle server errors', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue(new Error('fail'));

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mock.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error occurred on the server" when thrown value is not an Error', async () => {
      const post = createMockPost();
      const event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mock.db,
      });

      mock.spies.run.mockRejectedValue('non-error');

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

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
