/**
 * MapLibre 6 resolves its worker relative to its own module URL, which breaks under
 * Turbopack chunking. We serve the self-contained worker from public/ instead and
 * point MapLibre at it with setWorkerUrl(). Runs before dev and build.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.join(
  process.cwd(),
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
);
const target = path.join(process.cwd(), "public/map/maplibre-gl-worker.mjs");

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
