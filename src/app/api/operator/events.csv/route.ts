import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { PILOT } from "@/config/pilot";
import { eventsCsv } from "@/features/operators/csv";
import { eventFiltersSchema } from "@/features/operators/schema";
import { getFleetEvents } from "@/features/operators/server/fleet";
import { getOperator } from "@/features/operators/server/session";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const operator = await getOperator();
  if (!operator) return jsonError(401, "UNAUTHORIZED", "Sign-in required");
  const filters = eventFiltersSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const now = new Date();
  const [events, t] = await Promise.all([
    getFleetEvents(
      operator.orgId,
      { deviceId: filters.sensor, level: filters.nivel },
      now,
    ),
    getTranslations("operator.events"),
  ]);
  const csv = eventsCsv(
    events,
    {
      sensor: t("csv.sensor"),
      sensorId: t("csv.sensorId"),
      level: t("csv.level"),
      start: t("csv.start"),
      end: t("csv.end"),
      durationMinutes: t("csv.durationMinutes"),
      peakCm: t("csv.peakCm"),
      levels: {
        warning: t("levels.warning"),
        critical: t("levels.critical"),
        offline: t("levels.offline"),
      },
      ongoing: t("ongoing"),
    },
    { timeZone: PILOT.timeZone, now },
  );
  const date = now.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t("csv.filename")}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
