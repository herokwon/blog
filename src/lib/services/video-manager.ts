import { SvelteMap } from 'svelte/reactivity';

import type { PendingVideo, VideoUploadApiResponse } from '$lib/types/video';

export interface VideoManager {
  readonly hasPending: boolean;
  queueVideo: (file: File, blobUrl: string) => void;
  removeVideo: (blobUrl: string) => void;
  getPendingVideos: () => Array<PendingVideo>;
  uploadAll: () => Promise<SvelteMap<string, string>>;
  cleanup: () => void;
}

export function createVideoManager(): VideoManager {
  const pendingVideos = new SvelteMap<string, PendingVideo>();

  function queueVideo(file: File, blobUrl: string): void {
    pendingVideos.set(blobUrl, { file, blobUrl });
  }

  function removeVideo(blobUrl: string): void {
    if (pendingVideos.has(blobUrl)) {
      URL.revokeObjectURL(blobUrl);
      pendingVideos.delete(blobUrl);
    }
  }

  function getPendingVideos(): PendingVideo[] {
    return Array.from(pendingVideos.values());
  }

  async function uploadAll(): Promise<SvelteMap<string, string>> {
    const urlMap = new SvelteMap<string, string>();

    for (const [blobUrl, pending] of pendingVideos) {
      const formData = new FormData();
      formData.append('file', pending.file);

      const response = await fetch('/api/videos', {
        method: 'POST',
        body: formData,
      });

      const result: VideoUploadApiResponse = await response.json();
      if (result.success && result.data) {
        urlMap.set(blobUrl, result.data.url);
        URL.revokeObjectURL(blobUrl);
      }
    }

    pendingVideos.clear();
    return urlMap;
  }

  function cleanup(): void {
    for (const blobUrl of pendingVideos.keys()) {
      URL.revokeObjectURL(blobUrl);
    }
    pendingVideos.clear();
  }

  return {
    get hasPending() {
      return pendingVideos.size > 0;
    },
    queueVideo,
    removeVideo,
    uploadAll,
    cleanup,
    getPendingVideos,
  };
}
