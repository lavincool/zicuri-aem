import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { READING_RANGES } from "@/features/devices/schema";
import { getReadingSeries } from "@/features/devices/server/queries";
import { jsonError } from "@/lib/http";

const rangeSchema = z.enum(READING_RANGES).default("24h");

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/devices/[id]/readings">,
) {
  const range = rangeSchema.safeParse(
    request.nextUrl.searchParams.get("range") ?? undefined,
  );
  if (!range.success) {
    return jsonError(400, "INVALID_QUERY", "range must be 1h, 24h or 7d");
  }
  const series = await getReadingSeries((await params).id, range.data);
  if (!series) return jsonError(404, "NOT_FOUND", "Device not found");
  return NextResponse.json(series, {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
    },
  });
}
