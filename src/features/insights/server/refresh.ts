import "server-only";
import { desc, eq } from "drizzle-orm";
import { cellToLatLng, polygonToCells } from "h3-js";
import { INSIGHTS_POLYGON } from "@/config/insights";
import { db } from "@/lib/db/client";
import {
  type ForecastSummary,
  forecastCells,
  forecastSnapshots,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { prefixedId } from "@/lib/ids";
import { type ForecastCell, fetchOpenMeteo, fetchSmn } from "./forecast";
import { computeRiskScores, latestForecastSnapshot } from "./risk";

const HOUR_MS = 3_600_000;
/** The panel triggers a background refresh when the forecast is older than this. */
export const FORECAST_STALE_MS = HOUR_MS;

async function storeSnapshot(input: {
  provider: "open_meteo" | "smn";
  model: string;
  validFrom: number;
  validTo: number;
  summary: ForecastSummary;
  raw: unknown;
  cells?: ForecastCell[];
  now: Date;
}): Promise<string> {
  const id = prefixedId("fcs");
  await db()
    .insert(forecastSnapshots)
    .values({
      id,
      provider: input.provider,
      model: input.model,
      fetchedAt: input.now,
      validFrom: new Date(input.validFrom),
      validTo: new Date(input.validTo),
      summary: input.summary,
      raw: input.raw,
    });
  if (input.cells?.length) {
    await db()
      .insert(forecastCells)
      .values(input.cells.map((cell) => ({ snapshotId: id, ...cell })));
  }
  return id;
}

export type RefreshResult = {
  openMeteo: "fetched" | "skipped" | "failed";
  smn: "fetched" | "skipped" | "failed" | "disabled";
  riskCells: number;
};

/**
 * Fetches forecasts (Open-Meteo + SMN) when stale or forced, stores snapshots so
 * history builds up from day one, then recomputes risk scores.
 */
export async function refreshInsights({
  force = false,
  now = new Date(),
} = {}): Promise<RefreshResult> {
  const latest = await latestForecastSnapshot();
  const fresh =
    latest !== null &&
    now.getTime() - latest.fetchedAt.getTime() < FORECAST_STALE_MS;
  const result: RefreshResult = {
    openMeteo: "skipped",
    smn: env().SMN_ENABLED ? "skipped" : "disabled",
    riskCells: 0,
  };

  if (force || !fresh) {
    const [openMeteo, smn] = await Promise.allSettled([
      fetchOpenMeteo(now.getTime()),
      env().SMN_ENABLED ? fetchSmn(now.getTime()) : Promise.resolve(null),
    ]);
    if (openMeteo.status === "fulfilled") {
      await storeSnapshot({ provider: "open_meteo", ...openMeteo.value, now });
      result.openMeteo = "fetched";
    } else {
      console.error("Open-Meteo forecast failed", openMeteo.reason);
      result.openMeteo = "failed";
    }
    if (smn.status === "fulfilled" && smn.value) {
      await storeSnapshot({ provider: "smn", ...smn.value, now });
      result.smn = "fetched";
    } else if (smn.status === "rejected") {
      console.error("SMN forecast failed", smn.reason);
      result.smn = "failed";
    }
  }

  result.riskCells = (await computeRiskScores(now)).cells;
  return result;
}

export const SCENARIO_MODEL = "scenario:frente-frio-1";

/**
 * Demo scenario: what if tomorrow brings rain like the 2–4 Oct 2026 cold front?
 * Stored as a clearly labeled synthetic snapshot so the panel shows a storm ranking.
 */
export async function runStormScenario(now = new Date()): Promise<void> {
  const cells = polygonToCells(INSIGHTS_POLYGON, 7);
  const validFrom = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const peakAt = validFrom + 20 * HOUR_MS;
  const forecast: ForecastCell[] = cells.map((h3r7) => {
    const [, lng] = cellToLatLng(h3r7);
    // Heavier toward the west/southwest flood belt, like the October event.
    const intensity = 0.75 + Math.min(0.45, Math.max(0, (-97.45 - lng) * 2.5));
    const hourly = Array.from({ length: 48 }, (_, hour) => {
      const t = validFrom + hour * HOUR_MS;
      const distance = Math.abs(t - peakAt) / (6 * HOUR_MS);
      const mm = distance < 1 ? 14 * intensity * (1 - distance ** 2) : 0.2;
      return { t, mm: Math.round(mm * 10) / 10, p: distance < 1.5 ? 95 : 40 };
    });
    const sum = (hours: number) =>
      Math.round(
        hourly.slice(0, hours).reduce((total, h) => total + h.mm, 0) * 10,
      ) / 10;
    return {
      h3r7,
      precip24hMm: sum(24),
      precip48hMm: sum(48),
      maxHourlyMm: Math.max(...hourly.map((h) => h.mm)),
      maxProbPct: 95,
      hourly,
    };
  });
  const max = (pick: (c: ForecastCell) => number) =>
    Math.max(...forecast.map(pick));
  await storeSnapshot({
    provider: "open_meteo",
    model: SCENARIO_MODEL,
    validFrom,
    validTo: validFrom + 48 * HOUR_MS,
    summary: {
      next24hMm: max((c) => c.precip24hMm),
      next48hMm: max((c) => c.precip48hMm),
      maxHourlyMm: max((c) => c.maxHourlyMm),
      maxProbPct: 95,
      peakAt,
    },
    raw: { scenario: SCENARIO_MODEL },
    cells: forecast,
    now,
  });
  await computeRiskScores(now);
}

export async function latestSnapshots() {
  const [openMeteo, smn] = await Promise.all(
    (["open_meteo", "smn"] as const).map(async (provider) => {
      const [row] = await db()
        .select({
          id: forecastSnapshots.id,
          model: forecastSnapshots.model,
          fetchedAt: forecastSnapshots.fetchedAt,
          summary: forecastSnapshots.summary,
        })
        .from(forecastSnapshots)
        .where(eq(forecastSnapshots.provider, provider))
        .orderBy(desc(forecastSnapshots.fetchedAt))
        .limit(1);
      return row ?? null;
    }),
  );
  return { openMeteo: openMeteo ?? null, smn: smn ?? null };
}
