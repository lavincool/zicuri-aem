import { type NextRequest, NextResponse } from "next/server";
import { listDeviceFeatures } from "@/features/devices/server/queries";
import { bboxSchema } from "@/features/reports/schema";
import { jsonError, zodDetails } from "@/lib/http";

export async function GET(request: NextRequest) {
  const parsed = bboxSchema.safeParse(request.nextUrl.searchParams.get("bbox"));
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_QUERY",
      "Invalid bbox",
      zodDetails(parsed.error),
    );
  }
  return NextResponse.json(await listDeviceFeatures(parsed.data), {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
    },
  });
}
