import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { sign } from "@/lib/signing";
import type { PhotoStorage } from "./index";

/**
 * Development stand-in for R2: same interface, files under ./.uploads, uploads go
 * through a dev-only route that checks a signed, expiring token (like a presigned URL).
 */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

export function localPath(key: string): string {
  const resolved = path.resolve(LOCAL_UPLOAD_DIR, key);
  if (!resolved.startsWith(`${LOCAL_UPLOAD_DIR}${path.sep}`)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export function localUploadToken(
  key: string,
  contentType: string,
  expiresAt: number,
): string {
  return sign(`${key}|${contentType}|${expiresAt}`);
}

export function localStorageDriver(): PhotoStorage {
  return {
    async presignPut(key, contentType, expiresInSeconds) {
      const expiresAt = Date.now() + expiresInSeconds * 1000;
      const token = localUploadToken(key, contentType, expiresAt);
      const params = new URLSearchParams({
        token,
        expires: String(expiresAt),
      });
      return {
        url: `/api/dev/uploads/${key}?${params}`,
        headers: { "Content-Type": contentType },
      };
    },

    async head(key) {
      try {
        const info = await stat(localPath(key));
        const contentType = key.endsWith(".webp")
          ? "image/webp"
          : key.endsWith(".jpg")
            ? "image/jpeg"
            : null;
        return { bytes: info.size, contentType };
      } catch {
        return null;
      }
    },

    async put(key, body) {
      const file = localPath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },

    async delete(key) {
      await rm(localPath(key), { force: true });
    },
  };
}

export async function readLocal(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}
