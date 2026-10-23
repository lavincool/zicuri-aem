import { describe, expect, test } from "bun:test";
import {
  availabilityPct,
  type HealthStats,
  healthIssues,
  isFlatLine,
  isSpike,
  spikeThresholdCm,
} from "./health";

const now = new Date("2026-10-23T12:00:00Z");
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(now.getTime() - ms);

const healthy = {
  status: "active" as const,
  lastSeenAt: ago(5 * 60_000),
  lastBatteryPct: 80,
  reportingIntervalS: 300,
};
const calmStats: HealthStats = {
  readings: 1000,
  minCm: 1.2,
  maxCm: 6.4,
  firstAt: ago(96 * HOUR),
  spikes: 0,
};

describe("healthIssues", () => {
  test("a healthy sensor needs nothing", () => {
    expect(healthIssues(healthy, calmStats, now)).toEqual([]);
  });

  test("a sensor that never reported", () => {
    expect(healthIssues({ ...healthy, lastSeenAt: null }, null, now)).toEqual([
      { kind: "never_reported" },
    ]);
  });

  test("a silent sensor reports since when", () => {
    const lastSeenAt = ago(2 * HOUR);
    expect(healthIssues({ ...healthy, lastSeenAt }, calmStats, now)).toEqual([
      { kind: "silent", since: lastSeenAt },
    ]);
  });

  test("low battery, spikes and flat lines are listed by urgency", () => {
    const issues = healthIssues(
      { ...healthy, lastBatteryPct: 14 },
      { ...calmStats, minCm: 3.1, maxCm: 3.2, spikes: 2 },
      now,
    );
    expect(issues.map((i) => i.kind)).toEqual([
      "spikes",
      "flat_line",
      "low_battery",
    ]);
    expect(issues[1]).toEqual({ kind: "flat_line", days: 4 });
  });

  test("maintenance and retired sensors are off on purpose", () => {
    for (const status of ["maintenance", "retired"] as const) {
      expect(
        healthIssues({ ...healthy, status, lastSeenAt: null }, null, now),
      ).toEqual([]);
    }
  });
});

describe("isFlatLine", () => {
  test("needs enough readings over at least three days", () => {
    const flat = { ...calmStats, minCm: 3.1, maxCm: 3.2 };
    expect(isFlatLine(flat, now)).toBe(true);
    expect(isFlatLine({ ...flat, readings: 10 }, now)).toBe(false);
    expect(isFlatLine({ ...flat, firstAt: ago(48 * HOUR) }, now)).toBe(false);
    expect(isFlatLine(calmStats, now)).toBe(false);
  });
});

describe("isSpike", () => {
  test("a jump that returns at once is a glitch", () => {
    expect(isSpike(3, 40, 3.5, spikeThresholdCm(25))).toBe(true);
  });

  test("a real rise that stays up is not", () => {
    expect(isSpike(3, 20, 24, spikeThresholdCm(25))).toBe(false);
    expect(isSpike(3, 5, 4, spikeThresholdCm(25))).toBe(false);
  });

  test("the threshold scales with the site", () => {
    expect(spikeThresholdCm(25)).toBe(12.5);
    expect(spikeThresholdCm(10)).toBe(10);
    expect(spikeThresholdCm(180)).toBe(90);
  });
});

test("availabilityPct is capped and needs a full interval", () => {
  expect(availabilityPct(288, 24 * HOUR, 300)).toBe(100);
  expect(availabilityPct(144, 24 * HOUR, 300)).toBe(50);
  expect(availabilityPct(400, 24 * HOUR, 300)).toBe(100);
  expect(availabilityPct(0, 60_000, 300)).toBeNull();
});
