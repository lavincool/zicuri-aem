import "server-only";
import { db } from "@/lib/db/client";
import { uploads } from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";
import { PRESIGN_TTL_SECONDS, storage } from "@/lib/storage";
import type { UploadRequest, UploadTicket } from "../schema";

/** Registers an upload intent and presigns direct-to-storage PUT URLs for the photo and its thumbnail. */
export async function createUpload(
  input: UploadRequest,
  browserHash: string,
  now = new Date(),
): Promise<UploadTicket> {
  const id = prefixedId("upl");
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const base = `reports/${year}/${month}/${id}`;
  const fullKey = `${base}/full.${input.contentType === "image/webp" ? "webp" : "jpg"}`;
  const thumbKey = `${base}/thumb.jpg`;

  await db().insert(uploads).values({
    id,
    fullKey,
    thumbKey,
    contentType: input.contentType,
    declaredBytes: input.bytes,
    browserHash,
    createdAt: now,
  });

  const [full, thumb] = await Promise.all([
    storage().presignPut(fullKey, input.contentType, PRESIGN_TTL_SECONDS),
    storage().presignPut(thumbKey, "image/jpeg", PRESIGN_TTL_SECONDS),
  ]);
  return {
    uploadId: id,
    full: { key: fullKey, ...full },
    thumb: { key: thumbKey, ...thumb },
    expiresAt: new Date(
      now.getTime() + PRESIGN_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}
