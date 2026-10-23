import { after, type NextRequest, NextResponse } from "next/server";
import {
  createReportSchema,
  reportsQuerySchema,
} from "@/features/reports/schema";
import { sweepExpiredReports } from "@/features/reports/server/commands";
import {
  createReport,
  findReportByClientRequestId,
  toCreatedReport,
  updateReportPlace,
} from "@/features/reports/server/create-report";
import { listReportFeatures } from "@/features/reports/server/queries";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { reverseGeocode } from "@/lib/geocode";
import { jsonError, zodDetails } from "@/lib/http";
import { getBrowserHash, getIpHash } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const parsed = reportsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_QUERY",
      "Invalid report query",
      zodDetails(parsed.error),
    );
  }
  const collection = await listReportFeatures(parsed.data);
  after(() => sweepExpiredReports());
  return NextResponse.json(collection, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
    },
  });
}

export async function POST(request: Request) {
  const browserHash = await getBrowserHash();
  if (!browserHash) {
    return jsonError(401, "NO_BROWSER_ID", "Missing browser identity");
  }
  const parsed = createReportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_PAYLOAD",
      "Invalid report",
      zodDetails(parsed.error),
    );
  }

  // Idempotent replays (offline outbox) return the original report.
  const existing = await findReportByClientRequestId(
    parsed.data.clientRequestId,
  );
  if (existing) return NextResponse.json(await toCreatedReport(existing));

  const limit = await rateLimit(
    [`report:ip:${await getIpHash()}`, `report:browser:${browserHash}`],
    env().RATE_LIMIT_REPORTS_PER_HOUR,
    3600,
  );
  if (!limit.allowed) {
    return jsonError(429, "RATE_LIMITED", "Too many reports", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  try {
    const report = await createReport(parsed.data, browserHash);
    after(async () => {
      const place = await reverseGeocode(report.lat, report.lng);
      if (place) await updateReportPlace(report.id, place);
    });
    return NextResponse.json(await toCreatedReport(report), { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }
}
