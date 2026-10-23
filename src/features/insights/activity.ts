import { REPORT_CATEGORIES, type ReportCategory } from "@/config/categories";
import { RISK_LEVELS, type RiskLevel } from "./risk/model";

const DAY_MS = 24 * 3_600_000;
/** Days of history behind the panel's activity sparklines. */
export const ACTIVITY_DAYS = 14;

/** Counts per 24 h window, oldest first; the last window ends at `now`. */
export function dailyCounts(
  dates: Date[],
  now: Date,
  days = ACTIVITY_DAYS,
): number[] {
  const counts = new Array<number>(days).fill(0);
  for (const date of dates) {
    const age = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
    if (age < 0 || age >= days) continue;
    const index = days - 1 - age;
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

export function countByCategory(
  categories: ReportCategory[],
): Record<ReportCategory, number> {
  const counts = Object.fromEntries(
    REPORT_CATEGORIES.map((c) => [c, 0]),
  ) as Record<ReportCategory, number>;
  for (const category of categories) counts[category] += 1;
  return counts;
}

/**
 * Share of cells per risk level in whole percents. Largest-remainder rounding
 * keeps the total at exactly 100 so the segmented bar never over- or underflows.
 */
export function levelShares(levels: RiskLevel[]): Record<RiskLevel, number> {
  const shares = Object.fromEntries(RISK_LEVELS.map((l) => [l, 0])) as Record<
    RiskLevel,
    number
  >;
  if (levels.length === 0) return shares;
  const exact = RISK_LEVELS.map((level) => {
    const value =
      (levels.filter((l) => l === level).length / levels.length) * 100;
    return { level, floor: Math.floor(value), rest: value % 1 };
  });
  let missing = 100 - exact.reduce((sum, e) => sum + e.floor, 0);
  for (const entry of [...exact].sort((a, b) => b.rest - a.rest)) {
    shares[entry.level] = entry.floor + (missing > 0 ? 1 : 0);
    missing -= 1;
  }
  return shares;
}
