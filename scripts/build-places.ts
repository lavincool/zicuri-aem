/**
 * Builds public/data/places-mx.json, the offline index behind the map's place search:
 * Mexico's 32 states plus every town with at least 2,500 people or a municipal seat.
 *
 * Usage: bun run data:places -- <cities1000.txt> <MX.txt> <admin1CodesASCII.txt>
 * Source: GeoNames (CC BY 4.0), https://download.geonames.org/export/dump/
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MIN_POPULATION = 2500;
/** GeoNames uses English or ambiguous names for these. */
const NAME_OVERRIDES: Record<string, string> = {
  "Mexico City": "Ciudad de México",
};
const STATE_OVERRIDES: Record<string, string> = {
  "Mexico City": "Ciudad de México",
  México: "Estado de México",
};

const [citiesPath, countryPath, admin1Path] = process.argv.slice(2);
if (!citiesPath || !countryPath || !admin1Path) {
  console.error(
    "Usage: bun scripts/build-places.ts <cities1000.txt> <MX.txt> <admin1CodesASCII.txt>",
  );
  process.exit(1);
}

const rows = async (file: string) =>
  (await readFile(file, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
const round = (value: string) => Number(Number(value).toFixed(4));

// admin1CodesASCII: "MX.28 \t Tamaulipas \t ..."
const stateNames = new Map<string, string>();
for (const [code, name] of await rows(admin1Path)) {
  if (!code?.startsWith("MX.") || !name) continue;
  stateNames.set(code.slice(3), STATE_OVERRIDES[name] ?? name);
}
const stateCodes = [...stateNames.keys()].sort();
const stateIndex = new Map(stateCodes.map((code, index) => [code, index]));

// GeoNames columns: 1 name, 4 lat, 5 lng, 6 class, 7 code, 8 country, 10 admin1, 14 population.
const states: [name: string, lng: number, lat: number][] = stateCodes.map(
  (code) => [stateNames.get(code) as string, 0, 0],
);
for (const row of await rows(countryPath)) {
  if (row[7] !== "ADM1") continue;
  const index = stateIndex.get(row[10] ?? "");
  if (index === undefined) continue;
  states[index] = [
    states[index]?.[0] as string,
    round(row[5] as string),
    round(row[4] as string),
  ];
}

const places: [string, number, number, number, number][] = [];
for (const row of await rows(citiesPath)) {
  if (row[8] !== "MX") continue;
  const population = Number(row[14]);
  const seat = /^PPL(A|C)/.test(row[7] ?? "");
  if (population < MIN_POPULATION && !seat) continue;
  const index = stateIndex.get(row[10] ?? "");
  if (index === undefined) continue;
  const name = row[1] as string;
  places.push([
    NAME_OVERRIDES[name] ?? name,
    index,
    round(row[5] as string),
    round(row[4] as string),
    population,
  ]);
}
places.sort((a, b) => b[4] - a[4]);

const out = path.join(import.meta.dir, "../public/data/places-mx.json");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({ v: 1, states, places })}\n`);
console.log(
  `Wrote ${states.length} states and ${places.length} places to ${path.relative(process.cwd(), out)}`,
);
