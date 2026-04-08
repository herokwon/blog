import { beforeEach, describe, expect, it } from 'vitest';

import { createMockR2, createMockRequestEvent } from '$lib/test-utils';

const { GET } = await import('./+server');

describe('[API] GET /api/videos/[...path]', () => {
  let mockR2: ReturnType<typeof createMockR2>;
  let mockEvent: ReturnType<typeof createMockRequestEvent>;

  beforeEach(() => {
    mockR2 = createMockR2();
    mockEvent = createMockRequestEvent({
      params: { path: 'posts/videos/test.mp4' },
      request: new Request('http://localhost/api/videos/posts/videos/test.mp4'),
      bucket: mockR2.bucket,
    });
  });

  describe('Configuration & Validation', () => {
    it('should throw 500 when R2 bucket is not configured', async () => {
      const eventNoBucket = createMockRequestEvent({
        params: { path: 'videos/test.mp4' },
      });
      await expect(GET(eventNoBucket.event)).rejects.toMatchObject({
        status: 500,
      });
    });

    it('should throw 400 when path is missing', async () => {
      const eventNoPath = createMockRequestEvent({
        bucket: mockR2.bucket,
      });
      await expect(GET(eventNoPath.event)).rejects.toMatchObject({
        status: 400,
      });
    });

    it('should throw 404 when video is not found', async () => {
      mockR2.spies.get.mockResolvedValue(null);
      await expect(GET(mockEvent.event)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('Caching', () => {
    it('should return 304 when ETag matches If-None-Match', async () => {
      mockR2.spies.get.mockResolvedValue({
        body: new ReadableStream(),
        etag: 'abc123',
        httpMetadata: { contentType: 'video/mp4' },
      });
      const eventWithETag = createMockRequestEvent({
        params: { path: 'posts/videos/test.mp4' },
        request: new Request(
          'http://localhost/api/videos/posts/videos/test.mp4',
          {
            headers: { 'If-None-Match': 'abc123' },
          },
        ),
        bucket: mockR2.bucket,
      });

      const response = await GET(eventWithETag.event);

      expect(response.status).toBe(304);
      expect(response.headers.get('ETag')).toBe('abc123');
    });
  });

  describe('Successful Retrieval', () => {
    it('should return video with correct headers', async () => {
      mockR2.spies.get.mockResolvedValue({
        body: new ReadableStream(),
        httpMetadata: { contentType: 'video/mp4' },
        etag: 'abc123',
      });

      const response = await GET(mockEvent.event);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('video/mp4');
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=31536000, s-maxage=31536000, immutable',
      );
      expect(response.headers.get('ETag')).toBe('abc123');
    });

    it('should use fallback content-type when httpMetadata is missing', async () => {
      mockR2.spies.get.mockResolvedValue({
        body: new ReadableStream(),
        etag: 'abc123',
      });

      const response = await GET(mockEvent.event);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(
        'application/octet-stream',
      );
    });
  });
});
