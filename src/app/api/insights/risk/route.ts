import { NextResponse } from "next/server";
import { RISK_MODEL_VERSION } from "@/features/insights/risk/model";
import { getPanelData } from "@/features/insights/server/panel-data";

/** Read-only risk by H3 r8 cell for agencies (panel session required, see proxy.ts). */
export async function GET() {
  const data = await getPanelData();
  return NextResponse.json(
    {
      modelVersion: RISK_MODEL_VERSION,
      computedAt: data.computedAt,
      scenario: data.scenario,
      cells: data.cells,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
