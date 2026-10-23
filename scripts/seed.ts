/**
 * Seeds demo data for Matamoros: ~60 days of reports with a spike on 3–4 Oct 2026
 * (frente frío No. 1, 215.9 mm) in Buenavista, San Francisco, Los Sauces and nearby colonias.
 *
 * Usage:
 *   bun run seed                 # replace seeded rows (source = 'seed')
 *   bun run seed -- --stress 5000  # also add N random reports for performance checks
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import {
  CATEGORY_COLORS,
  isTransientCategory,
  normalizeSeverity,
  type ReportCategory,
  type ReportStatus,
  type SeverityDetail,
} from "@/config/categories";
import { COLONIAS, type Colonia } from "@/config/pilot";
import { db } from "@/lib/db/client";
import {
  type NewReport,
  reportFlags,
  reportSignals,
  reportStatusEvents,
  reports,
} from "@/lib/db/schema";
import { offsetMeters } from "@/lib/geo";
import { h3Cells } from "@/lib/h3";
import { prefixedId, reportId } from "@/lib/ids";
import {
  ILLUSTRATION_VARIANTS,
  illustrationKey,
  writeIllustrations,
} from "./lib/illustrations";
import { seedDevices } from "./lib/seed-devices";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();
/** Frente frío No. 1: rain from Fri 2 Oct to Sun 4 Oct 2026 (UTC−5). */
const EVENT_START = Date.UTC(2026, 9, 3, 4);
const EVENT_END = Date.UTC(2026, 9, 4, 20);
const URBAN_BBOX = { west: -97.585, south: 25.8, east: -97.455, north: 25.9 };

// Deterministic PRNG so every seed run produces the same city.
let state = 0x5eed_cafe;
function random(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}
const between = (min: number, max: number) => min + random() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const chance = (p: number) => random() < p;
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]?.[0] as T;
}
const hex = (bytes: number) =>
  Array.from({ length: bytes }, () =>
    int(0, 255).toString(16).padStart(2, "0"),
  ).join("");

function pointInColonia(colonia: Colonia) {
  const r = colonia.radiusM * Math.sqrt(random());
  const theta = random() * 2 * Math.PI;
  const [lng, lat] = colonia.center;
  return offsetMeters(lat, lng, r * Math.cos(theta), r * Math.sin(theta));
}

function pointInCity() {
  return {
    lat: between(URBAN_BBOX.south, URBAN_BBOX.north),
    lng: between(URBAN_BBOX.west, URBAN_BBOX.east),
  };
}

type PhotoSet = Record<ReportCategory, string[]>;

async function loadPhotos(): Promise<PhotoSet> {
  const set = {} as PhotoSet;
  for (const category of Object.keys(CATEGORY_COLORS) as ReportCategory[]) {
    const dir = path.join(process.cwd(), "public/seed/photos", category);
    const files = await readdir(dir).catch(() => [] as string[]);
    const real = files
      .filter((f) => /\.(jpe?g|webp|png)$/i.test(f))
      .map((f) => `seed/photos/${category}/${f}`);
    set[category] = real.length
      ? real
      : Array.from({ length: ILLUSTRATION_VARIANTS }, (_, v) =>
          illustrationKey(category, v),
        );
  }
  return set;
}

type Draft = {
  category: ReportCategory;
  createdAt: number;
  point: { lat: number; lng: number };
  colonia: string | null;
};

type SignalRow = typeof reportSignals.$inferInsert;
type EventRow = typeof reportStatusEvents.$inferInsert;

function build(draft: Draft, photos: PhotoSet) {
  const { category, createdAt, point } = draft;
  const transient = isTransientCategory(category);
  const id = reportId();
  const age = NOW - createdAt;

  let severityDetail: SeverityDetail | null = null;
  let waterDepthCm: number | null = null;
  if (category === "blocked_drain" && chance(0.8))
    severityDetail = chance(0.55) ? "full" : "partial";
  if (category === "broken_cover" && chance(0.8))
    severityDetail = chance(0.4) ? "missing" : "damaged";
  if (transient && chance(0.85)) {
    const duringEvent = createdAt >= EVENT_START && createdAt <= EVENT_END;
    waterDepthCm = duringEvent
      ? weighted([
          [15, 3],
          [45, 4],
          [80, 2],
        ] as const)
      : weighted([
          [5, 4],
          [15, 4],
          [45, 1],
        ] as const);
  }

  // Lifecycle.
  let status: ReportStatus = "open";
  let stillThere = 0;
  let fixed = 0;
  let statusChangedAt = createdAt;
  let resolvedAt: number | null = null;
  let expiresAt: number | null = null;
  let lastConfirmedAt: number | null = null;

  if (transient) {
    stillThere = age < DAY ? int(0, 3) : int(0, 4);
    lastConfirmedAt = stillThere
      ? Math.min(createdAt + between(1, 20) * HOUR, NOW - 10 * 60_000)
      : null;
    expiresAt = (lastConfirmedAt ?? createdAt) + DAY;
    if (expiresAt < NOW) {
      status = "expired";
      statusChangedAt = expiresAt;
    }
  } else {
    stillThere = int(0, 6);
    lastConfirmedAt = stillThere
      ? createdAt + Math.min(age * random(), 10 * DAY)
      : null;
    // Older blockages were often cleaned (JAD crews after the October event).
    const resolveChance = age > 14 * DAY ? 0.55 : age > 5 * DAY ? 0.3 : 0.08;
    if (chance(resolveChance)) {
      fixed = int(2, 4);
      stillThere = Math.min(stillThere, fixed - 1);
      status = "resolved";
      resolvedAt = Math.min(createdAt + between(1, 12) * DAY, NOW - HOUR);
      statusChangedAt = resolvedAt;
    }
  }

  const photoKey = pick(photos[category]);
  const row: NewReport = {
    id,
    category,
    severity: normalizeSeverity({ severityDetail, waterDepthCm }),
    severityDetail,
    waterDepthCm,
    note: null,
    status,
    lat: point.lat,
    lng: point.lng,
    accuracyM: Math.round(between(5, 35)),
    locationSource: chance(0.85) ? "gps" : chance(0.5) ? "exif" : "manual",
    ...h3Cells(point.lat, point.lng),
    address: null,
    colonia: draft.colonia,
    photoFullKey: photoKey,
    photoThumbKey: photoKey,
    photoWidth: 1600,
    photoHeight: 1200,
    photoColor: CATEGORY_COLORS[category],
    stillThereCount: stillThere,
    fixedCount: fixed,
    flagCount: 0,
    lastConfirmedAt: lastConfirmedAt ? new Date(lastConfirmedAt) : null,
    statusChangedAt: new Date(statusChangedAt),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
    reporterHash: hex(16),
    clientRequestId: crypto.randomUUID(),
    source: "seed",
    createdAt: new Date(createdAt),
    updatedAt: new Date(statusChangedAt),
  };

  const signals: SignalRow[] = [];
  const signalTime = (offset: number) =>
    new Date(Math.min(createdAt + offset, NOW - 60_000));
  for (let i = 0; i < stillThere; i++) {
    const at = signalTime(between(0.5, 48) * HOUR);
    signals.push({
      id: prefixedId("sig"),
      reportId: id,
      browserHash: hex(16),
      kind: "still_there",
      createdAt: at,
      updatedAt: at,
    });
  }
  for (let i = 0; i < fixed; i++) {
    const at = new Date((resolvedAt ?? NOW) - i * HOUR);
    signals.push({
      id: prefixedId("sig"),
      reportId: id,
      browserHash: hex(16),
      kind: "fixed",
      createdAt: at,
      updatedAt: at,
    });
  }

  const events: EventRow[] = [
    {
      id: prefixedId("evt"),
      reportId: id,
      fromStatus: null,
      toStatus: "open",
      reason: "created",
      actor: row.reporterHash,
      createdAt: new Date(createdAt),
    },
  ];
  if (status !== "open") {
    events.push({
      id: prefixedId("evt"),
      reportId: id,
      fromStatus: "open",
      toStatus: status,
      reason: status === "resolved" ? "signals" : "expired",
      actor: "system",
      createdAt: new Date(statusChangedAt),
    });
  }

  return { row, signals, events };
}

function drafts(stress: number): Draft[] {
  const out: Draft[] = [];
  const focus = COLONIAS.filter((c) => c.focus);
  const brisas = COLONIAS.filter((c) =>
    ["Rinconada de las Brisas", "Los Palmares", "Nuevo Milenio"].includes(
      c.name,
    ),
  );
  const coloniaWeights = [
    ...focus.map((c) => [c, 3] as const),
    ...brisas.map((c) => [c, 2] as const),
    ...COLONIAS.filter((c) => !c.focus && !brisas.includes(c)).map(
      (c) => [c, 0.6] as const,
    ),
  ];

  // A) Frente frío No. 1 (3–4 Oct 2026).
  for (let i = 0; i < 150; i++) {
    const colonia = weighted(coloniaWeights);
    out.push({
      category: weighted([
        ["flooded_street", 55],
        ["sewage_backflow", 15],
        ["overflowing_canal", 10],
        ["blocked_drain", 15],
        ["broken_cover", 5],
      ] as const),
      createdAt: between(EVENT_START, EVENT_END),
      point: pointInColonia(colonia),
      colonia: colonia.name,
    });
  }

  // B) Background over the last 60 days, denser in the flood belt.
  const smallRains = [NOW - 25 * DAY, NOW - 7 * DAY];
  for (let i = 0; i < 230; i++) {
    const inColonia = chance(0.55);
    const colonia = inColonia ? weighted(coloniaWeights) : null;
    const rainy = chance(0.25);
    const createdAt = rainy
      ? pick(smallRains) + between(0, 20) * HOUR
      : between(NOW - 60 * DAY, NOW - 2 * DAY);
    out.push({
      category: rainy
        ? weighted([
            ["flooded_street", 60],
            ["sewage_backflow", 20],
            ["blocked_drain", 20],
          ] as const)
        : weighted([
            ["blocked_drain", 45],
            ["broken_cover", 20],
            ["flooded_street", 12],
            ["sewage_backflow", 10],
            ["overflowing_canal", 6],
            ["other", 7],
          ] as const),
      createdAt,
      point: colonia ? pointInColonia(colonia) : pointInCity(),
      colonia: colonia?.name ?? null,
    });
  }

  // C) The last 48 hours: open blockages that still need cleaning before the next rain.
  for (let i = 0; i < 28; i++) {
    const colonia = weighted(coloniaWeights);
    out.push({
      category: weighted([
        ["blocked_drain", 70],
        ["broken_cover", 20],
        ["flooded_street", 10],
      ] as const),
      createdAt: between(NOW - 2 * DAY, NOW - 20 * 60_000),
      point: pointInColonia(colonia),
      colonia: colonia.name,
    });
  }

  // Optional stress set.
  for (let i = 0; i < stress; i++) {
    out.push({
      category: weighted([
        ["blocked_drain", 40],
        ["broken_cover", 15],
        ["flooded_street", 25],
        ["sewage_backflow", 10],
        ["overflowing_canal", 5],
        ["other", 5],
      ] as const),
      createdAt: between(NOW - 90 * DAY, NOW - HOUR),
      point: pointInCity(),
      colonia: null,
    });
  }

  return out;
}

async function chunked<T>(
  rows: T[],
  size: number,
  fn: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const stressIndex = args.indexOf("--stress");
  const stress = stressIndex >= 0 ? Number(args[stressIndex + 1] ?? 0) : 0;

  await writeIllustrations();
  const photos = await loadPhotos();
  const database = db();

  // Replace previously seeded rows (child rows first: SQLite FKs may be off).
  const old = await database
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.source, "seed"));
  const oldIds = old.map((r) => r.id);
  await chunked(oldIds, 500, async (ids) => {
    await database
      .delete(reportSignals)
      .where(inArray(reportSignals.reportId, ids));
    await database
      .delete(reportFlags)
      .where(inArray(reportFlags.reportId, ids));
    await database
      .delete(reportStatusEvents)
      .where(inArray(reportStatusEvents.reportId, ids));
    await database.delete(reports).where(inArray(reports.id, ids));
  });

  const built = drafts(stress).map((d) => build(d, photos));
  await chunked(
    built.map((b) => b.row),
    100,
    (rows) => database.insert(reports).values(rows),
  );
  await chunked(
    built.flatMap((b) => b.signals),
    200,
    (rows) => database.insert(reportSignals).values(rows),
  );
  await chunked(
    built.flatMap((b) => b.events),
    200,
    (rows) => database.insert(reportStatusEvents).values(rows),
  );

  const byStatus = built.reduce<Record<string, number>>((acc, b) => {
    const s = b.row.status ?? "open";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Seeded ${built.length} reports (removed ${oldIds.length} old):`,
    byStatus,
  );

  const sensors = await seedDevices();
  console.log(
    `Seeded ${sensors} sensors with 7 days of readings; keys saved to .simulator-devices.json`,
  );
}

await main();
