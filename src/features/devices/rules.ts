/**
 * Pure sensor rules: threshold levels, offline detection, adaptive intervals and
 * per-reading checks. No I/O; unit-tested.
 */
import {
  ALERT_INTERVAL_S,
  type DeviceLevel,
  OFFLINE_AFTER_INTERVALS,
} from "@/config/devices";

const MINUTE_MS = 60_000;
export const MAX_FUTURE_MS = 5 * MINUTE_MS;
export const MAX_AGE_MS = 30 * 24 * 60 * MINUTE_MS;
export const LEVEL_RANGE_CM = { min: -50, max: 1000 } as const;

export type Thresholds = { warningCm: number; criticalCm: number };

export function levelFor(
  levelCm: number,
  thresholds: Thresholds,
): Exclude<DeviceLevel, "offline"> {
  if (levelCm >= thresholds.criticalCm) return "critical";
  if (levelCm >= thresholds.warningCm) return "warning";
  return "normal";
}

export function isOffline(
  lastSeenAt: Date | null,
  reportingIntervalS: number,
  now: Date,
): boolean {
  if (!lastSeenAt) return true;
  return (
    now.getTime() - lastSeenAt.getTime() >
    OFFLINE_AFTER_INTERVALS * reportingIntervalS * 1000
  );
}

/** Current level of a device as shown on the map. */
export function deviceLevel(
  device: {
    lastSeenAt: Date | null;
    lastLevelCm: number | null;
    reportingIntervalS: number;
  } & Thresholds,
  now: Date,
): DeviceLevel {
  if (
    device.lastLevelCm === null ||
    isOffline(device.lastSeenAt, device.reportingIntervalS, now)
  ) {
    return "offline";
  }
  return levelFor(device.lastLevelCm, device);
}

/** Server-driven interval: faster while water is above warning. */
export function nextIntervalSeconds(
  level: DeviceLevel,
  reportingIntervalS: number,
): number {
  return level === "warning" || level === "critical"
    ? Math.min(ALERT_INTERVAL_S, reportingIntervalS)
    : reportingIntervalS;
}

export type ReadingRejection =
  | "TIMESTAMP_IN_FUTURE"
  | "TIMESTAMP_TOO_OLD"
  | "VALUE_OUT_OF_RANGE";

export function checkReading(
  reading: { measuredAt: Date; levelCm: number },
  now: Date,
): ReadingRejection | null {
  const age = now.getTime() - reading.measuredAt.getTime();
  if (age < -MAX_FUTURE_MS) return "TIMESTAMP_IN_FUTURE";
  if (age > MAX_AGE_MS) return "TIMESTAMP_TOO_OLD";
  if (
    reading.levelCm < LEVEL_RANGE_CM.min ||
    reading.levelCm > LEVEL_RANGE_CM.max
  ) {
    return "VALUE_OUT_OF_RANGE";
  }
  return null;
}
