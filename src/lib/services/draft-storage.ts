import type { PendingImage } from '$lib/types/image';

const DB_NAME = 'blog-draft-images';
const DB_VERSION = 1;
const OBJECT_STORE_NAME = 'draft-images';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

async function openDraftDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable())
    throw new Error('IndexedDB is not supported in this environment');

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'blobUrl' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(
        'IndexedDB open blocked; make sure no other tabs are using this DB.',
      );
    };
  });
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
    const trans = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(OBJECT_STORE_NAME);

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
 * Loads all draft images from IndexedDB.
 * @returns A promise that resolves to an array of PendingImage objects.
 */
export async function loadDraftImages(): Promise<Array<PendingImage>> {
  if (!isIndexedDBAvailable()) return [];

  const db = await openDraftDB();

  return new Promise<Array<PendingImage>>((resolve, reject) => {
    const trans = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const objectStore = trans.objectStore(OBJECT_STORE_NAME);

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
    const trans = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const objectStore = trans.objectStore(OBJECT_STORE_NAME);

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
