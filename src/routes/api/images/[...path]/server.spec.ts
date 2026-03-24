import { beforeEach, describe, expect, it } from 'vitest';

import { createMockR2, createMockRequestEvent } from '$lib/test-utils';

import { GET } from './+server';

describe('[API] GET /api/images/[...path]', () => {
  let mockR2: ReturnType<typeof createMockR2>;
  let mockEvent: ReturnType<typeof createMockRequestEvent>;

  beforeEach(() => {
    mockR2 = createMockR2();
    mockEvent = createMockRequestEvent({
      params: { path: 'test-image.png' },
      request: new Request('http://localhost/api/images/test.png'),
      bucket: mockR2.bucket,
    });
  });

  it('should throw 500 when R2 bucket is not configured', async () => {
    mockEvent = createMockRequestEvent();

    await expect(GET(mockEvent.event)).rejects.toMatchObject({
      status: 500,
      body: { message: 'R2 binding not configured' },
    });
  });

  it('should throw 400 when path is missing', async () => {
    mockEvent = createMockRequestEvent({
      bucket: mockR2.bucket,
    });

    await expect(GET(mockEvent.event)).rejects.toMatchObject({
      status: 400,
      body: { message: 'Image path is required' },
    });
  });

  it('should throw 404 when image is not found', async () => {
    mockEvent = createMockRequestEvent({
      params: { path: 'non-existent.png' },
      bucket: mockR2.bucket,
    });

    await expect(GET(mockEvent.event)).rejects.toMatchObject({
      status: 404,
      body: { message: 'Image not found' },
    });
  });

  it('should return 304 when ETag matches', async () => {
    mockEvent = createMockRequestEvent({
      params: { path: 'test-image.png' },
      request: new Request('http://localhost/api/images/test.png', {
        headers: { 'If-None-Match': 'abc123' },
      }),
      bucket: mockR2.bucket,
    });

    mockR2.spies.get.mockResolvedValue({
      body: new ReadableStream(),
      etag: 'abc123',
    });

    const response = await GET(mockEvent.event);

    expect(response.status).toBe(304);
    expect(response.headers.get('ETag')).toBe('abc123');
  });

  it('should return image with correct headers', async () => {
    mockR2.spies.get.mockResolvedValue({
      body: new ReadableStream(),
      httpMetadata: { contentType: 'image/webp' },
      etag: 'abc123',
    });

    const response = await GET(mockEvent.event);

    expect(response.headers.get('Content-Type')).toBe('image/webp');
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

    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream',
    );
  });
});
