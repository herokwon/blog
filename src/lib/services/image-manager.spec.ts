import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createImageManager } from './image-manager';

describe('[Services] image-manager', () => {
  const originalFetch = globalThis.fetch;
  const originalURL = globalThis.URL;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { key: 'test-key', url: 'https://example.com/test.png' },
        error: null,
      }),
    }) as unknown as typeof fetch;

    globalThis.URL = {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob://test-url'),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.URL = originalURL;
    vi.restoreAllMocks();
  });

  it('should track and upload pending images', async () => {
    const manager = createImageManager();
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    const blobUrl = manager.addImage(file);

    expect(blobUrl).toBe('blob://test-url');
    expect(manager.hasPending).toBe(true);
    expect(manager.getPendingImages()).toHaveLength(1);

    const map = await manager.uploadAll();

    expect(map.get(blobUrl)).toBe('https://example.com/test.png');
    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });

  it('should cleanup revokes object URLs and clears pending', () => {
    const manager = createImageManager();
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    manager.addImage(file);
    expect(manager.hasPending).toBe(true);

    manager.cleanup();

    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should register image with existing blob URL', () => {
    const manager = createImageManager();
    const file = new File(['content'], 'test.png', { type: 'image/png' });
    const existingBlobUrl = 'blob://existing-url';

    manager.registerImage(file, existingBlobUrl);

    expect(manager.hasPending).toBe(true);
    expect(manager.getPendingImages()).toHaveLength(1);
    expect(manager.getPendingImages()[0]).toEqual({
      file,
      blobUrl: existingBlobUrl,
    });
  });

  it('should remove image and revoke blob URL', () => {
    const manager = createImageManager();
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    const blobUrl = manager.addImage(file);
    expect(manager.hasPending).toBe(true);

    manager.removeImage(blobUrl);

    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
    expect(manager.getPendingImages()).toHaveLength(0);
  });

  it('should not fail when removing non-existent image', () => {
    const manager = createImageManager();

    expect(() => manager.removeImage('blob://non-existent')).not.toThrow();
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('should handle upload failure and not add to urlMap', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: false,
        data: null,
        error: 'Upload failed',
      }),
    }) as unknown as typeof fetch;

    const manager = createImageManager();
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    const blobUrl = manager.addImage(file);
    expect(manager.hasPending).toBe(true);

    const map = await manager.uploadAll();

    expect(map.size).toBe(0);
    expect(map.has(blobUrl)).toBe(false);
    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('should handle partial upload failures', async () => {
    let urlCounter = 0;
    globalThis.URL = {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => `blob://test-url-${++urlCounter}`),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL;

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        json: vi.fn().mockResolvedValue(
          callCount === 1
            ? {
                success: true,
                data: {
                  key: 'test-key-1',
                  url: 'https://example.com/test1.png',
                },
                error: null,
              }
            : {
                success: false,
                data: null,
                error: 'Upload failed',
              },
        ),
      });
    }) as unknown as typeof fetch;

    const manager = createImageManager();
    const file1 = new File(['content1'], 'test1.png', { type: 'image/png' });
    const file2 = new File(['content2'], 'test2.png', { type: 'image/png' });

    const blobUrl1 = manager.addImage(file1);
    const blobUrl2 = manager.addImage(file2);

    expect(manager.hasPending).toBe(true);

    const map = await manager.uploadAll();

    expect(map.size).toBe(1);
    expect(map.get(blobUrl1)).toBe('https://example.com/test1.png');
    expect(map.has(blobUrl2)).toBe(false);
    expect(manager.hasPending).toBe(false);
  });
});
