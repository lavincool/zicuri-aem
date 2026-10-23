import { describe, expect, test } from "bun:test";
import {
  checkReading,
  deviceLevel,
  levelFor,
  nextIntervalSeconds,
} from "./rules";

const thresholds = { warningCm: 10, criticalCm: 25 };
const now = new Date("2026-10-22T18:00:00Z");

describe("levelFor", () => {
  test("maps levels to thresholds", () => {
    expect(levelFor(3, thresholds)).toBe("normal");
    expect(levelFor(10, thresholds)).toBe("warning");
    expect(levelFor(25, thresholds)).toBe("critical");
  });
});

describe("deviceLevel", () => {
  const base = { ...thresholds, reportingIntervalS: 300, lastLevelCm: 12 };

  test("is offline after three missed intervals", () => {
    const lastSeenAt = new Date(now.getTime() - 16 * 60_000);
    expect(deviceLevel({ ...base, lastSeenAt }, now)).toBe("offline");
  });

  test("uses the last level while reporting", () => {
    const lastSeenAt = new Date(now.getTime() - 2 * 60_000);
    expect(deviceLevel({ ...base, lastSeenAt }, now)).toBe("warning");
  });

  test("devices that never reported are offline", () => {
    expect(
      deviceLevel({ ...base, lastSeenAt: null, lastLevelCm: null }, now),
    ).toBe("offline");
  });
});

test("reports every minute above warning", () => {
  expect(nextIntervalSeconds("normal", 300)).toBe(300);
  expect(nextIntervalSeconds("critical", 300)).toBe(60);
});

describe("checkReading", () => {
  test("accepts a fresh reading", () => {
    expect(checkReading({ measuredAt: now, levelCm: 4 }, now)).toBeNull();
  });

  test("rejects future, stale and impossible readings", () => {
    expect(
      checkReading(
        { measuredAt: new Date(now.getTime() + 10 * 60_000), levelCm: 4 },
        now,
      ),
    ).toBe("TIMESTAMP_IN_FUTURE");
    expect(
      checkReading(
        { measuredAt: new Date(now.getTime() - 31 * 86_400_000), levelCm: 4 },
        now,
      ),
    ).toBe("TIMESTAMP_TOO_OLD");
    expect(checkReading({ measuredAt: now, levelCm: 5000 }, now)).toBe(
      "VALUE_OUT_OF_RANGE",
    );
  });
});
