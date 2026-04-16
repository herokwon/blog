import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockPendingImage,
  createMockPendingVideo,
} from '$lib/test-utils';
import type { PendingImage } from '$lib/types/image';
import type { PendingVideo } from '$lib/types/video';
import 'fake-indexeddb/auto';

import {
  cleanupOrphanedVideos,
  clearDraftImages,
  clearDraftVideos,
  createOpenDBExecutor,
  extractBlobUrlsFromContent,
  handleUpgradeNeeded,
  IMAGE_OBJECT_STORE_NAME,
  loadDraftImages,
  loadDraftVideos,
  saveDraftImages,
  saveDraftVideos,
  VIDEO_OBJECT_STORE_NAME,
} from './draft-storage';

// Helper: Delete IndexedDB database
const deleteDB = async (): Promise<void> => {
  // Skip if indexedDB is not available (may be mocked or deleted)
  if (typeof indexedDB === 'undefined') return;

  const dbName = 'blog-draft';
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('Delete blocked; closing all connections may help');
      resolve();
    };
  });
};

// Helper: Get all items from IndexedDB (images)
const getAllImagesFromDB = async (): Promise<PendingImage[]> => {
  const dbName = 'blog-draft';
  return new Promise<PendingImage[]>((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onsuccess = () => {
      const db = request.result;
      const trans = db.transaction(IMAGE_OBJECT_STORE_NAME, 'readonly');
      const store = trans.objectStore(IMAGE_OBJECT_STORE_NAME);
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(getAll.result as PendingImage[]);
      };
      getAll.onerror = () => {
        db.close();
        reject(getAll.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
};

// Helper: Get all items from IndexedDB (videos)
const getAllVideosFromDB = async (): Promise<PendingVideo[]> => {
  const dbName = 'blog-draft';
  return new Promise<PendingVideo[]>((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onsuccess = () => {
      const db = request.result;
      const trans = db.transaction(VIDEO_OBJECT_STORE_NAME, 'readonly');
      const store = trans.objectStore(VIDEO_OBJECT_STORE_NAME);
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(getAll.result as PendingVideo[]);
      };
      getAll.onerror = () => {
        db.close();
        reject(getAll.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
};

describe('[Services] draft-storage', () => {
  beforeEach(async () => {
    await deleteDB();
  });

  afterEach(async () => {
    await deleteDB();
  });

  describe('saveDraftImages', () => {
    it('should save draft images to IndexedDB', async () => {
      const images = [
        createMockPendingImage('image1.png'),
        createMockPendingImage('image2.png'),
      ];

      await saveDraftImages(images);

      const stored = await getAllImagesFromDB();
      expect(stored).toHaveLength(2);
      const fileNames = stored.map(img => img.file.name).sort();
      expect(fileNames).toEqual(['image1.png', 'image2.png']);
    });

    it('should replace existing images when saving', async () => {
      const firstBatch = [createMockPendingImage('old.png')];
      const secondBatch = [
        createMockPendingImage('new1.png'),
        createMockPendingImage('new2.png'),
      ];

      await saveDraftImages(firstBatch);
      await saveDraftImages(secondBatch);

      const stored = await getAllImagesFromDB();
      expect(stored).toHaveLength(2);
      const fileNames = stored.map(img => img.file.name).sort();
      expect(fileNames).toEqual(['new1.png', 'new2.png']);
    });

    it('should handle empty array', async () => {
      await saveDraftImages([]);

      const stored = await getAllImagesFromDB();
      expect(stored).toHaveLength(0);
    });

    it('should save images with same filename but different blobUrl', async () => {
      const images = [
        createMockPendingImage('test.png', 'content1'),
        createMockPendingImage('test.png', 'content2'),
      ];

      await saveDraftImages(images);

      const stored = await getAllImagesFromDB();
      expect(stored).toHaveLength(2);
      expect(stored[0].blobUrl).not.toBe(stored[1].blobUrl);
    });
  });

  describe('loadDraftImages', () => {
    it('should load saved draft images', async () => {
      const images = [
        createMockPendingImage('image1.png'),
        createMockPendingImage('image2.png'),
      ];

      await saveDraftImages(images);
      const loaded = await loadDraftImages();

      expect(loaded).toHaveLength(2);
      const fileNames = loaded.map(img => img.file.name).sort();
      expect(fileNames).toEqual(['image1.png', 'image2.png']);
    });

    it('should return empty array when no images saved', async () => {
      const loaded = await loadDraftImages();

      expect(loaded).toHaveLength(0);
    });

    it('should preserve file properties', async () => {
      const file = new File(['test content'], 'test.png', {
        type: 'image/png',
      });
      const blobUrl = URL.createObjectURL(file);
      const image = { file, blobUrl };

      await saveDraftImages([image]);
      const loaded = await loadDraftImages();

      expect(loaded[0].file.name).toBe('test.png');
      expect(loaded[0].file.type).toBe('image/png');
      expect(loaded[0].blobUrl).toBe(blobUrl);
    });
  });

  describe('clearDraftImages', () => {
    it('should clear all draft images', async () => {
      const images = [
        createMockPendingImage('image1.png'),
        createMockPendingImage('image2.png'),
      ];

      await saveDraftImages(images);
      await clearDraftImages();

      const stored = await getAllImagesFromDB();
      expect(stored).toHaveLength(0);
    });

    it('should handle clearing when no images exist', async () => {
      await clearDraftImages();

      const stored = await getAllImagesFromDB();
      expect(stored).toHaveLength(0);
    });
  });

  describe('saveDraftVideos', () => {
    it('should save draft videos to IndexedDB', async () => {
      const videos = [
        createMockPendingVideo('video1.mp4'),
        createMockPendingVideo('video2.mp4'),
      ];

      await saveDraftVideos(videos);

      const stored = await getAllVideosFromDB();
      expect(stored).toHaveLength(2);
      const fileNames = stored.map(video => video.file.name).sort();
      expect(fileNames).toEqual(['video1.mp4', 'video2.mp4']);
    });

    it('should replace existing videos when saving', async () => {
      const firstBatch = [createMockPendingVideo('old.mp4')];
      const secondBatch = [
        createMockPendingVideo('new1.mp4'),
        createMockPendingVideo('new2.mp4'),
      ];

      await saveDraftVideos(firstBatch);
      await saveDraftVideos(secondBatch);

      const stored = await getAllVideosFromDB();
      expect(stored).toHaveLength(2);
      const fileNames = stored.map(video => video.file.name).sort();
      expect(fileNames).toEqual(['new1.mp4', 'new2.mp4']);
    });

    it('should handle empty array', async () => {
      await saveDraftVideos([]);

      const stored = await getAllVideosFromDB();
      expect(stored).toHaveLength(0);
    });

    it('should save videos with same filename but different blobUrl', async () => {
      const videos = [
        createMockPendingVideo('test.mp4', 'content1'),
        createMockPendingVideo('test.mp4', 'content2'),
      ];

      await saveDraftVideos(videos);

      const stored = await getAllVideosFromDB();
      expect(stored).toHaveLength(2);
      expect(stored[0].blobUrl).not.toBe(stored[1].blobUrl);
    });
  });

  describe('loadDraftVideos', () => {
    it('should load saved draft videos', async () => {
      const videos = [
        createMockPendingVideo('video1.mp4'),
        createMockPendingVideo('video2.mp4'),
      ];

      await saveDraftVideos(videos);
      const loaded = await loadDraftVideos();

      expect(loaded).toHaveLength(2);
      const fileNames = loaded.map(video => video.file.name).sort();
      expect(fileNames).toEqual(['video1.mp4', 'video2.mp4']);
    });

    it('should return empty array when no videos saved', async () => {
      const loaded = await loadDraftVideos();

      expect(loaded).toHaveLength(0);
    });

    it('should preserve file properties', async () => {
      const file = new File(['test content'], 'test.mp4', {
        type: 'video/mp4',
      });
      const blobUrl = URL.createObjectURL(file);
      const video = { file, blobUrl };

      await saveDraftVideos([video]);
      const loaded = await loadDraftVideos();

      expect(loaded[0].file.name).toBe('test.mp4');
      expect(loaded[0].file.type).toBe('video/mp4');
      expect(loaded[0].blobUrl).toBe(blobUrl);
    });
  });

  describe('clearDraftVideos', () => {
    it('should clear all draft videos', async () => {
      const videos = [
        createMockPendingVideo('video1.mp4'),
        createMockPendingVideo('video2.mp4'),
      ];

      await saveDraftVideos(videos);
      await clearDraftVideos();

      const stored = await getAllVideosFromDB();
      expect(stored).toHaveLength(0);
    });

    it('should handle clearing when no videos exist', async () => {
      await clearDraftVideos();

      const stored = await getAllVideosFromDB();
      expect(stored).toHaveLength(0);
    });
  });

  describe('integration', () => {
    it('should support save-load-clear workflow', async () => {
      const images = [createMockPendingImage('workflow.png')];

      await saveDraftImages(images);
      const loaded = await loadDraftImages();
      expect(loaded).toHaveLength(1);

      await clearDraftImages();
      const afterClear = await loadDraftImages();
      expect(afterClear).toHaveLength(0);
    });

    it('should handle multiple save operations', async () => {
      await saveDraftImages([createMockPendingImage('first.png')]);
      await saveDraftImages([createMockPendingImage('second.png')]);
      await saveDraftImages([createMockPendingImage('third.png')]);

      const loaded = await loadDraftImages();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].file.name).toBe('third.png');
    });

    it('should support save-load-clear workflow for videos', async () => {
      const videos = [createMockPendingVideo('workflow.mp4')];

      await saveDraftVideos(videos);
      const loaded = await loadDraftVideos();
      expect(loaded).toHaveLength(1);

      await clearDraftVideos();
      const afterClear = await loadDraftVideos();
      expect(afterClear).toHaveLength(0);
    });

    it('should independently manage images and videos in the same database', async () => {
      const images = [
        createMockPendingImage('image.png'),
        createMockPendingImage('image2.png'),
      ];
      const videos = [
        createMockPendingVideo('video.mp4'),
        createMockPendingVideo('video2.mp4'),
      ];

      await saveDraftImages(images);
      await saveDraftVideos(videos);

      const loadedImages = await loadDraftImages();
      const loadedVideos = await loadDraftVideos();

      expect(loadedImages).toHaveLength(2);
      expect(loadedVideos).toHaveLength(2);

      await clearDraftImages();

      const imagesAfterClear = await loadDraftImages();
      const videosAfterClear = await loadDraftVideos();

      expect(imagesAfterClear).toHaveLength(0);
      expect(videosAfterClear).toHaveLength(2);
    });
  });

  describe('extractBlobUrlsFromContent', () => {
    it('should extract single blob URL from content', () => {
      const content =
        'Here is a video: ![video](blob:http://localhost:8000/abc123)';
      const urls = extractBlobUrlsFromContent(content);

      expect(urls.size).toBe(1);
      expect(urls).toContain('blob:http://localhost:8000/abc123');
    });

    it('should extract multiple blob URLs from content', () => {
      const content = `
        ![image](blob:http://localhost:8000/img1)
        ![video](blob:http://localhost:8000/vid1)
        Some text
        ![another](blob:http://localhost:8000/img2)
      `;
      const urls = extractBlobUrlsFromContent(content);

      expect(urls.size).toBe(3);
      expect(urls).toContain('blob:http://localhost:8000/img1');
      expect(urls).toContain('blob:http://localhost:8000/vid1');
      expect(urls).toContain('blob:http://localhost:8000/img2');
    });

    it('should return empty set when no blob URLs found', () => {
      const content = 'Regular content without any blob URLs';
      const urls = extractBlobUrlsFromContent(content);

      expect(urls.size).toBe(0);
    });

    it('should handle duplicate blob URLs', () => {
      const content =
        '![img](blob:http://localhost:8000/same) and ![img2](blob:http://localhost:8000/same)';
      const urls = extractBlobUrlsFromContent(content);

      // Set should deduplicate
      expect(urls.size).toBe(1);
      expect(urls).toContain('blob:http://localhost:8000/same');
    });

    it('should extract blob URLs with different formats', () => {
      const content = `
        blob:https://example.com/12345
        blob:http://localhost/abcdef
        blob:file:///path/ghijkl
      `;
      const urls = extractBlobUrlsFromContent(content);

      expect(urls.size).toBe(3);
    });

    it('should handle empty content', () => {
      const urls = extractBlobUrlsFromContent('');
      expect(urls.size).toBe(0);
    });
  });

  describe('cleanupOrphanedVideos', () => {
    it('should remove videos not referenced in content', async () => {
      const video1 = createMockPendingVideo('keep.mp4');
      const video2 = createMockPendingVideo('delete.mp4');

      await saveDraftVideos([video1, video2]);

      // Only video1's blobUrl is "used"
      const usedUrls = new Set([video1.blobUrl]);
      await cleanupOrphanedVideos(usedUrls);

      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].blobUrl).toBe(video1.blobUrl);
    });

    it('should keep all videos when all are referenced', async () => {
      const video1 = createMockPendingVideo('video1.mp4');
      const video2 = createMockPendingVideo('video2.mp4');
      const video3 = createMockPendingVideo('video3.mp4');

      await saveDraftVideos([video1, video2, video3]);

      const usedUrls = new Set([
        video1.blobUrl,
        video2.blobUrl,
        video3.blobUrl,
      ]);
      await cleanupOrphanedVideos(usedUrls);

      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(3);
    });

    it('should remove all videos when none are referenced', async () => {
      const video1 = createMockPendingVideo('video1.mp4');
      const video2 = createMockPendingVideo('video2.mp4');

      await saveDraftVideos([video1, video2]);

      const usedUrls = new Set<string>();
      await cleanupOrphanedVideos(usedUrls);

      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(0);
    });

    it('should handle cleanup when no videos exist', async () => {
      const usedUrls = new Set(['blob:http://localhost/any-url']);

      // Should not throw
      await expect(cleanupOrphanedVideos(usedUrls)).resolves.toBeUndefined();

      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(0);
    });

    it('should only remove specific orphaned videos', async () => {
      const videos = [
        createMockPendingVideo('keep1.mp4'),
        createMockPendingVideo('remove1.mp4'),
        createMockPendingVideo('keep2.mp4'),
        createMockPendingVideo('remove2.mp4'),
      ];

      await saveDraftVideos(videos);

      const usedUrls = new Set([videos[0].blobUrl, videos[2].blobUrl]);
      await cleanupOrphanedVideos(usedUrls);

      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(2);
      expect(remaining.map(v => v.blobUrl)).toContain(videos[0].blobUrl);
      expect(remaining.map(v => v.blobUrl)).toContain(videos[2].blobUrl);
    });
  });

  describe('integration: extractBlobUrlsFromContent + cleanupOrphanedVideos', () => {
    it('should clean up orphaned videos based on content', async () => {
      // Create multiple videos
      const video1 = createMockPendingVideo('used.mp4');
      const video2 = createMockPendingVideo('orphaned.mp4');

      await saveDraftVideos([video1, video2]);

      // Simulate content that only references video1
      const content = `
        # My Post
        Here's a video: ![video](${video1.blobUrl})
      `;

      // Extract used URLs and cleanup
      const usedUrls = extractBlobUrlsFromContent(content);
      await cleanupOrphanedVideos(usedUrls);

      // Only video1 should remain
      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].blobUrl).toBe(video1.blobUrl);
    });

    it('should preserve multiple referenced videos', async () => {
      const video1 = createMockPendingVideo('video1.mp4');
      const video2 = createMockPendingVideo('video2.mp4');
      const video3 = createMockPendingVideo('video3.mp4');

      await saveDraftVideos([video1, video2, video3]);

      // Content references video1 and video2
      const content = `
        First: ![v1](${video1.blobUrl})
        Second: ![v2](${video2.blobUrl})
      `;

      const usedUrls = extractBlobUrlsFromContent(content);
      await cleanupOrphanedVideos(usedUrls);

      const remaining = await getAllVideosFromDB();
      expect(remaining).toHaveLength(2);
      const remainingBlobUrls = remaining.map(v => v.blobUrl);
      expect(remainingBlobUrls).toContain(video1.blobUrl);
      expect(remainingBlobUrls).toContain(video2.blobUrl);
    });
  });

  describe('error handling', () => {
    // Save original indexedDB reference for restoration
    let originalIndexedDB: IDBFactory;

    beforeEach(() => {
      originalIndexedDB = window.indexedDB;
    });

    afterEach(async () => {
      // Restore indexedDB to both window and globalThis
      (window as { indexedDB?: IDBFactory }).indexedDB = originalIndexedDB;
      (globalThis as { indexedDB?: IDBFactory }).indexedDB = originalIndexedDB;
    });

    it('should return early when IndexedDB is not available', async () => {
      // Remove indexedDB from window
      delete (window as { indexedDB?: IDBFactory }).indexedDB;

      // saveDraftImages should return without error (early return)
      await expect(
        saveDraftImages([createMockPendingImage('test.png')]),
      ).resolves.toBeUndefined();

      // saveDraftVideos should return without error (early return)
      await expect(
        saveDraftVideos([createMockPendingVideo('test.mp4')]),
      ).resolves.toBeUndefined();

      // loadDraftImages should return empty array
      const loadedImages = await loadDraftImages();
      expect(loadedImages).toEqual([]);

      // loadDraftVideos should return empty array
      const loadedVideos = await loadDraftVideos();
      expect(loadedVideos).toEqual([]);

      // clearDraftImages should return without error
      await expect(clearDraftImages()).resolves.toBeUndefined();

      // clearDraftVideos should return without error
      await expect(clearDraftVideos()).resolves.toBeUndefined();
    });

    it('should handle concurrent save operations gracefully', async () => {
      const batch1 = [createMockPendingImage('concurrent1.png')];
      const batch2 = [createMockPendingImage('concurrent2.png')];
      const batch3 = [createMockPendingImage('concurrent3.png')];

      // Fire all saves in parallel
      await Promise.all([
        saveDraftImages(batch1),
        saveDraftImages(batch2),
        saveDraftImages(batch3),
      ]);

      // One of them should have won
      const loaded = await loadDraftImages();
      expect(loaded).toHaveLength(1);
      expect([
        'concurrent1.png',
        'concurrent2.png',
        'concurrent3.png',
      ]).toContain(loaded[0].file.name);
    });

    it('should reject when database open fails', async () => {
      const originalOpen = indexedDB.open;
      indexedDB.open = function () {
        const request = {} as IDBOpenDBRequest;
        setTimeout(() => {
          Object.defineProperty(request, 'error', {
            value: new Error('Database open failed'),
          });
          if (request.onerror) request.onerror(new Event('error'));
        }, 0);
        return request;
      };

      await expect(
        saveDraftImages([createMockPendingImage('test.png')]),
      ).rejects.toThrow();

      indexedDB.open = originalOpen;
    });

    it('should reject when transaction fails during save', async () => {
      const originalOpen = indexedDB.open;

      // Create a fully mocked IndexedDB that triggers transaction error
      indexedDB.open = function () {
        const request = {} as IDBOpenDBRequest;

        setTimeout(() => {
          const mockTransaction: {
            objectStore: () => { clear: () => object; put: () => object };
            oncomplete: ((ev: Event) => void) | null;
            onerror: ((ev: Event) => void) | null;
            error: DOMException | null;
          } = {
            objectStore: () => ({
              clear: () => ({}),
              put: () => ({}),
            }),
            oncomplete: null,
            onerror: null,
            error: null,
          };

          const mockDb = {
            transaction: () => mockTransaction,
            close: () => {},
          };

          Object.defineProperty(request, 'result', { value: mockDb });
          if (request.onsuccess) request.onsuccess(new Event('success'));

          // Trigger transaction error after handlers are set
          setTimeout(() => {
            mockTransaction.error = new DOMException('Transaction failed');
            if (mockTransaction.onerror) {
              mockTransaction.onerror(new Event('error'));
            }
          }, 5);
        }, 0);

        return request;
      };

      await expect(
        saveDraftImages([createMockPendingImage('error.png')]),
      ).rejects.toBeDefined();

      indexedDB.open = originalOpen;
    });

    it('should reject when getAll fails during load', async () => {
      const originalOpen = indexedDB.open;

      indexedDB.open = function (): IDBOpenDBRequest {
        const request = {} as IDBOpenDBRequest;

        setTimeout(() => {
          const mockGetAllRequest: {
            onsuccess: ((ev: Event) => void) | null;
            onerror: ((ev: Event) => void) | null;
            error: DOMException | null;
            result: PendingImage[];
          } = {
            onsuccess: null,
            onerror: null,
            error: null,
            result: [],
          };

          const mockTransaction = {
            objectStore: () => ({
              getAll: () => {
                // Trigger error after handler is set
                setTimeout(() => {
                  mockGetAllRequest.error = new DOMException('getAll failed');
                  if (mockGetAllRequest.onerror) {
                    mockGetAllRequest.onerror(new Event('error'));
                  }
                }, 5);
                return mockGetAllRequest;
              },
            }),
          };

          const mockDb = {
            transaction: () => mockTransaction,
            close: () => {},
          };

          Object.defineProperty(request, 'result', { value: mockDb });
          if (request.onsuccess) request.onsuccess(new Event('success'));
        }, 0);

        return request;
      };

      await expect(loadDraftImages()).rejects.toBeDefined();

      indexedDB.open = originalOpen;
    });

    it('should reject when clear fails', async () => {
      const originalOpen = indexedDB.open;

      indexedDB.open = function (): IDBOpenDBRequest {
        const request = {} as IDBOpenDBRequest;

        setTimeout(() => {
          const mockClearRequest: {
            onsuccess: ((ev: Event) => void) | null;
            onerror: ((ev: Event) => void) | null;
            error: DOMException | null;
          } = {
            onsuccess: null,
            onerror: null,
            error: null,
          };

          const mockTransaction = {
            objectStore: () => ({
              clear: () => {
                // Trigger error after handler is set
                setTimeout(() => {
                  mockClearRequest.error = new DOMException('clear failed');
                  if (mockClearRequest.onerror) {
                    mockClearRequest.onerror(new Event('error'));
                  }
                }, 5);
                return mockClearRequest;
              },
            }),
          };

          const mockDb = {
            transaction: () => mockTransaction,
            close: () => {},
          };

          Object.defineProperty(request, 'result', { value: mockDb });
          if (request.onsuccess) request.onsuccess(new Event('success'));
        }, 0);

        return request;
      };

      await expect(clearDraftImages()).rejects.toBeDefined();

      indexedDB.open = originalOpen;
    });

    it('should create object store via onupgradeneeded when database is first opened', async () => {
      // Delete DB to force onupgradeneeded to run
      await deleteDB();

      // Save images - this will trigger onupgradeneeded internally
      await saveDraftImages([createMockPendingImage('upgrade-test.png')]);

      // Verify save was successful (proves onupgradeneeded ran and created store)
      const loaded = await loadDraftImages();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].file.name).toBe('upgrade-test.png');
    });

    it('should create object stores for both images and videos via onupgradeneeded', async () => {
      // Delete DB to force onupgradeneeded to run
      await deleteDB();

      // Save videos - this will trigger onupgradeneeded internally
      await saveDraftVideos([createMockPendingVideo('upgrade-test.mp4')]);

      // Verify save was successful (proves onupgradeneeded ran and created store)
      const loaded = await loadDraftVideos();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].file.name).toBe('upgrade-test.mp4');
    });

    it('handleUpgradeNeeded should create object store when it does not exist', () => {
      const createdStoreNames: string[] = [];
      const createdStoreOptions: IDBObjectStoreParameters[] = [];

      const mockDb = {
        objectStoreNames: {
          contains: () => false,
        },
        createObjectStore: (
          name: string,
          options?: IDBObjectStoreParameters,
        ) => {
          createdStoreNames.push(name);
          if (options) createdStoreOptions.push(options);
          return {} as IDBObjectStore;
        },
      } as unknown as IDBDatabase;

      handleUpgradeNeeded(mockDb);

      expect(createdStoreNames).toContain(IMAGE_OBJECT_STORE_NAME);
      expect(createdStoreNames).toContain(VIDEO_OBJECT_STORE_NAME);
      expect(createdStoreOptions).toHaveLength(2);
      createdStoreOptions.forEach(options => {
        expect(options).toEqual({ keyPath: 'blobUrl' });
      });
    });

    it('handleUpgradeNeeded should not create object store when it already exists', () => {
      let createObjectStoreCalled = false;

      const mockDb = {
        objectStoreNames: {
          contains: () => true,
        },
        createObjectStore: () => {
          createObjectStoreCalled = true;
          return {} as IDBObjectStore;
        },
      } as unknown as IDBDatabase;

      handleUpgradeNeeded(mockDb);

      expect(createObjectStoreCalled).toBe(false);
    });

    it('createOpenDBExecutor should call resolve on success', async () => {
      const result = await new Promise<IDBDatabase>((resolve, reject) => {
        createOpenDBExecutor(resolve, reject);
      });

      expect(result).toBeDefined();
      expect(typeof result.close).toBe('function');
      result.close();
    });

    it('should reject when transaction fails during save', async () => {
      const originalOpen = indexedDB.open;

      // Create a fully mocked IndexedDB that triggers transaction error
      indexedDB.open = function () {
        const request = {} as IDBOpenDBRequest;

        setTimeout(() => {
          const mockTransaction: {
            objectStore: () => { clear: () => object; put: () => object };
            oncomplete: ((ev: Event) => void) | null;
            onerror: ((ev: Event) => void) | null;
            error: DOMException | null;
          } = {
            objectStore: () => ({
              clear: () => ({}),
              put: () => ({}),
            }),
            oncomplete: null,
            onerror: null,
            error: null,
          };

          const mockDb = {
            transaction: () => mockTransaction,
            close: () => {},
          };

          Object.defineProperty(request, 'result', { value: mockDb });
          if (request.onsuccess) request.onsuccess(new Event('success'));

          // Trigger transaction error after handlers are set
          setTimeout(() => {
            mockTransaction.error = new DOMException('Transaction failed');
            if (mockTransaction.onerror) {
              mockTransaction.onerror(new Event('error'));
            }
          }, 5);
        }, 0);

        return request;
      };

      await expect(
        saveDraftVideos([createMockPendingVideo('error.mp4')]),
      ).rejects.toBeDefined();

      indexedDB.open = originalOpen;
    });

    it('should reject when getAll fails during video load', async () => {
      const originalOpen = indexedDB.open;

      indexedDB.open = function (): IDBOpenDBRequest {
        const request = {} as IDBOpenDBRequest;

        setTimeout(() => {
          const mockGetAllRequest: {
            onsuccess: ((ev: Event) => void) | null;
            onerror: ((ev: Event) => void) | null;
            error: DOMException | null;
            result: PendingVideo[];
          } = {
            onsuccess: null,
            onerror: null,
            error: null,
            result: [],
          };

          const mockTransaction = {
            objectStore: () => ({
              getAll: () => {
                // Trigger error after handler is set
                setTimeout(() => {
                  mockGetAllRequest.error = new DOMException('getAll failed');
                  if (mockGetAllRequest.onerror) {
                    mockGetAllRequest.onerror(new Event('error'));
                  }
                }, 5);
                return mockGetAllRequest;
              },
            }),
          };

          const mockDb = {
            transaction: () => mockTransaction,
            close: () => {},
          };

          Object.defineProperty(request, 'result', { value: mockDb });
          if (request.onsuccess) request.onsuccess(new Event('success'));
        }, 0);

        return request;
      };

      await expect(loadDraftVideos()).rejects.toBeDefined();

      indexedDB.open = originalOpen;
    });

    it('should reject when clear fails for videos', async () => {
      const originalOpen = indexedDB.open;

      indexedDB.open = function (): IDBOpenDBRequest {
        const request = {} as IDBOpenDBRequest;

        setTimeout(() => {
          const mockClearRequest: {
            onsuccess: ((ev: Event) => void) | null;
            onerror: ((ev: Event) => void) | null;
            error: DOMException | null;
          } = {
            onsuccess: null,
            onerror: null,
            error: null,
          };

          const mockTransaction = {
            objectStore: () => ({
              clear: () => {
                // Trigger error after handler is set
                setTimeout(() => {
                  mockClearRequest.error = new DOMException('clear failed');
                  if (mockClearRequest.onerror) {
                    mockClearRequest.onerror(new Event('error'));
                  }
                }, 5);
                return mockClearRequest;
              },
            }),
          };

          const mockDb = {
            transaction: () => mockTransaction,
            close: () => {},
          };

          Object.defineProperty(request, 'result', { value: mockDb });
          if (request.onsuccess) request.onsuccess(new Event('success'));
        }, 0);

        return request;
      };

      await expect(clearDraftVideos()).rejects.toBeDefined();

      indexedDB.open = originalOpen;
    });

    it('should log warning when onblocked is triggered', async () => {
      const originalOpen = indexedDB.open;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a mock that triggers onblocked before onsuccess
      indexedDB.open = function (
        this: IDBFactory,
        name: string,
        version?: number,
      ) {
        const realRequest = originalOpen.call(this, name, version);

        // Store handlers
        let onSuccessHandler: ((ev: Event) => void) | null = null;
        let onBlockedHandler: ((ev: Event) => void) | null = null;
        let onUpgradeHandler: ((ev: Event) => void) | null = null;
        let onErrorHandler: ((ev: Event) => void) | null = null;

        const mockRequest = {
          get result() {
            return realRequest.result;
          },
          get error() {
            return realRequest.error;
          },
          set onsuccess(fn: ((ev: Event) => void) | null) {
            onSuccessHandler = fn;
          },
          get onsuccess() {
            return onSuccessHandler;
          },
          set onerror(fn: ((ev: Event) => void) | null) {
            onErrorHandler = fn;
          },
          get onerror() {
            return onErrorHandler;
          },
          set onupgradeneeded(fn: ((ev: Event) => void) | null) {
            onUpgradeHandler = fn;
          },
          get onupgradeneeded() {
            return onUpgradeHandler;
          },
          set onblocked(fn: ((ev: Event) => void) | null) {
            onBlockedHandler = fn;
          },
          get onblocked() {
            return onBlockedHandler;
          },
        } as IDBOpenDBRequest;

        // When real request succeeds, trigger onblocked first then onsuccess
        realRequest.onsuccess = () => {
          if (onBlockedHandler) {
            onBlockedHandler.call(mockRequest, new Event('blocked'));
          }
          if (onSuccessHandler) {
            onSuccessHandler.call(mockRequest, new Event('success'));
          }
        };

        realRequest.onupgradeneeded = event => {
          if (onUpgradeHandler) {
            onUpgradeHandler.call(mockRequest, event);
          }
        };

        realRequest.onerror = () => {
          if (onErrorHandler) {
            onErrorHandler.call(mockRequest, new Event('error'));
          }
        };

        return mockRequest;
      } as typeof indexedDB.open;

      try {
        await saveDraftImages([createMockPendingImage('blocked-test.png')]);
        expect(warnSpy).toHaveBeenCalledWith(
          'IndexedDB open blocked; make sure no other tabs are using this DB.',
        );
      } finally {
        indexedDB.open = originalOpen;
        warnSpy.mockRestore();
      }
    });
  });
});
