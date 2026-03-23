import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockD1,
  createMockDBPost,
  createMockPost,
  createMockRequestEvent,
} from '$lib/test-utils';
import type {
  ApiError,
  CreatePostApiResponse,
  ListPostsApiResponse,
} from '$lib/types/api';

import { GET, POST } from './+server';

describe('[API] /api/posts', () => {
  let mockD1: ReturnType<typeof createMockD1>;
  let event: ReturnType<typeof createMockRequestEvent>['event'];

  beforeEach(() => {
    mockD1 = createMockD1();
    event = createMockRequestEvent({
      db: mockD1.db,
    }).event;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('[API] GET /api/posts', () => {
    it('should return 500 if BLOG_DB binding is missing', async () => {
      const { event } = createMockRequestEvent();
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
      const dbPost1 = createMockDBPost();
      const dbPost2 = createMockDBPost({
        id: 'f2fb88b6-aeb8-4459-a2f4-073022eb35f9',
        created_at: '2026-03-02T00:00:00.000Z',
        updated_at: '2026-03-02T00:00:00.000Z',
      });

      mockD1.spies.all.mockResolvedValue({
        results: [dbPost1, dbPost2].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      });

      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

      expect(mockD1.spies.all).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(result.success).toBe(true);
      expect(result.data?.map(p => p.id)).toEqual([dbPost2.id, dbPost1.id]);
      expect(result.error).toBeNull();
    });

    it('should handle server errors', async () => {
      mockD1.spies.all.mockRejectedValue(new Error('fail'));

      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

      expect(mockD1.spies.all).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error occurred on the server" when thrown value is not an Error', async () => {
      mockD1.spies.all.mockRejectedValue('non-error');

      const response = await GET(event);
      const result: ListPostsApiResponse = await response.json();

      expect(mockD1.spies.all).toHaveBeenCalledTimes(1);

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

  describe('[API] POST /api/posts', () => {
    let post: ReturnType<typeof createMockPost>;
    let dbPost: ReturnType<typeof createMockDBPost>;

    beforeEach(() => {
      post = createMockPost();
      dbPost = createMockDBPost();
    });

    it('should return 400 for malformed JSON body', async () => {
      event = createMockRequestEvent({
        method: 'POST',
        body: 'not a json',
        db: mockD1.db,
      }).event;
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
      event = createMockRequestEvent({
        method: 'POST',
        body: { foo: 'bar' },
        db: mockD1.db,
      }).event;
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
        event = createMockRequestEvent({
          method: 'POST',
          body,
          db: mockD1.db,
        }).event;
        const response = await POST(event);
        const result: CreatePostApiResponse = await response.json();

        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
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
        event = createMockRequestEvent({
          method: 'POST',
          body,
          db: mockD1.db,
        }).event;
        const response = await POST(event);
        const result: CreatePostApiResponse = await response.json();

        expect(response.status).toBe(400);
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.error?.code).toBe('INVALID_REQUEST');
        expect(result.error?.details).toEqual({
          title: null,
          content: 'Missing or invalid (must be a non-empty string)',
        } satisfies ApiError['details']);
      },
    );

    it('should return 500 if BLOG_DB binding is missing', async () => {
      event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
      }).event;
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
      event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mockD1.db,
      }).event;

      mockD1.spies.run.mockResolvedValue({ results: [dbPost] });

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mockD1.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(201);
      expect(response.statusText).toBe('Created');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(post);
      expect(result.error).toBeNull();
    });

    it('should return 500 if post creation returns no row', async () => {
      event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mockD1.db,
      }).event;

      mockD1.spies.run.mockResolvedValue({ results: [] });

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mockD1.spies.run).toHaveBeenCalledTimes(1);

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
      event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mockD1.db,
      }).event;

      mockD1.spies.run.mockRejectedValue(new Error('fail'));

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mockD1.spies.run).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('SERVER_ERROR');
      expect(result.error?.message).toBe('fail');
      expect(result.error?.details).toBeNull();
    });

    it('should use "Unknown error occurred on the server" when thrown value is not an Error', async () => {
      event = createMockRequestEvent({
        method: 'POST',
        body: { ...post },
        db: mockD1.db,
      }).event;

      mockD1.spies.run.mockRejectedValue('non-error');

      const response = await POST(event);
      const result: CreatePostApiResponse = await response.json();

      expect(mockD1.spies.run).toHaveBeenCalledTimes(1);

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
