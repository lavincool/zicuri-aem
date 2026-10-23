/**
 * Explainable flood-risk model v1 (PLAN.md §8). A weighted sum of normalized factors;
 * every factor keeps its raw value so the panel can say *why* a cell scores high.
 * Pure functions, unit-tested; weights live here and every stored score records the version.
 */

export const RISK_MODEL_VERSION = "risk-v1";

export const RISK_FACTORS = [
  "rain",
  "blockages",
  "history",
  "sensors",
  "terrain",
] as const;
export type RiskFactorKey = (typeof RISK_FACTORS)[number];

export const RISK_WEIGHTS: Record<RiskFactorKey, number> = {
  rain: 35,
  blockages: 25,
  history: 20,
  sensors: 10,
  terrain: 10,
};

export const RISK_LEVELS = ["low", "moderate", "high", "very_high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type RiskInputs = {
  /** Forecast precipitation over the next 48 h (mm), null when unknown. */
  rain48hMm: number | null;
  /** Severity- and confirmation-weighted open blockages in the cell and its neighbors. */
  blockageWeight: number;
  /** Plain count of open blockages, for the explanation. */
  blockageCount: number;
  /** Water reports and recorded flood events in the last 365 days. */
  floodHistoryCount: number;
  /** Highest current level / warning level among nearby reporting sensors. */
  sensorRatio: number | null;
  /** Cell elevation minus its surroundings (m); negative means low-lying. */
  relativeElevationM: number | null;
};

export type RiskFactor = {
  key: RiskFactorKey;
  /** Human-facing value for the reason string (mm, count, %, m). */
  value: number | null;
  normalized: number;
  weight: number;
  contribution: number;
};

export type RiskResult = {
  score: number;
  level: RiskLevel;
  /** True when no meaningful rain is expected: the score is preventive priority. */
  baseline: boolean;
  /** Sorted by contribution, highest first. */
  factors: RiskFactor[];
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const saturating = (value: number, scale: number) =>
  1 - Math.exp(-Math.max(0, value) / scale);

export function levelForScore(score: number): RiskLevel {
  if (score >= 75) return "very_high";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

export function scoreCell(inputs: RiskInputs): RiskResult {
  const normalized: Record<RiskFactorKey, number> = {
    rain: clamp01((inputs.rain48hMm ?? 0) / 80),
    blockages: saturating(inputs.blockageWeight, 3),
    history: saturating(inputs.floodHistoryCount, 4),
    sensors: clamp01(inputs.sensorRatio ?? 0),
    terrain: clamp01(-(inputs.relativeElevationM ?? 0) / 3),
  };
  const values: Record<RiskFactorKey, number | null> = {
    rain: inputs.rain48hMm === null ? null : Math.round(inputs.rain48hMm),
    blockages: inputs.blockageCount,
    history: inputs.floodHistoryCount,
    sensors:
      inputs.sensorRatio === null ? null : Math.round(inputs.sensorRatio * 100),
    terrain:
      inputs.relativeElevationM === null
        ? null
        : Math.round(inputs.relativeElevationM * 10) / 10,
  };

  const factors = RISK_FACTORS.map((key) => ({
    key,
    value: values[key],
    normalized: Math.round(normalized[key] * 1000) / 1000,
    weight: RISK_WEIGHTS[key],
    contribution: Math.round(normalized[key] * RISK_WEIGHTS[key] * 10) / 10,
  })).sort((a, b) => b.contribution - a.contribution);

  const score = Math.min(
    100,
    Math.round(factors.reduce((sum, f) => sum + f.contribution, 0)),
  );
  return {
    score,
    level: levelForScore(score),
    baseline: normalized.rain < 0.1,
    factors,
  };
}

/** Weight of one open blockage: severity and neighbor confirmations make it count more. */
export function blockageWeight(report: {
  severity: number | null;
  stillThereCount: number;
}): number {
  return (
    ((report.severity ?? 2) / 2) *
    (1 + Math.min(report.stillThereCount, 5) * 0.1)
  );
}

/** Ranking for "clear these drains before the rain". */
export function drainPriority(
  cellScore: number,
  report: { severity: number | null; stillThereCount: number },
): number {
  return Math.round(cellScore * blockageWeight(report) * 10) / 10;
}
