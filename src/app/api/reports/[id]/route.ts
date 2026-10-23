import { NextResponse } from "next/server";
import { getReportDetail } from "@/features/reports/server/queries";
import { jsonError } from "@/lib/http";
import { getBrowserHash } from "@/lib/identity";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/reports/[id]">,
) {
  const { id } = await params;
  const detail = await getReportDetail(id, await getBrowserHash());
  if (!detail || detail.status === "hidden") {
    return jsonError(404, "NOT_FOUND", "Report not found");
  }
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
