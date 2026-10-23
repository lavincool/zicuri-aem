import { describe, expect, test } from "bun:test";
import { countByCategory, dailyCounts, levelShares } from "./activity";

const HOUR_MS = 3_600_000;
const now = new Date("2026-10-23T18:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);

describe("dailyCounts", () => {
  test("buckets by 24 h windows ending now, oldest first", () => {
    const counts = dailyCounts(
      [ago(1), ago(23), ago(25), ago(24 * 13 + 1)],
      now,
    );
    expect(counts).toHaveLength(14);
    expect(counts.at(-1)).toBe(2);
    expect(counts.at(-2)).toBe(1);
    expect(counts[0]).toBe(1);
  });

  test("ignores dates outside the window and in the future", () => {
    expect(dailyCounts([ago(24 * 14), ago(-1)], now, 14)).toEqual(
      new Array(14).fill(0),
    );
  });
});

describe("countByCategory", () => {
  test("includes every category, even with no reports", () => {
    const counts = countByCategory(["blocked_drain", "blocked_drain", "other"]);
    expect(counts.blocked_drain).toBe(2);
    expect(counts.other).toBe(1);
    expect(counts.flooded_street).toBe(0);
  });
});

describe("levelShares", () => {
  test("rounds to whole percents that add up to 100", () => {
    const shares = levelShares([
      "low",
      "low",
      "moderate",
      "high",
      "very_high",
      "very_high",
    ]);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares.low).toBe(33);
    expect(shares.very_high).toBe(33);
  });

  test("is all zeros without cells", () => {
    expect(levelShares([])).toEqual({
      low: 0,
      moderate: 0,
      high: 0,
      very_high: 0,
    });
  });
});
