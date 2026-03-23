import type { ApiResponse } from '$lib/types/api';

import type { components } from './schema';

export interface PendingImage {
  file: File;
  blobUrl: string;
}

export type ImageUploadData = components['schemas']['ImageUploadData'];

export type ImageUploadApiResponse = ApiResponse<ImageUploadData>;
