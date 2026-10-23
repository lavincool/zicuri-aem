import "server-only";
import { gunzipSync } from "node:zlib";
import { cellToLatLng, polygonToCells } from "h3-js";
import { INSIGHTS_POLYGON, SMN_MUNICIPALITY } from "@/config/insights";
import type { ForecastSummary } from "@/lib/db/schema";
import { env } from "@/lib/env";

const HOUR_MS = 3_600_000;

export type ForecastCell = {
  h3r7: string;
  precip24hMm: number;
  precip48hMm: number;
  maxHourlyMm: number;
  maxProbPct: number | null;
  hourly: { t: number; mm: number; p: number | null }[];
};

export type OpenMeteoForecast = {
  model: string;
  validFrom: number;
  validTo: number;
  cells: ForecastCell[];
  summary: ForecastSummary;
  raw: unknown;
};

type OpenMeteoLocation = {
  hourly?: {
    time: number[];
    precipitation: (number | null)[];
    precipitation_probability?: (number | null)[];
  };
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Hourly precipitation for every H3 r7 cell (~5 km²) of the insights area, next 48 h. */
export async function fetchOpenMeteo(
  now = Date.now(),
): Promise<OpenMeteoForecast> {
  const cells = polygonToCells(INSIGHTS_POLYGON, 7);
  const points = cells.map((cell) => cellToLatLng(cell));
  const key = env().OPEN_METEO_API_KEY;
  const host = key ? "customer-api.open-meteo.com" : "api.open-meteo.com";
  const params = new URLSearchParams({
    latitude: points.map(([lat]) => lat.toFixed(4)).join(","),
    longitude: points.map(([, lng]) => lng.toFixed(4)).join(","),
    hourly: "precipitation,precipitation_probability",
    forecast_days: "3",
    timezone: "GMT",
    timeformat: "unixtime",
    ...(key ? { apikey: key } : {}),
  });
  const response = await fetch(`https://${host}/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const body = (await response.json()) as
    | OpenMeteoLocation
    | OpenMeteoLocation[];
  const locations = Array.isArray(body) ? body : [body];

  const validFrom = Math.floor(now / HOUR_MS) * HOUR_MS;
  const validTo = validFrom + 48 * HOUR_MS;
  let peak: { at: number; mm: number } | null = null;

  const forecastCells = cells.map((h3r7, index): ForecastCell => {
    const hourly = locations[index]?.hourly;
    const series = (hourly?.time ?? [])
      .map((t, i) => ({
        t: t * 1000,
        mm: hourly?.precipitation[i] ?? 0,
        p: hourly?.precipitation_probability?.[i] ?? null,
      }))
      .filter((h) => h.t >= validFrom && h.t < validTo);
    const sum = (hours: number) =>
      round1(
        series
          .filter((h) => h.t < validFrom + hours * HOUR_MS)
          .reduce((total, h) => total + h.mm, 0),
      );
    for (const h of series) {
      if (!peak || h.mm > peak.mm) peak = { at: h.t, mm: h.mm };
    }
    const probabilities = series
      .map((h) => h.p)
      .filter((p): p is number => p !== null);
    return {
      h3r7,
      precip24hMm: sum(24),
      precip48hMm: sum(48),
      maxHourlyMm: round1(Math.max(0, ...series.map((h) => h.mm))),
      maxProbPct: probabilities.length ? Math.max(...probabilities) : null,
      hourly: series,
    };
  });

  const max = (pick: (c: ForecastCell) => number) =>
    Math.max(0, ...forecastCells.map(pick));
  const probabilities = forecastCells
    .map((c) => c.maxProbPct)
    .filter((p): p is number => p !== null);
  const wettest = peak as { at: number; mm: number } | null;
  return {
    model: "best_match",
    validFrom,
    validTo,
    cells: forecastCells,
    summary: {
      next24hMm: round1(max((c) => c.precip24hMm)),
      next48hMm: round1(max((c) => c.precip48hMm)),
      maxHourlyMm: round1(max((c) => c.maxHourlyMm)),
      maxProbPct: probabilities.length ? Math.max(...probabilities) : null,
      peakAt: wettest && wettest.mm > 0 ? wettest.at : null,
    },
    raw: { provider: "open-meteo", cells: cells.length },
  };
}

type SmnEntry = {
  ides: string;
  idmun: string;
  nmun: string;
  ndia: string;
  dloc: string;
  prec: string;
  probprec: string;
  desciel: string;
};

/**
 * Official daily outlook for Matamoros from SMN (CONAGUA). The hourly feed is ~100 MB
 * uncompressed, so we use the daily one (~5 MB) and keep only our municipality.
 */
export async function fetchSmn(now = Date.now()) {
  const response = await fetch(
    "https://smn.conagua.gob.mx/tools/GUI/webservices/?method=1",
    {
      headers: { "User-Agent": "Cauce/0.1" },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`SMN returned ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const text =
    buffer[0] === 0x1f && buffer[1] === 0x8b
      ? gunzipSync(buffer).toString("utf8")
      : buffer.toString("utf8");
  const entries = (JSON.parse(text) as SmnEntry[])
    .filter(
      (e) =>
        e.ides.trim() === SMN_MUNICIPALITY.ides &&
        e.idmun.trim() === SMN_MUNICIPALITY.idmun,
    )
    .sort((a, b) => Number(a.ndia) - Number(b.ndia));
  if (entries.length === 0)
    throw new Error("SMN feed has no Matamoros entries");

  const days = entries.map((e) => ({
    date: `${e.dloc.slice(0, 4)}-${e.dloc.slice(4, 6)}-${e.dloc.slice(6, 8)}`,
    precipMm: Number(e.prec) || 0,
    probPct: Number(e.probprec) || 0,
    sky: e.desciel.trim(),
  }));
  const firstTwo = days.slice(0, 2);
  const validFrom = Math.floor(now / HOUR_MS) * HOUR_MS;
  return {
    model: "daily",
    validFrom,
    validTo: validFrom + days.length * 24 * HOUR_MS,
    summary: {
      next24hMm: round1(firstTwo[0]?.precipMm ?? 0),
      next48hMm: round1(firstTwo.reduce((t, d) => t + d.precipMm, 0)),
      maxHourlyMm: null,
      maxProbPct: Math.max(0, ...firstTwo.map((d) => d.probPct)),
      peakAt: null,
      days,
    } satisfies ForecastSummary,
    raw: entries,
  };
}
