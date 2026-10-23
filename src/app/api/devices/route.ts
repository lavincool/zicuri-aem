import { type NextRequest, NextResponse } from "next/server";
import { listDeviceFeatures } from "@/features/devices/server/queries";
import { bboxSchema } from "@/features/reports/schema";
import { jsonError, zodDetails } from "@/lib/http";
import { isValidPanelToken, PANEL_COOKIE } from "@/lib/panel-auth";

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
  // The authorities panel also sees private sensors. It asks with its own URL so a
  // shared-cached public response is never served in its place, and vice versa.
  const includePrivate =
    request.nextUrl.searchParams.get("scope") === "panel" &&
    isValidPanelToken(request.cookies.get(PANEL_COOKIE)?.value);
  return NextResponse.json(
    await listDeviceFeatures(parsed.data, { includePrivate }),
    {
      headers: {
        "Cache-Control": includePrivate
          ? "private, no-store"
          : "public, s-maxage=5, stale-while-revalidate=15",
      },
    },
  );
}
