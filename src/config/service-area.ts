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

/** National map view, used when we can't guess the visitor's city. */
export const MEXICO_VIEW = {
  center: [-102.4, 23.9] as LngLat,
  zoom: 4.2,
} as const;

export const MAP_ZOOM = { min: 3.5, max: 19 } as const;

/** Zoom used when the map opens on a city (IP location, place search). */
export const CITY_ZOOM = 12;

/** Server-rendered dates use central Mexico time; browsers format in their own zone. */
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

export function isInsideServiceArea(lng: number, lat: number): boolean {
  const [west, south, east, north] = BBOX;
  if (lng < west || lng > east || lat < south || lat > north) return false;
  return insidePolygons(lng, lat, POLYGONS);
}
