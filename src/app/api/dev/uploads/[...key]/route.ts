import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { safeEqual } from "@/lib/signing";
import { MAX_PHOTO_BYTES, storage } from "@/lib/storage";
import { localUploadToken, readLocal } from "@/lib/storage/local";

/** Dev-only stand-in for R2 (STORAGE_DRIVER=local). Never active on Vercel. */
function enabled(): boolean {
  return env().STORAGE_DRIVER === "local" && !process.env.VERCEL;
}

export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/dev/uploads/[...key]">,
) {
  if (!enabled()) return jsonError(404, "NOT_FOUND", "Not found");
  const key = (await params).key.join("/");
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const expires = Number(url.searchParams.get("expires"));
  const contentType = request.headers.get("content-type") ?? "";

  if (!Number.isFinite(expires) || expires < Date.now()) {
    return jsonError(403, "EXPIRED", "Upload URL expired");
  }
  if (!safeEqual(token, localUploadToken(key, contentType, expires))) {
    return jsonError(403, "SIGNATURE_MISMATCH", "Invalid upload signature");
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_PHOTO_BYTES) {
    return jsonError(413, "FILE_TOO_LARGE", "File too large");
  }
  await storage().put(key, body, contentType);
  return new NextResponse(null, { status: 200 });
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/dev/uploads/[...key]">,
) {
  if (!enabled()) return jsonError(404, "NOT_FOUND", "Not found");
  const key = (await params).key.join("/");
  const file = await readLocal(key);
  if (!file) return jsonError(404, "NOT_FOUND", "Not found");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": key.endsWith(".webp") ? "image/webp" : "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
