import { NextResponse } from "next/server";
import { signalBodySchema } from "@/features/reports/schema";
import { recordSignal } from "@/features/reports/server/commands";
import { DomainError } from "@/lib/errors";
import { jsonError, zodDetails } from "@/lib/http";
import { getBrowserHash } from "@/lib/identity";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/reports/[id]/signals">,
) {
  const { id } = await params;
  const browserHash = await getBrowserHash();
  if (!browserHash) {
    return jsonError(401, "NO_BROWSER_ID", "Missing browser identity");
  }
  const parsed = signalBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_PAYLOAD",
      "Invalid signal",
      zodDetails(parsed.error),
    );
  }
  try {
    const result = await recordSignal({
      reportId: id,
      browserHash,
      kind: parsed.data.kind,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }
}
