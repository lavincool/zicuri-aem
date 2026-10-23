/**
 * Pure report lifecycle rules (PLAN.md §0 #5). No I/O, fully unit-tested.
 */
import {
  isTransientCategory,
  type ReportCategory,
  type ReportStatus,
} from "@/config/categories";

const HOUR_MS = 3_600_000;

/** Water categories expire this long after creation or the last "Still there". */
export const TRANSIENT_TTL_MS = 24 * HOUR_MS;
/** Only recent signals decide resolution, so old confirmations don't block a fix. */
export const SIGNAL_WINDOW_MS = 7 * 24 * HOUR_MS;
export const RESOLVE_MIN_FIXED = 2;
export const HIDE_AFTER_FLAGS = 3;

export type SignalKind = "still_there" | "fixed";

/** Open reports past their expiry are shown as expired before the sweep catches up. */
export function effectiveStatus(
  report: { status: ReportStatus; expiresAt: Date | null },
  now: Date,
): ReportStatus {
  if (
    report.status === "open" &&
    report.expiresAt !== null &&
    report.expiresAt.getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return report.status;
}

export function expiryFrom(
  category: ReportCategory,
  confirmedAt: Date,
): Date | null {
  return isTransientCategory(category)
    ? new Date(confirmedAt.getTime() + TRANSIENT_TTL_MS)
    : null;
}

/** Resolved with ≥ 2 recent "Fixed" from different browsers that outnumber recent "Still there". */
export function shouldResolve(recent: {
  fixed: number;
  stillThere: number;
}): boolean {
  return recent.fixed >= RESOLVE_MIN_FIXED && recent.fixed > recent.stillThere;
}

export function shouldHide(flagCount: number): boolean {
  return flagCount >= HIDE_AFTER_FLAGS;
}

/** New cumulative counters after a browser sets (or changes) its signal. */
export function applySignalToCounts(
  counts: { stillThere: number; fixed: number },
  previous: SignalKind | null,
  next: SignalKind,
): { stillThere: number; fixed: number } {
  if (previous === next) return counts;
  const result = { ...counts };
  if (previous === "still_there") result.stillThere -= 1;
  if (previous === "fixed") result.fixed -= 1;
  if (next === "still_there") result.stillThere += 1;
  else result.fixed += 1;
  return {
    stillThere: Math.max(0, result.stillThere),
    fixed: Math.max(0, result.fixed),
  };
}
