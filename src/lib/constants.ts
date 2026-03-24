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
