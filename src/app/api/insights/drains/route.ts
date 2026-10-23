import { NextResponse } from "next/server";
import { getPanelData } from "@/features/insights/server/panel-data";

/** Ranked "clear these drains before the rain" list (panel session required). */
export async function GET() {
  const data = await getPanelData();
  return NextResponse.json(
    {
      computedAt: data.computedAt,
      scenario: data.scenario,
      drains: data.drains,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
