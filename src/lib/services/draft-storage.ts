import type { PendingImage } from '$lib/types/image';
import type { PendingVideo } from '$lib/types/video';

const DB_NAME = 'blog-draft';
const DB_VERSION = 2;
export const IMAGE_OBJECT_STORE_NAME = 'draft-images';
export const VIDEO_OBJECT_STORE_NAME = 'draft-videos';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/**
 * Handles database upgrade by creating the object store if it doesn't exist.
 * @internal Exported for testing purposes.
 */
export function handleUpgradeNeeded(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(IMAGE_OBJECT_STORE_NAME)) {
    db.createObjectStore(IMAGE_OBJECT_STORE_NAME, { keyPath: 'blobUrl' });
  }

  if (!db.objectStoreNames.contains(VIDEO_OBJECT_STORE_NAME)) {
    db.createObjectStore(VIDEO_OBJECT_STORE_NAME, { keyPath: 'blobUrl' });
  }
}

/**
 * Creates the promise executor for opening the IndexedDB database.
 * @internal Exported for testing purposes.
 */
export function createOpenDBExecutor(
  resolve: (db: IDBDatabase) => void,
  reject: (error: DOMException | null) => void,
): void {
  const request = window.indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => handleUpgradeNeeded(request.result);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => {
    console.warn(
      'IndexedDB open blocked; make sure no other tabs are using this DB.',
    );
  };
}

async function openDraftDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>(createOpenDBExecutor);
}

/**
 * Saves the given draft images to IndexedDB, replacing any existing entries.
 * @param images - An array of PendingImage objects to save.
 * @returns A promise that resolves when the save operation is complete.
 */
export async function saveDraftImages(
  images: Array<PendingImage>,
): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openDraftDB();

  return new Promise<void>((resolve, reject) => {
    const trans = db.transaction(IMAGE_OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(IMAGE_OBJECT_STORE_NAME);

    objectStore.clear();

    for (const image of images) {
      objectStore.put(image);
    }

    trans.oncomplete = () => {
      db.close();
      resolve();
    };
    trans.onerror = () => {
      db.close();
      reject(trans.error);
    };
  });
}

/**
 * Saves the given draft videos to IndexedDB, replacing any existing entries.
 * @param videos - An array of PendingVideo objects to save.
 * @returns A promise that resolves when the save operation is complete.
 */
export async function saveDraftVideos(videos: PendingVideo[]): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openDraftDB();

  return new Promise<void>((resolve, reject) => {
    const trans = db.transaction(VIDEO_OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(VIDEO_OBJECT_STORE_NAME);

    objectStore.clear();

    for (const video of videos) {
      objectStore.put(video);
    }

    trans.oncomplete = () => {
      db.close();
      resolve();
    };
    trans.onerror = () => {
      db.close();
      reject(trans.error);
    };
  });
}

/**
 * Loads all draft images from IndexedDB.
 * @returns A promise that resolves to an array of PendingImage objects.
 */
export async function loadDraftImages(): Promise<Array<PendingImage>> {
  if (!isIndexedDBAvailable()) return [];

  const db = await openDraftDB();

  return new Promise<Array<PendingImage>>((resolve, reject) => {
    const trans = db.transaction(IMAGE_OBJECT_STORE_NAME, 'readonly');
    const objectStore = trans.objectStore(IMAGE_OBJECT_STORE_NAME);

    const request = objectStore.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Loads all draft videos from IndexedDB.
 * @returns A promise that resolves to an array of PendingVideo objects.
 */
export async function loadDraftVideos(): Promise<PendingVideo[]> {
  if (!isIndexedDBAvailable()) return [];

  const db = await openDraftDB();

  return new Promise<PendingVideo[]>((resolve, reject) => {
    const trans = db.transaction(VIDEO_OBJECT_STORE_NAME, 'readonly');
    const objectStore = trans.objectStore(VIDEO_OBJECT_STORE_NAME);

    const request = objectStore.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clears all draft images from IndexedDB.
 * @returns A promise that resolves when the clear operation is complete.
 */
export async function clearDraftImages(): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openDraftDB();

  return new Promise<void>((resolve, reject) => {
    const trans = db.transaction(IMAGE_OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(IMAGE_OBJECT_STORE_NAME);

    const request = objectStore.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clears all draft videos from IndexedDB.
 * @returns A promise that resolves when the clear operation is complete.
 */
export async function clearDraftVideos(): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openDraftDB();

  return new Promise<void>((resolve, reject) => {
    const trans = db.transaction(VIDEO_OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(VIDEO_OBJECT_STORE_NAME);

    const request = objectStore.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Extracts all blob URLs from content (Markdown/HTML).
 * @param content - The content string to analyze.
 * @returns A set of blob URLs found in the content.
 */
export function extractBlobUrlsFromContent(content: string): Set<string> {
  const blobUrlPattern = /blob:[^"'\s)]+/g;
  const matches = content.match(blobUrlPattern) || [];
  return new Set(matches);
}

/**
 * Removes orphaned videos from IndexedDB that are not referenced in content.
 * @param usedBlobUrls - A set of blob URLs that are currently used in content.
 * @returns A promise that resolves when the cleanup is complete.
 */
export async function cleanupOrphanedVideos(
  usedBlobUrls: Set<string>,
): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  const db = await openDraftDB();

  return new Promise<void>((resolve, reject) => {
    const trans = db.transaction(VIDEO_OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(VIDEO_OBJECT_STORE_NAME);

    const request = objectStore.getAll();

    request.onsuccess = () => {
      const allVideos = request.result as PendingVideo[];

      for (const video of allVideos) {
        if (!usedBlobUrls.has(video.blobUrl)) {
          objectStore.delete(video.blobUrl);
        }
      }

      trans.oncomplete = () => {
        db.close();
        resolve();
      };
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };

    trans.onerror = () => {
      db.close();
      reject(trans.error);
    };
  });
}
