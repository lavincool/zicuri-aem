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
import type { ReportStatus } from "@/config/categories";
import { db } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import {
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
        },
      };
    }),
  };
}
