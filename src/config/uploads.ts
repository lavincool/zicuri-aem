/** Upload limits shared by the browser pipeline, the API and storage. */
export const MAX_INPUT_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_THUMB_BYTES = 512 * 1024;
export const UPLOAD_MAX_AGE_MS = 60 * 60 * 1000;
export const PHOTO_LONG_EDGE = 1600;
export const THUMB_LONG_EDGE = 480;
export const PHOTO_CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];
