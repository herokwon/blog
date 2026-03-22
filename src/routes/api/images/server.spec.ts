import type { RequestEvent } from '@sveltejs/kit';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGE_SIZE_BYTES } from '$lib/constants';

vi.mock('$lib/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('$lib/constants')>();
  return {
    ...actual,
    ALLOWED_IMAGE_TYPES: [...actual.ALLOWED_IMAGE_TYPES, 'image/tiff'],
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
    platform: bucket ? { env: { BLOG: bucket } } : { env: {} },
    request,
    locals: { user },
  } as unknown as RequestEvent;
};

const createFile = (type: string, size = 100, name = 'test.png'): File =>
  new File([new ArrayBuffer(size)], name, { type });

describe('POST /api/images', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-1234',
    });
  });

  it.each([
    ['no user', null],
    ['non-admin', { role: 'user' }],
  ])('should return 401 for %s', async (_, user) => {
    const event = createMockEvent({ user });
    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 500 when R2 bucket is not configured', async () => {
    const event = createMockEvent({ bucket: null });
    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error.code).toBe('R2_BINDING_MISSING');
  });

  it('should return 400 when formData parsing fails', async () => {
    const event = createMockEvent({ formDataError: true });
    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('INVALID_REQUEST');
    expect(json.error.message).toContain('multipart/form-data');
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
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('INVALID_REQUEST');
  });

  it('should return 400 for invalid file type', async () => {
    const formData = new FormData();
    formData.append('file', createFile('text/plain'));
    const event = createMockEvent({ formData });
    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('INVALID_FILE_TYPE');
    expect(json.error.message).toContain('text/plain');
  });

  it('should return 400 when file exceeds max size', async () => {
    const formData = new FormData();
    formData.append('file', createFile('image/png', MAX_IMAGE_SIZE_BYTES + 1));
    const event = createMockEvent({ formData });
    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('FILE_TOO_LARGE');
  });

  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])(
    'should upload %s successfully',
    async type => {
      const bucket = { put: vi.fn().mockResolvedValue(undefined) };
      const formData = new FormData();
      formData.append('file', createFile(type));
      const event = createMockEvent({ formData, bucket });

      const response = await POST(event);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.key).toContain('test-uuid-1234');
      expect(json.data.url).toBe(`/api/images/${json.data.key}`);
      expect(bucket.put).toHaveBeenCalled();
    },
  );

  it('should use "bin" extension for unmapped mime type', async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    const formData = new FormData();
    formData.append('file', createFile('image/tiff')); // tiff is in ALLOWED but not in extensions
    const event = createMockEvent({ formData, bucket });

    await POST(event);

    expect(bucket.put).toHaveBeenCalledWith(
      expect.stringContaining('.bin'),
      expect.any(ArrayBuffer),
      expect.any(Object),
    );
  });

  it('should return 500 when R2 put fails', async () => {
    const bucket = { put: vi.fn().mockRejectedValue(new Error('R2 error')) };
    const formData = new FormData();
    formData.append('file', createFile('image/png'));
    const event = createMockEvent({ formData, bucket });

    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error.code).toBe('SERVER_ERROR');
    expect(json.error.message).toBe('R2 error');
  });

  it('should handle non-Error exceptions', async () => {
    const bucket = { put: vi.fn().mockRejectedValue('string error') };
    const formData = new FormData();
    formData.append('file', createFile('image/png'));
    const event = createMockEvent({ formData, bucket });

    const response = await POST(event);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error.message).toBe('Unknown error occurred on the server');
  });
});
