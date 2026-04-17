export const COOKIE_NAME = 'session_id';

export const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const R2_IMAGE_PREFIX = 'posts/images';

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
] as const;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const R2_VIDEO_PREFIX = 'posts/videos';
