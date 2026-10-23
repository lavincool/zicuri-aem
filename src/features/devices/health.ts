/**
 * Pure fleet-health rules for the operator portal: which sensors need a visit and
 * why. No I/O; unit-tested. Inputs are the device row and small reading stats.
 */
import type { DeviceStatus } from "@/config/devices";
import { isOffline } from "./rules";

const HOUR_MS = 3_600_000;

export const LOW_BATTERY_PCT = 20;
/** A sensor whose level barely moves for days is probably blocked or misaimed. */
export const FLAT_LINE = {
  windowMs: 96 * HOUR_MS,
  minSpanMs: 72 * HOUR_MS,
  minReadings: 24,
  maxRangeCm: 0.3,
} as const;
export const SPIKE_WINDOW_MS = 24 * HOUR_MS;
/** Smallest jump the database pre-filters before `isSpike` decides. */
export const MIN_SPIKE_CM = 10;

export type HealthStats = {
  /** Readings in the flat-line window. */
  readings: number;
  minCm: number | null;
  maxCm: number | null;
  firstAt: Date | null;
  /** Spike-and-return readings in the last 24 h. */
  spikes: number;
};

export type HealthIssue =
  | { kind: "never_reported" }
  | { kind: "silent"; since: Date }
  | { kind: "spikes"; count: number }
  | { kind: "flat_line"; days: number }
  | { kind: "low_battery"; percent: number };

type HealthDevice = {
  status: DeviceStatus;
  lastSeenAt: Date | null;
  lastBatteryPct: number | null;
  reportingIntervalS: number;
};

/** Ordered by urgency: no data first, then data that can't be trusted, then batteries. */
export function healthIssues(
  device: HealthDevice,
  stats: HealthStats | null,
  now: Date,
): HealthIssue[] {
  // Sensors in maintenance or retired are off on purpose.
  if (device.status === "maintenance" || device.status === "retired") return [];
  const issues: HealthIssue[] = [];
  if (!device.lastSeenAt) {
    issues.push({ kind: "never_reported" });
  } else if (isOffline(device.lastSeenAt, device.reportingIntervalS, now)) {
    issues.push({ kind: "silent", since: device.lastSeenAt });
  }
  if (stats && stats.spikes > 0) {
    issues.push({ kind: "spikes", count: stats.spikes });
  }
  if (stats && isFlatLine(stats, now)) {
    const spanMs = now.getTime() - (stats.firstAt?.getTime() ?? now.getTime());
    issues.push({
      kind: "flat_line",
      days: Math.floor(spanMs / (24 * HOUR_MS)),
    });
  }
  if (
    device.lastBatteryPct !== null &&
    device.lastBatteryPct < LOW_BATTERY_PCT
  ) {
    issues.push({ kind: "low_battery", percent: device.lastBatteryPct });
  }
  return issues;
}

export function isFlatLine(stats: HealthStats, now: Date): boolean {
  if (
    stats.readings < FLAT_LINE.minReadings ||
    stats.minCm === null ||
    stats.maxCm === null ||
    !stats.firstAt
  ) {
    return false;
  }
  return (
    now.getTime() - stats.firstAt.getTime() >= FLAT_LINE.minSpanMs &&
    stats.maxCm - stats.minCm < FLAT_LINE.maxRangeCm
  );
}

/** How far a reading must jump to count as a glitch: half the critical level, at least 10 cm. */
export function spikeThresholdCm(criticalCm: number): number {
  return Math.max(MIN_SPIKE_CM, criticalCm * 0.5);
}

/**
 * A reading that jumps away from both neighbors while they agree with each other
 * (an ultrasonic echo off a car or a leaf). Real floods rise and stay up.
 */
export function isSpike(
  previous: number,
  current: number,
  next: number,
  thresholdCm: number,
): boolean {
  return (
    Math.abs(current - previous) >= thresholdCm &&
    Math.abs(current - next) >= thresholdCm &&
    Math.abs(previous - next) < thresholdCm / 2
  );
}

/** Share of expected readings that arrived, capped at 100 % (alerts report faster). */
export function availabilityPct(
  readings: number,
  spanMs: number,
  reportingIntervalS: number,
): number | null {
  const expected = spanMs / (reportingIntervalS * 1000);
  if (expected < 1) return null;
  return Math.min(100, Math.round((readings / expected) * 100));
}
