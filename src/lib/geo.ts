export type Bbox = [west: number, south: number, east: number, north: number];

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Offsets a point by meters (good enough at city scale). */
export function offsetMeters(
  lat: number,
  lng: number,
  northM: number,
  eastM: number,
): { lat: number; lng: number } {
  const dLat = northM / 111_320;
  const dLng = eastM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * Snaps a bbox outward to a zoom-dependent grid so nearby viewers share
 * CDN cache entries for the same area. The result stays within valid
 * coordinates, which matters at country-wide zooms.
 */
export function snapBbox(bbox: Bbox, zoom: number): Bbox {
  const step = 360 / 2 ** Math.max(0, Math.floor(zoom) - 1);
  const down = (v: number) => Math.floor(v / step) * step;
  const up = (v: number) => Math.ceil(v / step) * step;
  const round = (v: number, limit: number) =>
    Number(Math.min(Math.max(v, -limit), limit).toFixed(5));
  return [
    round(down(bbox[0]), 180),
    round(down(bbox[1]), 90),
    round(up(bbox[2]), 180),
    round(up(bbox[3]), 90),
  ];
}

/** Polygons as GeoJSON coordinates: each polygon is an outer ring plus holes, in [lng, lat]. */
export type Polygons = number[][][][];

function insideRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Ray-casting point-in-polygon over several polygons with holes. */
export function insidePolygons(
  lng: number,
  lat: number,
  polygons: Polygons,
): boolean {
  return polygons.some(
    ([outer, ...holes]) =>
      outer !== undefined &&
      insideRing(lng, lat, outer) &&
      !holes.some((hole) => insideRing(lng, lat, hole)),
  );
}

/** Bounding box of polygons (west, south, east, north). */
export function polygonsBbox(polygons: Polygons): Bbox {
  const bbox: Bbox = [180, 90, -180, -90];
  for (const [outer] of polygons) {
    for (const [lng, lat] of outer ?? []) {
      bbox[0] = Math.min(bbox[0], lng as number);
      bbox[1] = Math.min(bbox[1], lat as number);
      bbox[2] = Math.max(bbox[2], lng as number);
      bbox[3] = Math.max(bbox[3], lat as number);
    }
  }
  return bbox;
}
