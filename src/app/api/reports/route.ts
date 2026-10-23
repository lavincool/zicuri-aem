import { type NextRequest, NextResponse } from "next/server";
import { reportsQuerySchema } from "@/features/reports/schema";
import { listReportFeatures } from "@/features/reports/server/queries";
import { jsonError, zodDetails } from "@/lib/http";

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
  return NextResponse.json(collection, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
    },
  });
}
