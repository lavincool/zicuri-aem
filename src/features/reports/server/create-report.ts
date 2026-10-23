import "server-only";
import { and, countDistinct, eq, gte, inArray, ne } from "drizzle-orm";
import { gridDisk } from "h3-js";
import { normalizeSeverity } from "@/config/categories";
import { isInsidePilot } from "@/config/pilot";
import { MAX_PHOTO_BYTES } from "@/config/uploads";
import { db } from "@/lib/db/client";
import {
  type Report,
  reportStatusEvents,
  reports,
  uploads,
} from "@/lib/db/schema";
import { appUrl } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { h3Cells } from "@/lib/h3";
import { prefixedId, reportId } from "@/lib/ids";
import { storage } from "@/lib/storage";
import { photoUrl } from "@/lib/storage/urls";
import { expiryFrom } from "../rules";
import type { CreatedReport, CreateReportInput } from "../schema";

const UPLOAD_MAX_AGE_MS = 60 * 60 * 1000;
const NEARBY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function findReportByClientRequestId(
  clientRequestId: string,
): Promise<Report | null> {
  const [row] = await db()
    .select()
    .from(reports)
    .where(eq(reports.clientRequestId, clientRequestId))
    .limit(1);
  return row ?? null;
}

/** Distinct other people with open reports in the same ~350 m area this week. */
export async function countNearbyReporters(
  report: Pick<Report, "id" | "h3r9" | "reporterHash">,
  now = new Date(),
): Promise<number> {
  const [row] = await db()
    .select({ total: countDistinct(reports.reporterHash) })
    .from(reports)
    .where(
      and(
        inArray(reports.h3r9, gridDisk(report.h3r9, 1)),
        eq(reports.status, "open"),
        gte(reports.createdAt, new Date(now.getTime() - NEARBY_WINDOW_MS)),
        ne(reports.id, report.id),
        ne(reports.reporterHash, report.reporterHash),
      ),
    );
  return row?.total ?? 0;
}

export async function toCreatedReport(
  report: Report,
  now = new Date(),
): Promise<CreatedReport> {
  return {
    report: {
      id: report.id,
      category: report.category,
      status: report.status,
      lat: report.lat,
      lng: report.lng,
      createdAt: report.createdAt.toISOString(),
      photoThumbUrl: photoUrl(report.photoThumbKey),
    },
    nearbyCount: await countNearbyReporters(report, now),
    shareUrl: `${appUrl()}/r/${report.id}`,
  };
}

export async function createReport(
  input: CreateReportInput,
  browserHash: string,
  now = new Date(),
): Promise<Report> {
  const { lat, lng } = input.location;
  if (!isInsidePilot(lng, lat)) {
    throw new DomainError(
      "OUTSIDE_PILOT_AREA",
      422,
      "Location is outside the pilot area",
    );
  }

  const [upload] = await db()
    .select()
    .from(uploads)
    .where(eq(uploads.id, input.uploadId))
    .limit(1);
  if (
    !upload ||
    upload.browserHash !== browserHash ||
    now.getTime() - upload.createdAt.getTime() > UPLOAD_MAX_AGE_MS
  ) {
    throw new DomainError("UPLOAD_NOT_FOUND", 404, "Upload not found");
  }
  if (upload.consumedAt) {
    throw new DomainError("UPLOAD_ALREADY_USED", 409, "Upload already used");
  }

  const [full, thumb] = await Promise.all([
    storage().head(upload.fullKey),
    storage().head(upload.thumbKey),
  ]);
  if (!full || !thumb) {
    throw new DomainError("PHOTO_MISSING", 422, "Photo upload not found");
  }
  if (full.bytes > MAX_PHOTO_BYTES) {
    await Promise.all([
      storage().delete(upload.fullKey),
      storage().delete(upload.thumbKey),
    ]);
    throw new DomainError("FILE_TOO_LARGE", 413, "Photo is too large");
  }

  const severityDetail = input.severityDetail ?? null;
  const waterDepthCm = input.waterDepthCm ?? null;
  const values = {
    id: reportId(),
    category: input.category,
    severity: normalizeSeverity({ severityDetail, waterDepthCm }),
    severityDetail,
    waterDepthCm,
    note: input.note ? input.note : null,
    status: "open" as const,
    lat,
    lng,
    accuracyM: input.location.accuracyM ?? null,
    locationSource: input.location.source,
    ...h3Cells(lat, lng),
    photoFullKey: upload.fullKey,
    photoThumbKey: upload.thumbKey,
    photoWidth: input.photo.width,
    photoHeight: input.photo.height,
    photoColor: input.photo.color ?? null,
    statusChangedAt: now,
    expiresAt: expiryFrom(input.category, now),
    reporterHash: browserHash,
    clientRequestId: input.clientRequestId,
    aiSuggestionId: input.aiSuggestionId ?? null,
    source: "web" as const,
    createdAt: now,
    updatedAt: now,
  };

  try {
    return await db().transaction(async (tx) => {
      const [created] = await tx.insert(reports).values(values).returning();
      await tx.insert(reportStatusEvents).values({
        id: prefixedId("evt"),
        reportId: values.id,
        fromStatus: null,
        toStatus: "open",
        reason: "created",
        actor: browserHash,
        createdAt: now,
      });
      await tx
        .update(uploads)
        .set({ consumedAt: now })
        .where(eq(uploads.id, upload.id));
      if (!created) throw new Error("Insert returned no row");
      return created;
    });
  } catch (error) {
    // A concurrent replay with the same idempotency key won the race.
    const existing = await findReportByClientRequestId(input.clientRequestId);
    if (existing) return existing;
    throw error;
  }
}

export async function updateReportPlace(
  id: string,
  place: { address: string | null; colonia: string | null },
): Promise<void> {
  await db()
    .update(reports)
    .set({ address: place.address, colonia: place.colonia })
    .where(eq(reports.id, id));
}
