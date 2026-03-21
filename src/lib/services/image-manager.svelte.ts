import { SvelteMap } from 'svelte/reactivity';

import type { ImageUploadApiResponse, PendingImage } from '$lib/types/image';

export interface ImageManager {
  readonly hasPending: boolean;
  addImage: (file: File) => string;
  registerImage: (file: File, blobUrl: string) => void;
  removeImage: (blobUrl: string) => void;
  uploadAll: () => Promise<Map<string, string>>;
  cleanup: () => void;
}

/**
 * Manages pending images for upload, providing methods to add, register, remove, and upload images.
 * @returns An ImageManager instance with methods to manage image uploads.
 */
export function createImageManager(): ImageManager {
  const pendingImages = new SvelteMap<string, PendingImage>();

  function addImage(file: File): string {
    const blobUrl = URL.createObjectURL(file);
    pendingImages.set(blobUrl, { file, blobUrl });
    return blobUrl;
  }

  function registerImage(file: File, blobUrl: string): void {
    pendingImages.set(blobUrl, { file, blobUrl });
  }

  function removeImage(blobUrl: string): void {
    if (pendingImages.has(blobUrl)) {
      URL.revokeObjectURL(blobUrl);
      pendingImages.delete(blobUrl);
    }
  }

  async function uploadAll(): Promise<Map<string, string>> {
    // Return value is not reactive state, regular Map is appropriate
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const urlMap = new Map<string, string>();

    for (const [blobUrl, pending] of pendingImages) {
      const formData = new FormData();
      formData.append('file', pending.file);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData,
      });

      const result: ImageUploadApiResponse = await response.json();
      if (result.success && result.data) {
        urlMap.set(blobUrl, result.data.url);
        URL.revokeObjectURL(blobUrl);
      }
    }

    pendingImages.clear();
    return urlMap;
  }

  function cleanup(): void {
    for (const blobUrl of pendingImages.keys()) {
      URL.revokeObjectURL(blobUrl);
    }
    pendingImages.clear();
  }

  return {
    get hasPending() {
      return pendingImages.size > 0;
    },
    addImage,
    registerImage,
    removeImage,
    uploadAll,
    cleanup,
  };
}
