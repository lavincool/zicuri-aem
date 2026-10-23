import { NextResponse } from "next/server";
import { refreshInsights } from "@/features/insights/server/refresh";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { safeEqual } from "@/lib/signing";

/** Daily Vercel Cron job: snapshot forecasts and recompute risk. */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid cron secret");
  }
  return NextResponse.json(await refreshInsights({ force: true }));
}
