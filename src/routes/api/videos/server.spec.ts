import type { RequestEvent } from '@sveltejs/kit';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_VIDEO_SIZE_BYTES } from '$lib/constants';
import type { VideoUploadApiResponse } from '$lib/types/video';

vi.mock('$lib/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('$lib/constants')>();
  return {
    ...actual,
  };
});

const { POST } = await import('./+server');

type MockBucket = {
  put: ReturnType<typeof vi.fn>;
};

type MockOptions = {
  user?: { role: string } | null;
  bucket?: MockBucket | null;
  formData?: FormData | null;
  formDataError?: boolean;
};

const createMockEvent = ({
  user = { role: 'admin' },
  bucket = { put: vi.fn().mockResolvedValue(undefined) },
  formData = new FormData(),
  formDataError = false,
}: MockOptions = {}) => {
  const request = {
    formData: formDataError
      ? vi.fn().mockRejectedValue(new Error('Invalid form data'))
      : vi.fn().mockResolvedValue(formData),
  } as unknown as Request;

  return {
    platform: bucket ? { env: { BLOG_BUCKET: bucket } } : { env: {} },
    request,
    locals: { user },
  } as unknown as RequestEvent;
};

const createFile = (type: string, size = 100, name = 'test.mp4'): File =>
  new File([new ArrayBuffer(size)], name, { type });

describe('[API] POST /api/videos', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-1234',
    });
  });

  describe('Authorization', () => {
    it.each([
      ['no user', null],
      ['non-admin', { role: 'user' }],
    ])('should return 401 for %s', async (_, user) => {
      const event = createMockEvent({ user });
      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(401);
      expect(json.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Configuration', () => {
    it('should return 500 when R2 bucket is not configured', async () => {
      const event = createMockEvent({ bucket: null });
      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(500);
      expect(json.error?.code).toBe('BUCKET_BINDING_MISSING');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when formData parsing fails', async () => {
      const event = createMockEvent({ formDataError: true });
      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(json.error?.code).toBe('INVALID_REQUEST');
      expect(json.error?.message).toContain('multipart/form-data');
    });

    it.each([
      ['file field is missing', new FormData()],
      [
        'file is not a File instance',
        (() => {
          const fd = new FormData();
          fd.append('file', 'not-a-file');
          return fd;
        })(),
      ],
    ])('should return 400 when %s', async (_, formData) => {
      const event = createMockEvent({ formData });
      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(json.error?.code).toBe('INVALID_REQUEST');
    });
  });

  describe('File Validation', () => {
    it('should return 400 for invalid file type', async () => {
      const formData = new FormData();
      formData.append('file', createFile('text/plain'));
      const event = createMockEvent({ formData });
      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(json.error?.code).toBe('INVALID_FILE_TYPE');
      expect(json.error?.message).toContain('text/plain');
    });

    it('should return 400 when file exceeds max size', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        createFile('video/mp4', MAX_VIDEO_SIZE_BYTES + 1),
      );
      const event = createMockEvent({ formData });
      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(400);
      expect(json.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('Successful Upload', () => {
    it.each(['video/mp4', 'video/webm', 'video/ogg'])(
      'should upload %s successfully',
      async type => {
        const bucket = { put: vi.fn().mockResolvedValue(undefined) };
        const formData = new FormData();
        formData.append('file', createFile(type));
        const event = createMockEvent({ formData, bucket });

        const response = await POST(event);
        const json: VideoUploadApiResponse = await response.json();

        expect(response.status).toBe(201);
        expect(json.success).toBe(true);
        expect(json.data?.key).toContain('test-uuid-1234');
        expect(json.data?.key).toContain('posts/videos/');
        expect(json.data?.url).toBe(`/api/videos/${json.data?.key}`);
        expect(bucket.put).toHaveBeenCalledWith(
          expect.stringContaining('posts/videos/test-uuid-1234'),
          expect.any(ArrayBuffer),
          { httpMetadata: { contentType: type } },
        );
      },
    );
  });

  describe('Error Handling', () => {
    it('should return 500 when R2 put fails', async () => {
      const bucket = { put: vi.fn().mockRejectedValue(new Error('R2 error')) };
      const formData = new FormData();
      formData.append('file', createFile('video/mp4'));
      const event = createMockEvent({ formData, bucket });

      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(500);
      expect(json.error?.code).toBe('SERVER_ERROR');
      expect(json.error?.message).toBe('R2 error');
    });

    it('should handle non-Error exceptions', async () => {
      const bucket = { put: vi.fn().mockRejectedValue('string error') };
      const formData = new FormData();
      formData.append('file', createFile('video/mp4'));
      const event = createMockEvent({ formData, bucket });

      const response = await POST(event);
      const json: VideoUploadApiResponse = await response.json();

      expect(response.status).toBe(500);
      expect(json.error?.message).toBe('Unknown error occurred on the server');
    });
  });
});
