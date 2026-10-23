import { NextResponse } from "next/server";
import { getDeviceDetail } from "@/features/devices/server/queries";
import { jsonError } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/devices/[id]">,
) {
  const detail = await getDeviceDetail((await params).id);
  if (!detail) return jsonError(404, "NOT_FOUND", "Device not found");
  return NextResponse.json(detail, {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
    },
  });
}
