/**
 * Where Cauce accepts reports and sensors: all of Mexico. The outline is Natural Earth's
 * land boundary buffered 5 km (coasts, the border river) and simplified to ~850 vertices;
 * rebuild it with scripts/build-service-area.ts.
 */
import {
  type Bbox,
  insidePolygons,
  type Polygons,
  polygonsBbox,
} from "@/lib/geo";
import outline from "./service-area.json";

export type LngLat = [lng: number, lat: number];

const POLYGONS = outline as Polygons;
const BBOX: Bbox = polygonsBbox(POLYGONS);

/** A fixed national view for small embedded maps; the main map uses fitMexico(). */
export const MEXICO_VIEW = {
  center: [-102.4, 23.9] as LngLat,
  zoom: 4.2,
} as const;

export const MAP_ZOOM = { min: 2.5, max: 19 } as const;

/** Mainland Mexico, for framing the national view (west, south, east, north). */
const MAINLAND: Bbox = [-117.2, 14.4, -86.6, 32.8];
/** Room for the top bar, filters and the report button. */
const CHROME_PX = { x: 16, y: 280 };
const TILE_PX = 512;

/** Center and zoom that fit mainland Mexico in a viewport of this size. */
export function fitMexico(
  width: number,
  height: number,
): { center: LngLat; zoom: number } {
  const [west, south, east, north] = MAINLAND;
  const mercator = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const zoomX = Math.log2(
    (Math.max(width - 2 * CHROME_PX.x, 1) * 360) / (TILE_PX * (east - west)),
  );
  const zoomY = Math.log2(
    (Math.max(height - CHROME_PX.y, 1) * 2 * Math.PI) /
      (TILE_PX * (mercator(north) - mercator(south))),
  );
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), MAP_ZOOM.min), 5.5);
  const midY = (mercator(north) + mercator(south)) / 2;
  const lat = (Math.atan(Math.sinh(midY)) * 180) / Math.PI;
  return {
    center: [(west + east) / 2, Number(lat.toFixed(4))],
    zoom: Number(zoom.toFixed(2)),
  };
}

/** Zoom used when the map opens on a city (IP location, place search). */
export const CITY_ZOOM = 12;

/** Server-rendered dates use central Mexico time; browsers format in their own zone. */
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

export function isInsideServiceArea(lng: number, lat: number): boolean {
  const [west, south, east, north] = BBOX;
  if (lng < west || lng > east || lat < south || lat > north) return false;
  return insidePolygons(lng, lat, POLYGONS);
}
