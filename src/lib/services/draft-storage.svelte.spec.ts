import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPendingImage } from '$lib/test-utils';
import type { PendingImage } from '$lib/types/image';
import 'fake-indexeddb/auto';

import {
  clearDraftImages,
  createOpenDBExecutor,
  handleUpgradeNeeded,
  loadDraftImages,
  OBJECT_STORE_NAME,
  saveDraftImages,
} from './draft-storage';

// Helper: Delete IndexedDB database
const deleteDB = async (): Promise<void> => {
  // Skip if indexedDB is not available (may be mocked or deleted)
  if (typeof indexedDB === 'undefined') return;

  const dbName = 'blog-draft-images';
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

// Helper: Get all items from IndexedDB
const getAllFromDB = async (): Promise<PendingImage[]> => {
  const dbName = 'blog-draft-images';
  return new Promise<PendingImage[]>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onsuccess = () => {
      const db = request.result;
      const trans = db.transaction(OBJECT_STORE_NAME, 'readonly');
      const store = trans.objectStore(OBJECT_STORE_NAME);
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

      const stored = await getAllFromDB();
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

      const stored = await getAllFromDB();
      expect(stored).toHaveLength(2);
      const fileNames = stored.map(img => img.file.name).sort();
      expect(fileNames).toEqual(['new1.png', 'new2.png']);
    });

    it('should handle empty array', async () => {
      await saveDraftImages([]);

      const stored = await getAllFromDB();
      expect(stored).toHaveLength(0);
    });

    it('should save images with same filename but different blobUrl', async () => {
      const images = [
        createMockPendingImage('test.png', 'content1'),
        createMockPendingImage('test.png', 'content2'),
      ];

      await saveDraftImages(images);

      const stored = await getAllFromDB();
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

      const stored = await getAllFromDB();
      expect(stored).toHaveLength(0);
    });

    it('should handle clearing when no images exist', async () => {
      await clearDraftImages();

      const stored = await getAllFromDB();
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

      // loadDraftImages should return empty array
      const loaded = await loadDraftImages();
      expect(loaded).toEqual([]);

      // clearDraftImages should return without error
      await expect(clearDraftImages()).resolves.toBeUndefined();
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

    it('handleUpgradeNeeded should create object store when it does not exist', () => {
      let createdStoreName = '';
      let createdStoreOptions: IDBObjectStoreParameters | undefined;

      const mockDb = {
        objectStoreNames: {
          contains: () => false,
        },
        createObjectStore: (
          name: string,
          options?: IDBObjectStoreParameters,
        ) => {
          createdStoreName = name;
          createdStoreOptions = options;
          return {} as IDBObjectStore;
        },
      } as unknown as IDBDatabase;

      handleUpgradeNeeded(mockDb);

      expect(createdStoreName).toBe(OBJECT_STORE_NAME);
      expect(createdStoreOptions).toEqual({ keyPath: 'blobUrl' });
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
