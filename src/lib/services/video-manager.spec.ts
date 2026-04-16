import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVideoManager } from './video-manager';

describe('[Services] video-manager', () => {
  const originalFetch = globalThis.fetch;
  const originalURL = globalThis.URL;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { key: 'test-key', url: '/api/videos/posts/videos/test.mp4' },
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

  it('should track and upload pending videos', async () => {
    const manager = createVideoManager();
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    const blobUrl = 'blob://test-url';

    manager.queueVideo(file, blobUrl);

    expect(blobUrl).toBe('blob://test-url');
    expect(manager.hasPending).toBe(true);
    expect(manager.getPendingVideos()).toHaveLength(1);

    const map = await manager.uploadAll();

    expect(map.get(blobUrl)).toBe('/api/videos/posts/videos/test.mp4');
    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });

  it('should cleanup revokes object URLs and clears pending', () => {
    const manager = createVideoManager();
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    const blobUrl = 'blob://test-url';

    manager.queueVideo(file, blobUrl);
    expect(manager.hasPending).toBe(true);

    manager.cleanup();

    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should register video with existing blob URL', () => {
    const manager = createVideoManager();
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    const existingBlobUrl = 'blob://existing-url';

    manager.queueVideo(file, existingBlobUrl);

    expect(manager.hasPending).toBe(true);
    expect(manager.getPendingVideos()).toHaveLength(1);
    expect(manager.getPendingVideos()[0]).toEqual({
      file,
      blobUrl: existingBlobUrl,
    });
  });

  it('should remove video and revoke blob URL', () => {
    const manager = createVideoManager();
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    const blobUrl = 'blob://test-url';

    manager.queueVideo(file, blobUrl);
    expect(manager.hasPending).toBe(true);

    manager.removeVideo(blobUrl);

    expect(manager.hasPending).toBe(false);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
    expect(manager.getPendingVideos()).toHaveLength(0);
  });

  it('should not fail when removing non-existent video', () => {
    const manager = createVideoManager();

    expect(() => manager.removeVideo('blob://non-existent')).not.toThrow();
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

    const manager = createVideoManager();
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    const blobUrl = 'blob://test-url';

    manager.queueVideo(file, blobUrl);
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
                  url: '/api/videos/posts/videos/test1.mp4',
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

    const manager = createVideoManager();
    const file1 = new File(['content1'], 'test1.mp4', { type: 'video/mp4' });
    const file2 = new File(['content2'], 'test2.mp4', { type: 'video/mp4' });

    const blobUrl1 = 'blob://test-url-1';
    const blobUrl2 = 'blob://test-url-2';

    manager.queueVideo(file1, blobUrl1);
    manager.queueVideo(file2, blobUrl2);

    expect(manager.hasPending).toBe(true);

    const map = await manager.uploadAll();

    expect(map.size).toBe(1);
    expect(map.get(blobUrl1)).toBe('/api/videos/posts/videos/test1.mp4');
    expect(map.has(blobUrl2)).toBe(false);
    expect(manager.hasPending).toBe(false);
  });
});
