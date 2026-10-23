/**
 * Downloads Copernicus DEM GLO-90 elevation (via the Open-Meteo Elevation API) for
 * every H3 r9 cell in the insights area and caches it in data/elevation-r9.json.
 * The file is committed, so seeding never needs the network.
 *
 * Usage: bun run data:elevation
 * Credit: Copernicus DEM GLO-90 (ESA, https://doi.org/10.5270/ESA-c5d3d65), Open-Meteo.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { cellToLatLng, polygonToCells } from "h3-js";
import { INSIGHTS_POLYGON } from "@/config/insights";

const BATCH = 100;
/** The free API counts every coordinate as a call (~600/min), so pace the batches. */
const PAUSE_MS = 11_000;
const cells = polygonToCells(INSIGHTS_POLYGON, 9);
const elevations: Record<string, number> = {};

console.log(`Fetching elevation for ${cells.length} H3 r9 cells…`);
for (let i = 0; i < cells.length; i += BATCH) {
  const batch = cells.slice(i, i + BATCH);
  const points = batch.map((cell) => cellToLatLng(cell));
  const params = new URLSearchParams({
    latitude: points.map(([lat]) => lat.toFixed(5)).join(","),
    longitude: points.map(([, lng]) => lng.toFixed(5)).join(","),
  });
  let response = await fetch(
    `https://api.open-meteo.com/v1/elevation?${params}`,
  );
  for (let retry = 0; response.status === 429 && retry < 5; retry++) {
    console.log("Rate limited; waiting 60 s…");
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`);
  }
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const data = (await response.json()) as { elevation: number[] };
  batch.forEach((cell, index) => {
    const value = data.elevation[index];
    if (typeof value === "number") elevations[cell] = value;
  });
  console.log(`  ${Math.min(i + BATCH, cells.length)}/${cells.length}`);
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

await writeFile(
  path.join(process.cwd(), "data/elevation-r9.json"),
  `${JSON.stringify(
    {
      source: "Copernicus DEM GLO-90 via Open-Meteo Elevation API",
      doi: "https://doi.org/10.5270/ESA-c5d3d65",
      fetchedAt: new Date().toISOString(),
      resolution: 9,
      elevations,
    },
    null,
    0,
  )}\n`,
);
console.log(
  `Saved ${Object.keys(elevations).length} elevations to data/elevation-r9.json`,
);
