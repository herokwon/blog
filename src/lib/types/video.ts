import type { ApiResponse } from './api';
import type { components } from './schema';

export interface PendingVideo {
  file: File;
  blobUrl: string;
}

export type VideoUploadData = components['schemas']['VideoUploadData'];
export type VideoUploadApiResponse = ApiResponse<VideoUploadData>;
