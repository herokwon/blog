import type { ApiResponse } from '$lib/types/api';

export interface PendingImage {
  file: File;
  blobUrl: string;
}

export interface ImageUploadData {
  key: string;
  url: string;
}

export type ImageUploadApiResponse = ApiResponse<ImageUploadData>;
