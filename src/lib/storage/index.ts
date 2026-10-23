import "server-only";
import { env } from "@/lib/env";
import { localStorageDriver } from "./local";
import { r2StorageDriver } from "./r2";

export type PresignedPut = {
  url: string;
  /** Headers the browser must send with the PUT (Content-Type is signed). */
  headers: Record<string, string>;
};

export type StoredObject = { bytes: number; contentType: string | null };

/** Photo storage. Browsers upload directly to the presigned URL; bytes never pass through Next.js on R2. */
export type PhotoStorage = {
  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<PresignedPut>;
  head(key: string): Promise<StoredObject | null>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
};

export const PRESIGN_TTL_SECONDS = 5 * 60;
export { MAX_PHOTO_BYTES, MAX_THUMB_BYTES } from "@/config/uploads";

let cached: PhotoStorage | undefined;

export function storage(): PhotoStorage {
  cached ??=
    env().STORAGE_DRIVER === "r2" ? r2StorageDriver() : localStorageDriver();
  return cached;
}
