/**
 * Builds data/scenario-places.json for `bun run seed:scenario`: points on real streets and
 * drains in each scenario area (scripts/lib/scenario-cities.ts), with the address, colonia and
 * municipio that reverse geocoding gives a real report at that spot. The file is committed,
 * so seeding never needs the network.
 *
 * Usage: bun run data:scenario-places [-- --osm-dir <dir>]
 * Needs GEOCODER_CONTACT_EMAIL. Takes ~7 min: Nominatim allows one request per second.
 * --osm-dir keeps each city's Overpass response as <dir>/<city>.json and reuses it on the next
 * run, since the public Overpass servers are often busy.
 * Credit: © OpenStreetMap contributors (ODbL), via the Overpass API and Nominatim.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { DemoCity } from "@/config/demo-photos";
import { env } from "@/lib/env";
import { haversineMeters } from "@/lib/geo";
import { type ReverseGeocode, reverseGeocode } from "@/lib/geocode";
import { createRandom } from "./lib/random";
import {
  SCENARIO_CITIES,
  type ScenarioArea,
  type ScenarioCity,
  type ScenarioPlace,
  type WaterSource,
} from "./lib/scenario-cities";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/** Points in the same area stay at least this far apart. */
const MIN_SPACING_M = 35;
/** English street names mean the point fell in Brownsville, TX. */
const ENGLISH_STREET = /\b(St|Ave|Rd|Dr|Blvd|Ln|Street|Avenue|Road)\b/;

type LatLng = { lat: number; lng: number };
type Way = {
  tags: Record<string, string>;
  geometry: { lat: number; lon: number }[];
};

const { random, chance } = createRandom(0x0c_a5e5);

const { values: flags } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: { "osm-dir": { type: "string" } },
});

if (!env().GEOCODER_CONTACT_EMAIL) {
  throw new Error(
    "Set GEOCODER_CONTACT_EMAIL before rebuilding scenario places.",
  );
}

const geocodeCacheFile = flags["osm-dir"]
  ? path.join(flags["osm-dir"], "geocodes.jsonl")
  : null;
const geocodes = new Map<string, ReverseGeocode>();
if (geocodeCacheFile) {
  await mkdir(path.dirname(geocodeCacheFile), { recursive: true });
  const lines = await readFile(geocodeCacheFile, "utf8").catch(() => "");
  for (const line of lines.split("\n").filter(Boolean)) {
    const [key, value] = JSON.parse(line) as [string, ReverseGeocode];
    geocodes.set(key, value);
  }
}

async function geocode(point: LatLng): Promise<ReverseGeocode | null> {
  const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
  const cached = geocodes.get(key);
  if (cached) return cached;
  const result = await reverseGeocode(point.lat, point.lng);
  if (!result) {
    throw new Error(
      `Geocoding failed at ${key}; retry with --osm-dir to resume.`,
    );
  }
  geocodes.set(key, result);
  if (geocodeCacheFile) {
    await appendFile(geocodeCacheFile, `${JSON.stringify([key, result])}\n`);
  }
  return result;
}

async function overpass(city: ScenarioCity): Promise<Way[]> {
  const cache = flags["osm-dir"]
    ? path.join(flags["osm-dir"], `${city.id}.json`)
    : null;
  const cached = cache ? await readFile(cache, "utf8").catch(() => null) : null;
  if (cached) {
    console.log(`  using ${cache}`);
    return parseWays(cached);
  }
  const [w, s, e, n] = city.bbox;
  const box = `(${s},${w},${n},${e})`;
  const query = `[out:json][timeout:170];(way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street)$"]["name"]${box};way["waterway"~"^(canal|drain|ditch|stream)$"]${box};);out tags geom;`;
  // Public Overpass servers are often busy: go round the mirrors a few times.
  for (const endpoint of [...OVERPASS, ...OVERPASS, ...OVERPASS]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": "Cauce/0.1 scenario seed builder" },
        signal: AbortSignal.timeout(200_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (cache) {
        await mkdir(path.dirname(cache), { recursive: true });
        await writeFile(cache, body);
      }
      return parseWays(body);
    } catch (error) {
      console.log(`  ${endpoint} failed (${(error as Error).message})`);
      await Bun.sleep(15_000);
    }
  }
  throw new Error("Every Overpass endpoint failed");
}

function parseWays(body: string): Way[] {
  const data = JSON.parse(body) as { elements: Partial<Way>[] };
  return data.elements.filter((el): el is Way =>
    Boolean(el.tags && el.geometry && el.geometry.length > 1),
  );
}

type Segment = { a: LatLng; b: LatLng; length: number };

function segments(ways: Way[], keep: (p: LatLng) => boolean): Segment[] {
  const out: Segment[] = [];
  for (const way of ways) {
    for (let i = 1; i < way.geometry.length; i++) {
      const [p, q] = [way.geometry[i - 1], way.geometry[i]];
      if (!p || !q) continue;
      const a = { lat: p.lat, lng: p.lon };
      const b = { lat: q.lat, lng: q.lon };
      if (keep(a) && keep(b)) out.push({ a, b, length: haversineMeters(a, b) });
    }
  }
  return out;
}

/** Random points along the segments, weighted by length and spaced apart. */
function sample(pool: Segment[], count: number): LatLng[] {
  const total = pool.reduce((sum, s) => sum + s.length, 0);
  const points: LatLng[] = [];
  for (
    let attempt = 0;
    points.length < count && attempt < count * 40;
    attempt++
  ) {
    let roll = random() * total;
    let segment = pool.at(-1);
    for (const s of pool) {
      roll -= s.length;
      if (roll <= 0) {
        segment = s;
        break;
      }
    }
    if (!segment) break;
    const t = random();
    const point = {
      lat: segment.a.lat + (segment.b.lat - segment.a.lat) * t,
      lng: segment.a.lng + (segment.b.lng - segment.a.lng) * t,
    };
    if (points.every((p) => haversineMeters(p, point) >= MIN_SPACING_M)) {
      points.push(point);
    }
  }
  return points;
}

function inCity(city: ScenarioCity) {
  return (p: LatLng) => p.lat <= (city.maxLat ?? 90);
}

function inArea(area: ScenarioArea) {
  return (p: LatLng) =>
    !area.center ||
    haversineMeters(p, { lat: area.center[1], lng: area.center[0] }) <=
      (area.radiusM ?? 0);
}

function nearAnyArea(city: ScenarioCity) {
  const centers = city.areas.flatMap((a) =>
    a.center ? [{ lat: a.center[1], lng: a.center[0] }] : [],
  );
  return (p: LatLng) =>
    centers.some((c) => haversineMeters(p, c) <= city.waterNearM);
}

function streetPool(city: ScenarioCity, area: ScenarioArea, ways: Way[]) {
  const streets = ways.filter(
    (w) =>
      w.tags.highway &&
      !ENGLISH_STREET.test(w.tags.name ?? "") &&
      (!area.street || area.street.test(w.tags.name ?? "")),
  );
  const keep = inCity(city);
  const within = inArea(area);
  return segments(streets, (p) => keep(p) && within(p));
}

function waterPool(city: ScenarioCity, source: WaterSource, ways: Way[]) {
  const keep = inCity(city);
  const near = nearAnyArea(city);
  const channel = source.street
    ? ways.filter(
        (w) => w.tags.highway && source.street?.test(w.tags.name ?? ""),
      )
    : ways.filter(
        (w) =>
          w.tags.waterway &&
          (!source.waterway || source.waterway.test(w.tags.name ?? "")),
      );
  return segments(channel, (p) => keep(p) && near(p));
}

async function place(
  city: ScenarioCity,
  point: LatLng,
  base: Omit<
    ScenarioPlace,
    "lat" | "lng" | "address" | "colonia" | "municipality" | "state"
  >,
  fallbackColonia: string | null,
): Promise<ScenarioPlace | null> {
  const geo = await geocode(point);
  if (!geo) return null;
  if (geo.state !== city.state) return null;
  if (geo.address && ENGLISH_STREET.test(geo.address)) return null;
  return {
    ...base,
    lat: Number(point.lat.toFixed(6)),
    lng: Number(point.lng.toFixed(6)),
    // Residents rarely type a house number; keep the street only most of the time.
    address:
      geo.address && chance(0.75)
        ? geo.address.replace(/\s+\d+[A-Z]?$/, "")
        : geo.address,
    colonia: geo.colonia ?? fallbackColonia,
    municipality: geo.municipality,
    state: geo.state,
  };
}

async function buildCity(city: ScenarioCity): Promise<ScenarioPlace[]> {
  console.log(`${city.label}: streets and drains from OpenStreetMap…`);
  const ways = await overpass(city);
  const out: ScenarioPlace[] = [];

  for (const area of city.areas) {
    const pool = streetPool(city, area, ways);
    const points = sample(pool, Math.round(4 + area.weight * 3));
    for (const point of points) {
      const result = await place(
        city,
        point,
        { area: area.name, kind: "street", waterway: null },
        area.isColonia ? area.name : null,
      );
      if (result) out.push(result);
    }
    console.log(`  ${area.name}: ${points.length} points`);
  }

  for (const source of city.water) {
    const pool = waterPool(city, source, ways);
    const points = sample(pool, Math.round(source.weight * 12));
    for (const point of points) {
      // Water points belong to the nearest area, so they share its weight.
      const nearest = city.areas
        .filter((a) => a.center)
        .map((a) => ({
          area: a,
          d: haversineMeters(point, {
            lat: a.center?.[1] ?? 0,
            lng: a.center?.[0] ?? 0,
          }),
        }))
        .sort((x, y) => x.d - y.d)[0];
      const result = await place(
        city,
        point,
        {
          area: nearest?.area.name ?? source.name,
          kind: "water",
          waterway: source.name,
        },
        nearest?.area.isColonia && nearest.d <= (nearest.area.radiusM ?? 0)
          ? nearest.area.name
          : null,
      );
      if (result) out.push(result);
    }
    console.log(`  ${source.name}: ${points.length} points`);
  }
  return out;
}

const cities: Record<string, ScenarioPlace[]> = {};
for (const city of Object.values(SCENARIO_CITIES)) {
  cities[city.id] = await buildCity(city);
  for (const kind of ["street", "water"] as const) {
    if (!cities[city.id]?.some((point) => point.kind === kind)) {
      throw new Error(
        `No ${kind} points for ${city.id}; keeping the existing data file.`,
      );
    }
  }
}

const file = path.join(process.cwd(), "data/scenario-places.json");
await writeFile(
  file,
  `${JSON.stringify(
    {
      source:
        "© OpenStreetMap contributors (ODbL): streets and waterways via Overpass, addresses via Nominatim",
      generatedAt: new Date().toISOString(),
      cities: cities as Record<DemoCity, ScenarioPlace[]>,
    },
    null,
    1,
  )}\n`,
);
console.log(
  `Saved ${Object.entries(cities)
    .map(([id, points]) => `${points.length} ${id}`)
    .join(", ")} points to ${path.relative(process.cwd(), file)}`,
);
