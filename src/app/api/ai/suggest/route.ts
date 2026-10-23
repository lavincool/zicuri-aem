import { NextResponse } from "next/server";
import { suggestRequestSchema } from "@/features/ai/schema";
import { aiEnabled, suggestCategory } from "@/features/ai/server/suggest";
import { DomainError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { getBrowserHash, getIpHash } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";

const SUGGESTIONS_PER_HOUR = 20;

/**
 * AI category suggestion for an uploaded photo. 204 means "no suggestion" (disabled,
 * timed out, or the model failed); the report flow simply carries on without it.
 */
export async function POST(request: Request) {
  if (!aiEnabled()) return new NextResponse(null, { status: 204 });
  const browserHash = await getBrowserHash();
  if (!browserHash) {
    return jsonError(401, "NO_BROWSER_ID", "Missing browser identity");
  }
  const parsed = suggestRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(400, "INVALID_PAYLOAD", "uploadId is required");
  }
  try {
    const limit = await rateLimit(
      [`ai:browser:${browserHash}`, `ai:ip:${await getIpHash()}`],
      SUGGESTIONS_PER_HOUR,
      3600,
    );
    if (!limit.allowed) return new NextResponse(null, { status: 204 });
    return NextResponse.json(
      await suggestCategory(parsed.data.uploadId, browserHash, request.signal),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return jsonError(error.status, error.code, error.message);
    }
    // Avoid logging SDK error bodies, which can include the uploaded image.
    console.warn("AI suggestion unavailable", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return new NextResponse(null, { status: 204 });
  }
}
