/**
 * Builds src/config/service-area.json: Mexico's land outline, buffered 5 km so
 * points on the coast or the border river are never rejected, then simplified so
 * the browser can test points against it on every map move.
 *
 * Usage: bun scripts/build-service-area.ts <ne_10m_admin_0_countries.geojson>
 * Source: Natural Earth 1:10m Admin 0 – Countries (public domain),
 * https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import buffer from "@turf/buffer";
import simplify from "@turf/simplify";
import type { Feature, MultiPolygon, Polygon } from "geojson";

const BUFFER_KM = 5;
/** Degrees (~2 km); simplification never eats more than this into the buffer. */
const TOLERANCE = 0.02;

const input = process.argv[2];
if (!input) {
  console.error("Usage: bun scripts/build-service-area.ts <countries.geojson>");
  process.exit(1);
}

const countries = JSON.parse(await readFile(input, "utf8")) as {
  features: Feature<Polygon | MultiPolygon, { ADM0_A3: string }>[];
};
const mexico = countries.features.find((f) => f.properties.ADM0_A3 === "MEX");
if (!mexico) throw new Error("Mexico not found in the input file");

const buffered = buffer(mexico, BUFFER_KM, { units: "kilometers" });
if (!buffered) throw new Error("Buffering failed");
const simplified = simplify(buffered, {
  tolerance: TOLERANCE,
  highQuality: true,
});

const round = (value: number) => Number(value.toFixed(3));
const geometry = simplified.geometry;
const polygons =
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
const area = polygons.map((rings) =>
  rings.map((ring) => ring.map(([lng, lat]) => [round(lng), round(lat)])),
);

const vertices = area.flat(2).length;
const out = path.join(import.meta.dir, "../src/config/service-area.json");
await writeFile(out, `${JSON.stringify(area)}\n`);
console.log(
  `Wrote ${polygons.length} polygons, ${vertices} vertices to ${path.relative(process.cwd(), out)}`,
);
