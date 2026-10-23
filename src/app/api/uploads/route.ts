import { NextResponse } from "next/server";
import { uploadRequestSchema } from "@/features/reports/schema";
import { createUpload } from "@/features/reports/server/uploads";
import { jsonError, zodDetails } from "@/lib/http";
import { getBrowserHash, getIpHash } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";

const UPLOADS_PER_HOUR = 20;

export async function POST(request: Request) {
  const browserHash = await getBrowserHash();
  if (!browserHash) {
    return jsonError(401, "NO_BROWSER_ID", "Missing browser identity");
  }
  const parsed = uploadRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const tooLarge = parsed.error.issues.some((i) => i.code === "too_big");
    return jsonError(
      tooLarge ? 413 : 400,
      tooLarge ? "FILE_TOO_LARGE" : "INVALID_PAYLOAD",
      "Invalid upload request",
      zodDetails(parsed.error),
    );
  }

  const limit = await rateLimit(
    [`upload:ip:${await getIpHash()}`, `upload:browser:${browserHash}`],
    UPLOADS_PER_HOUR,
    3600,
  );
  if (!limit.allowed) {
    return jsonError(429, "RATE_LIMITED", "Too many uploads", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const ticket = await createUpload(parsed.data, browserHash);
  return NextResponse.json(ticket, { status: 201 });
}
