import "server-only";
import {
  and,
  between,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { ReportStatus } from "@/config/categories";
import { db } from "@/lib/db/client";
import { reportFlags, reportSignals, reports } from "@/lib/db/schema";
import { photoUrl } from "@/lib/storage/urls";
import { effectiveStatus } from "../rules";
import {
  type ReportDetail,
  type ReportFeatureCollection,
  type ReportsQuery,
  SINCE_MS,
} from "../schema";

export const MAX_FEATURES = 5000;

const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

/** Reports inside a bounding box, as a lightweight GeoJSON collection for the map. */
export async function listReportFeatures(
  query: ReportsQuery,
  now = new Date(),
): Promise<ReportFeatureCollection> {
  const [west, south, east, north] = query.bbox;
  const conditions: (SQL | undefined)[] = [
    between(reports.lat, south, north),
    between(reports.lng, west, east),
    ne(reports.status, "hidden"),
  ];
  if (query.categories.length > 0) {
    conditions.push(inArray(reports.category, query.categories));
  }
  const sinceMs = SINCE_MS[query.since];
  if (sinceMs !== null) {
    conditions.push(gte(reports.createdAt, new Date(now.getTime() - sinceMs)));
  }
  if (query.status === "open") {
    conditions.push(
      eq(reports.status, "open"),
      or(isNull(reports.expiresAt), gt(reports.expiresAt, now)),
    );
  } else if (query.status === "resolved") {
    conditions.push(eq(reports.status, "resolved"));
  }

  const rows = await db()
    .select({
      id: reports.id,
      category: reports.category,
      status: reports.status,
      lat: reports.lat,
      lng: reports.lng,
      createdAt: reports.createdAt,
      stillThereCount: reports.stillThereCount,
      severity: reports.severity,
      expiresAt: reports.expiresAt,
      source: reports.source,
    })
    .from(reports)
    .where(and(...conditions))
    .orderBy(desc(reports.createdAt))
    .limit(MAX_FEATURES + 1);

  const truncated = rows.length > MAX_FEATURES;
  return {
    type: "FeatureCollection",
    truncated,
    features: rows.slice(0, MAX_FEATURES).map((row) => {
      const expired =
        row.status === "open" && row.expiresAt !== null && row.expiresAt <= now;
      const status: ReportStatus = expired ? "expired" : row.status;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          // ~1 m precision is plenty for pins and trims the payload.
          coordinates: [round5(row.lng), round5(row.lat)],
        },
        properties: {
          id: row.id,
          c: row.category,
          s: status,
          t: row.createdAt.getTime(),
          v: row.stillThereCount,
          sev: row.severity,
          ...(row.source === "seed" ? { d: 1 as const } : {}),
        },
      };
    }),
  };
}

/** Full report detail for the sheet, including this browser's own signal and flag. */
export async function getReportDetail(
  id: string,
  browserHash: string | null,
  now = new Date(),
): Promise<ReportDetail | null> {
  const [row] = await db()
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  if (!row) return null;

  let mySignal: ReportDetail["mySignal"] = null;
  let myFlagged = false;
  if (browserHash) {
    const [[signal], [flag]] = await Promise.all([
      db()
        .select({ kind: reportSignals.kind })
        .from(reportSignals)
        .where(
          and(
            eq(reportSignals.reportId, id),
            eq(reportSignals.browserHash, browserHash),
          ),
        )
        .limit(1),
      db()
        .select({ id: reportFlags.id })
        .from(reportFlags)
        .where(
          and(
            eq(reportFlags.reportId, id),
            eq(reportFlags.browserHash, browserHash),
          ),
        )
        .limit(1),
    ]);
    mySignal = signal?.kind ?? null;
    myFlagged = Boolean(flag);
  }

  const iso = (date: Date | null) => (date ? date.toISOString() : null);
  return {
    id: row.id,
    category: row.category,
    status: effectiveStatus(row, now),
    severity: row.severity,
    severityDetail: row.severityDetail,
    waterDepthCm: row.waterDepthCm,
    note: row.note,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracyM,
    address: row.address,
    colonia: row.colonia,
    municipality: row.municipality,
    state: row.state,
    photo: {
      fullUrl: photoUrl(row.photoFullKey),
      thumbUrl: photoUrl(row.photoThumbKey),
      width: row.photoWidth,
      height: row.photoHeight,
      color: row.photoColor,
    },
    stillThereCount: row.stillThereCount,
    fixedCount: row.fixedCount,
    createdAt: row.createdAt.toISOString(),
    lastConfirmedAt: iso(row.lastConfirmedAt),
    resolvedAt: iso(row.resolvedAt),
    expiresAt: iso(row.expiresAt),
    isDemo: row.source === "seed",
    mySignal,
    myFlagged,
  };
}

export type ReportSummary = Pick<
  ReportDetail,
  | "id"
  | "category"
  | "colonia"
  | "municipality"
  | "state"
  | "address"
  | "lat"
  | "lng"
  | "isDemo"
> & { thumbKey: string; createdAt: string; hidden: boolean };

/** Public, cacheable summary used by deep links and Open Graph images. */
export async function getReportSummary(
  id: string,
): Promise<ReportSummary | null> {
  "use cache";
  cacheTag(`report:${id}`);
  cacheLife("minutes");
  const [row] = await db()
    .select({
      id: reports.id,
      category: reports.category,
      colonia: reports.colonia,
      municipality: reports.municipality,
      state: reports.state,
      address: reports.address,
      lat: reports.lat,
      lng: reports.lng,
      source: reports.source,
      status: reports.status,
      thumbKey: reports.photoThumbKey,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    colonia: row.colonia,
    municipality: row.municipality,
    state: row.state,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    isDemo: row.source === "seed",
    thumbKey: row.thumbKey,
    createdAt: row.createdAt.toISOString(),
    hidden: row.status === "hidden",
  };
}
