import "server-only";
import { and, asc, between, eq, gte, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db/client";
import { devices, sensorReadings } from "@/lib/db/schema";
import type { Bbox } from "@/lib/geo";
import { deviceLevel } from "../rules";
import type {
  DeviceDetail,
  DeviceFeatureCollection,
  ReadingRange,
  ReadingSeries,
} from "../schema";

export async function listDeviceFeatures(
  bbox: Bbox,
  now = new Date(),
): Promise<DeviceFeatureCollection> {
  const [west, south, east, north] = bbox;
  const rows = await db()
    .select()
    .from(devices)
    .where(
      and(
        ne(devices.status, "retired"),
        between(devices.lat, south, north),
        between(devices.lng, west, east),
      ),
    )
    .limit(2000);
  return {
    type: "FeatureCollection",
    features: rows
      .filter((d) => d.lat !== null && d.lng !== null)
      .map((d) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [d.lng as number, d.lat as number] as [number, number],
        },
        properties: {
          id: d.id,
          name: d.name,
          site: d.siteType,
          l: deviceLevel(d, now),
          cm: d.lastLevelCm,
        },
      })),
  };
}

export async function getDeviceDetail(
  id: string,
  now = new Date(),
): Promise<DeviceDetail | null> {
  const [d] = await db()
    .select()
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);
  if (!d || d.status === "retired" || d.lat === null || d.lng === null) {
    return null;
  }
  return {
    id: d.id,
    name: d.name,
    siteType: d.siteType,
    level: deviceLevel(d, now),
    lat: d.lat,
    lng: d.lng,
    warningCm: d.warningCm,
    criticalCm: d.criticalCm,
    lastLevelCm: d.lastLevelCm,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    lastBatteryPct: d.lastBatteryPct,
    lastRssiDbm: d.lastRssiDbm,
    reportingIntervalS: d.reportingIntervalS,
  };
}

const RANGE_MS: Record<ReadingRange, number> = {
  "1h": 3_600_000,
  "24h": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
};
/** ≤ 288 points per chart; each bucket keeps its peak level (what matters for floods). */
const MAX_POINTS = 288;

export async function getReadingSeries(
  id: string,
  range: ReadingRange,
  now = new Date(),
): Promise<ReadingSeries | null> {
  const [d] = await db()
    .select({ warningCm: devices.warningCm, criticalCm: devices.criticalCm })
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);
  if (!d) return null;
  const bucketMs = Math.ceil(RANGE_MS[range] / MAX_POINTS);
  // CAST forces integer division (bound parameters arrive as floats).
  const bucket = sql<number>`cast(${sensorReadings.measuredAt} / ${bucketMs} as integer) * ${bucketMs}`;
  const rows = await db()
    .select({ t: bucket, level: sql<number>`max(${sensorReadings.levelCm})` })
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.deviceId, id),
        gte(
          sensorReadings.measuredAt,
          new Date(now.getTime() - RANGE_MS[range]),
        ),
      ),
    )
    .groupBy(bucket)
    .orderBy(asc(bucket));
  return {
    range,
    thresholds: d,
    points: rows.map((r) => ({ t: Number(r.t), level: Number(r.level) })),
  };
}

export type DeviceSummary = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

/** Cacheable identity and position, for deep links and metadata. */
export async function getDeviceSummary(
  id: string,
): Promise<DeviceSummary | null> {
  "use cache";
  cacheTag(`device:${id}`);
  cacheLife("minutes");
  const [d] = await db()
    .select({
      id: devices.id,
      name: devices.name,
      lat: devices.lat,
      lng: devices.lng,
      status: devices.status,
    })
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);
  if (!d || d.status === "retired" || d.lat === null || d.lng === null)
    return null;
  return { id: d.id, name: d.name, lat: d.lat, lng: d.lng };
}
