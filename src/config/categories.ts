/** Report taxonomy shared by Zod schemas, the database and the UI. */

export const REPORT_CATEGORIES = [
  "blocked_drain",
  "broken_cover",
  "flooded_street",
  "overflowing_canal",
  "sewage_backflow",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Water on the street drains away; these expire without a fresh "Still there". */
export const TRANSIENT_CATEGORIES = [
  "flooded_street",
  "overflowing_canal",
  "sewage_backflow",
] as const satisfies readonly ReportCategory[];

export const REPORT_STATUSES = [
  "open",
  "resolved",
  "expired",
  "hidden",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SEVERITY_DETAILS = [
  "partial",
  "full",
  "damaged",
  "missing",
] as const;
export type SeverityDetail = (typeof SEVERITY_DETAILS)[number];

/** Depth chips (cm) for water categories. */
export const WATER_DEPTHS_CM = [5, 15, 45, 80] as const;
export type WaterDepthCm = (typeof WATER_DEPTHS_CM)[number];

/** Okabe–Ito colors: distinguishable with common color-vision deficiencies. Always paired with an icon. */
export const CATEGORY_COLORS: Record<ReportCategory, string> = {
  blocked_drain: "#E69F00",
  broken_cover: "#D55E00",
  flooded_street: "#0072B2",
  overflowing_canal: "#56B4E9",
  sewage_backflow: "#CC79A7",
  other: "#6B7280",
};

export type SeverityInput =
  | { kind: "depth"; options: readonly WaterDepthCm[] }
  | { kind: "detail"; options: readonly SeverityDetail[] }
  | { kind: "none" };

export const CATEGORY_SEVERITY: Record<ReportCategory, SeverityInput> = {
  blocked_drain: { kind: "detail", options: ["partial", "full"] },
  broken_cover: { kind: "detail", options: ["damaged", "missing"] },
  flooded_street: { kind: "depth", options: WATER_DEPTHS_CM },
  overflowing_canal: { kind: "depth", options: WATER_DEPTHS_CM },
  sewage_backflow: { kind: "depth", options: WATER_DEPTHS_CM },
  other: { kind: "none" },
};

export function isTransientCategory(category: ReportCategory): boolean {
  return (TRANSIENT_CATEGORIES as readonly ReportCategory[]).includes(category);
}

/** Normalized 1–3 severity used for filtering and risk scoring. */
export function normalizeSeverity(input: {
  severityDetail?: SeverityDetail | null;
  waterDepthCm?: number | null;
}): number | null {
  if (input.waterDepthCm != null) {
    if (input.waterDepthCm >= 45) return 3;
    if (input.waterDepthCm >= 15) return 2;
    return 1;
  }
  switch (input.severityDetail) {
    case "full":
    case "missing":
      return 3;
    case "damaged":
      return 2;
    case "partial":
      return 1;
    default:
      return null;
  }
}
