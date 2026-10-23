/**
 * Builds Cauce's basemap styles from OpenFreeMap's Positron style.
 * Streets are muted and waterways, canals ("drenes") and lagoons are emphasized.
 * OpenFreeMap requires customized styles to be self-hosted, so the output lives in public/.
 *
 * Usage: bun run map:styles
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_STYLE = "https://tiles.openfreemap.org/styles/positron";
const OUT_DIR = path.join(process.cwd(), "public/map/styles");

type Palette = {
  name: string;
  background: string;
  residential: string;
  park: string;
  water: string;
  waterway: string;
  waterLabel: string;
  building: string;
  buildingOutline: string;
  roadMinor: string;
  roadMajor: string;
  roadCasing: string;
  motorway: string;
  rail: string;
  boundary: string;
  label: string;
  labelStrong: string;
  halo: string;
};

const LIGHT: Palette = {
  name: "Cauce Light",
  background: "#f3f0e7",
  residential: "#ece7da",
  park: "#e1e6d3",
  water: "#a9d3e2",
  waterway: "#4fa3bf",
  waterLabel: "#1f6f88",
  building: "#e4ddcc",
  buildingOutline: "#d4cbb6",
  roadMinor: "#ffffff",
  roadMajor: "#ffffff",
  roadCasing: "#d9d3c3",
  motorway: "#fdf1d8",
  rail: "#cfc7b4",
  boundary: "#c9c1ae",
  label: "#4a5b6c",
  labelStrong: "#0b1f33",
  halo: "#f3f0e7",
};

const DARK: Palette = {
  name: "Cauce Dark",
  background: "#0a1826",
  residential: "#0d1f31",
  park: "#0f2629",
  water: "#0f3e57",
  waterway: "#2f8fb3",
  waterLabel: "#7cc4dc",
  building: "#13293f",
  buildingOutline: "#183451",
  roadMinor: "#1a3550",
  roadMajor: "#22405f",
  roadCasing: "#0a1826",
  motorway: "#2a4a6b",
  rail: "#1e3a55",
  boundary: "#2a4561",
  label: "#a9b8c7",
  labelStrong: "#eef2f6",
  halo: "#0a1826",
};

type Layer = {
  id: string;
  type: string;
  source?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

function recolor(layer: Layer, p: Palette): Layer {
  const paint = { ...(layer.paint ?? {}) };
  const id = layer.id;

  if (layer.type === "background") paint["background-color"] = p.background;
  else if (id === "water") paint["fill-color"] = p.water;
  else if (id === "waterway") {
    paint["line-color"] = p.waterway;
    paint["line-width"] = [
      "interpolate",
      ["exponential", 1.4],
      ["zoom"],
      10,
      0.8,
      14,
      2.2,
      18,
      7,
    ];
  } else if (id === "park" || id.startsWith("landcover"))
    paint["fill-color"] = p.park;
  else if (id === "landuse_residential") paint["fill-color"] = p.residential;
  else if (id === "building") {
    paint["fill-color"] = p.building;
    paint["fill-outline-color"] = p.buildingOutline;
  } else if (id.startsWith("aeroway")) {
    if (layer.type === "fill") paint["fill-color"] = p.residential;
    else paint["line-color"] = p.roadMajor;
  } else if (id.startsWith("railway")) paint["line-color"] = p.rail;
  else if (id.startsWith("boundary")) paint["line-color"] = p.boundary;
  else if (layer.type === "line") {
    if (id.includes("casing")) paint["line-color"] = p.roadCasing;
    else if (id.includes("motorway")) paint["line-color"] = p.motorway;
    else if (id.includes("major")) paint["line-color"] = p.roadMajor;
    else paint["line-color"] = p.roadMinor;
  } else if (layer.type === "fill" && id.startsWith("road")) {
    paint["fill-color"] = p.roadMinor;
  } else if (layer.type === "symbol") {
    const isWater = id.startsWith("water");
    const isPlace = id.startsWith("label_");
    paint["text-color"] = isWater
      ? p.waterLabel
      : isPlace
        ? p.labelStrong
        : p.label;
    paint["text-halo-color"] = p.halo;
    paint["text-halo-width"] = 1.4;
  }

  return { ...layer, paint };
}

async function main() {
  const response = await fetch(SOURCE_STYLE);
  if (!response.ok) throw new Error(`Failed to fetch ${SOURCE_STYLE}`);
  const base = (await response.json()) as {
    sources: Record<string, unknown>;
    layers: Layer[];
    [key: string]: unknown;
  };

  await mkdir(OUT_DIR, { recursive: true });

  for (const [file, palette] of [
    ["cauce-light.json", LIGHT],
    ["cauce-dark.json", DARK],
  ] as const) {
    const { ne2_shaded: _shadedRelief, ...sources } = base.sources;
    const style = {
      ...base,
      name: palette.name,
      sources,
      layers: base.layers
        .filter((layer) => layer.source !== "ne2_shaded")
        .map((layer) => recolor(layer, palette)),
    };
    await writeFile(
      path.join(OUT_DIR, file),
      `${JSON.stringify(style, null, 2)}\n`,
    );
    console.log(`Wrote public/map/styles/${file}`);
  }
}

await main();
