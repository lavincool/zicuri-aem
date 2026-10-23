import { NextResponse } from "next/server";
import { flagBodySchema } from "@/features/reports/schema";
import { recordFlag } from "@/features/reports/server/commands";
import { DomainError } from "@/lib/errors";
import { jsonError, zodDetails } from "@/lib/http";
import { getBrowserHash } from "@/lib/identity";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/reports/[id]/flags">,
) {
  const { id } = await params;
  const browserHash = await getBrowserHash();
  if (!browserHash) {
    return jsonError(401, "NO_BROWSER_ID", "Missing browser identity");
  }
  const parsed = flagBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_PAYLOAD",
      "Invalid flag",
      zodDetails(parsed.error),
    );
  }
  try {
    return NextResponse.json(
      await recordFlag({
        reportId: id,
        browserHash,
        reason: parsed.data.reason,
      }),
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return jsonError(error.status, error.code, error.message);
    }
    throw error;
  }
}
