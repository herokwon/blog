import type { RequestEvent } from '@sveltejs/kit';

import { describe, expect, it, vi } from 'vitest';

import { GET } from './+server';

type MockR2Object = {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  etag: string;
};

type MockOptions = {
  bucket?: { get: ReturnType<typeof vi.fn> } | null;
  path?: string;
  object?: MockR2Object | null;
};

const createMockEvent = ({
  bucket,
  path = 'posts/images/test.png',
  object = {
    body: new ReadableStream(),
    httpMetadata: { contentType: 'image/png' },
    etag: '"abc123"',
  },
}: MockOptions = {}) => {
  const mockBucket = bucket ?? { get: vi.fn().mockResolvedValue(object) };

  return {
    platform: bucket === null ? { env: {} } : { env: { BLOG: mockBucket } },
    params: { path },
  } as unknown as RequestEvent;
};

describe('GET /api/images/[...path]', () => {
  it('should throw 500 when R2 bucket is not configured', async () => {
    const event = createMockEvent({ bucket: null });

    await expect(GET(event)).rejects.toMatchObject({
      status: 500,
      body: { message: 'R2 binding not configured' },
    });
  });

  it('should throw 400 when path is missing', async () => {
    const event = createMockEvent({ path: '' });

    await expect(GET(event)).rejects.toMatchObject({
      status: 400,
      body: { message: 'Image path is required' },
    });
  });

  it('should throw 404 when image is not found', async () => {
    const event = createMockEvent({ object: null });

    await expect(GET(event)).rejects.toMatchObject({
      status: 404,
      body: { message: 'Image not found' },
    });
  });

  it('should return image with correct headers', async () => {
    const mockBody = new ReadableStream();
    const event = createMockEvent({
      object: {
        body: mockBody,
        httpMetadata: { contentType: 'image/webp' },
        etag: '"etag-value"',
      },
    });

    const response = await GET(event);

    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(response.headers.get('ETag')).toBe('"etag-value"');
  });

  it('should use fallback content-type when httpMetadata is missing', async () => {
    const event = createMockEvent({
      object: {
        body: new ReadableStream(),
        httpMetadata: undefined,
        etag: '"etag"',
      },
    });

    const response = await GET(event);

    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream',
    );
  });

  it('should use fallback content-type when contentType is undefined', async () => {
    const event = createMockEvent({
      object: {
        body: new ReadableStream(),
        httpMetadata: {},
        etag: '"etag"',
      },
    });

    const response = await GET(event);

    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream',
    );
  });
});
