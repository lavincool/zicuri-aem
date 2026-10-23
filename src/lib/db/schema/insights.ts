import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { RiskFactor } from "@/features/insights/risk/model";
import { RISK_LEVELS } from "@/features/insights/risk/model";
import { createdAt, updatedAt } from "./_shared";

/** Recorded flood events (news, official data) with their source. */
export const floodHistory = sqliteTable(
  "flood_history",
  {
    id: text("id").primaryKey(),
    source: text("source", {
      enum: ["news", "official", "report_rollup"],
    }).notNull(),
    sourceUrl: text("source_url"),
    eventDate: text("event_date").notNull(),
    colonia: text("colonia"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    h3r8: text("h3_r8").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("flood_history_h3_r8_idx").on(t.h3r8)],
);

/** Static per-cell features: satellite elevation and a colonia label. */
export const h3Cells = sqliteTable("h3_cells", {
  h3r8: text("h3_r8").primaryKey(),
  centroidLat: real("centroid_lat").notNull(),
  centroidLng: real("centroid_lng").notNull(),
  /** Mean of the r9 children (Copernicus DEM GLO-90). */
  elevationM: real("elevation_m"),
  /** Versus the mean of the surrounding 2-ring; negative = low-lying. */
  relativeElevationM: real("relative_elevation_m"),
  colonia: text("colonia"),
  updatedAt: updatedAt(),
});

export type ForecastSummary = {
  /** Highest 48 h total among cells (Open-Meteo) or for the municipality (SMN). */
  next48hMm: number;
  next24hMm: number;
  maxHourlyMm: number | null;
  maxProbPct: number | null;
  /** Epoch ms of the wettest hour (Open-Meteo). */
  peakAt: number | null;
  /** SMN daily outlook. */
  days?: { date: string; precipMm: number; probPct: number; sky: string }[];
};

export const forecastSnapshots = sqliteTable(
  "forecast_snapshots",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["open_meteo", "smn"] }).notNull(),
    /** "best_match", "daily", or "scenario:…" for demo scenarios. */
    model: text("model"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
    validFrom: integer("valid_from", { mode: "timestamp_ms" }).notNull(),
    validTo: integer("valid_to", { mode: "timestamp_ms" }).notNull(),
    summary: text("summary", { mode: "json" })
      .$type<ForecastSummary>()
      .notNull(),
    raw: text("raw", { mode: "json" }).notNull(),
  },
  (t) => [index("forecast_snapshots_provider_idx").on(t.provider, t.fetchedAt)],
);

export const forecastCells = sqliteTable(
  "forecast_cells",
  {
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => forecastSnapshots.id, { onDelete: "cascade" }),
    h3r7: text("h3_r7").notNull(),
    precip24hMm: real("precip_24h_mm").notNull(),
    precip48hMm: real("precip_48h_mm").notNull(),
    maxHourlyMm: real("max_hourly_mm").notNull(),
    maxProbPct: integer("max_prob_pct"),
    hourly: text("hourly", { mode: "json" })
      .$type<{ t: number; mm: number; p: number | null }[]>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.h3r7] })],
);

export const riskScores = sqliteTable(
  "risk_scores",
  {
    id: text("id").primaryKey(),
    /** All scores computed together share a run; the latest run is the current map. */
    runId: text("run_id").notNull(),
    h3r8: text("h3_r8").notNull(),
    computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
    modelVersion: text("model_version").notNull(),
    forecastSnapshotId: text("forecast_snapshot_id"),
    score: integer("score").notNull(),
    level: text("level", { enum: RISK_LEVELS }).notNull(),
    baseline: integer("baseline", { mode: "boolean" }).notNull(),
    factors: text("factors", { mode: "json" }).$type<RiskFactor[]>().notNull(),
  },
  (t) => [
    index("risk_scores_run_idx").on(t.runId),
    index("risk_scores_cell_time_idx").on(t.h3r8, t.computedAt),
  ],
);
