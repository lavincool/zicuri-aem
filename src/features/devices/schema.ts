import { z } from "zod";
import type { DeviceLevel, DeviceSiteType } from "@/config/devices";
import { MAX_BATCH } from "@/config/devices";

/** One reading as sent by firmware (snake_case for C/Arduino authors). */
export const readingSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  measured_at: z.iso.datetime({ offset: true }),
  level_cm: z.number().finite(),
  distance_cm: z.number().finite().optional(),
  battery_pct: z.number().int().min(0).max(100).optional(),
  battery_mv: z.number().int().min(0).max(20_000).optional(),
  rssi_dbm: z.number().int().min(-150).max(0).optional(),
  firmware: z.string().max(32).optional(),
});
export type ReadingPayload = z.infer<typeof readingSchema>;

/** A batch `{ readings: [...] }` or a single reading object. */
export const readingsBodySchema = z.union([
  z.object({ readings: z.array(readingSchema).min(1) }),
  readingSchema.transform((reading) => ({ readings: [reading] })),
]);

export const MAX_READINGS_PER_BATCH = MAX_BATCH;

export type IngestResponse = {
  accepted: number;
  duplicates: number;
  rejected: { index: number; code: string }[];
  status: DeviceLevel;
  next_interval_s: number;
  server_time: string;
};

export type DeviceFeatureProps = {
  id: string;
  name: string;
  site: DeviceSiteType;
  /** current level: normal | warning | critical | offline */
  l: DeviceLevel;
  /** last level in cm */
  cm: number | null;
  /** 1 for simulated demo sensors */
  d?: 1;
};

export type DeviceFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [lng: number, lat: number] };
  properties: DeviceFeatureProps;
};

export type DeviceFeatureCollection = {
  type: "FeatureCollection";
  features: DeviceFeature[];
};

/** Ranges on the public sensor sheet. */
export const READING_RANGES = ["1h", "24h", "7d"] as const;
/** The operator portal adds a month, for maintenance and reporting. */
export const OPERATOR_READING_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type ReadingRange = (typeof OPERATOR_READING_RANGES)[number];

export type DeviceDetail = {
  id: string;
  name: string;
  siteType: DeviceSiteType;
  level: DeviceLevel;
  lat: number;
  lng: number;
  warningCm: number;
  criticalCm: number;
  lastLevelCm: number | null;
  lastSeenAt: string | null;
  lastBatteryPct: number | null;
  lastRssiDbm: number | null;
  reportingIntervalS: number;
};

export type ReadingSeries = {
  range: ReadingRange;
  thresholds: { warningCm: number; criticalCm: number };
  points: { t: number; level: number }[];
};
