import { NextResponse } from "next/server";
import {
  MAX_READINGS_PER_BATCH,
  readingsBodySchema,
} from "@/features/devices/schema";
import { authenticateDevice } from "@/features/devices/server/auth";
import { ingestReadings } from "@/features/devices/server/ingest";
import { DomainError } from "@/lib/errors";
import { jsonError, zodDetails } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const REQUESTS_PER_MINUTE = 120;

/**
 * Device ingestion API (v1). Error codes are designed so firmware can act on them:
 * 400 drop the payload · 401 stop and signal a fault · 403 back off · 413 split the
 * batch · 429 wait Retry-After · 5xx keep the buffer and retry with backoff.
 */
export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);

    const limit = await rateLimit(
      [`device:${device.id}`],
      REQUESTS_PER_MINUTE,
      60,
    );
    if (!limit.allowed) {
      return jsonError(429, "RATE_LIMITED", "Too many requests", undefined, {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "INVALID_JSON", "Body is not valid JSON");
    }
    const parsed = readingsBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        400,
        "INVALID_PAYLOAD",
        "Invalid readings payload",
        zodDetails(parsed.error),
      );
    }
    if (parsed.data.readings.length > MAX_READINGS_PER_BATCH) {
      return jsonError(
        413,
        "BATCH_TOO_LARGE",
        `Send at most ${MAX_READINGS_PER_BATCH} readings per request`,
      );
    }

    const transport =
      request.headers.get("x-cauce-transport") === "simulator"
        ? "simulator"
        : "http";
    return NextResponse.json(
      await ingestReadings(device, parsed.data.readings, { transport }),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return jsonError(error.status, error.code, error.message);
    }
    console.error("Reading ingestion failed", error);
    return jsonError(500, "INTERNAL", "Internal error, retry later");
  }
}
