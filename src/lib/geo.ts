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
 * CDN cache entries for the same area.
 */
export function snapBbox(bbox: Bbox, zoom: number): Bbox {
  const step = 360 / 2 ** Math.max(0, Math.floor(zoom) - 1);
  const down = (v: number) => Math.floor(v / step) * step;
  const up = (v: number) => Math.ceil(v / step) * step;
  const round = (v: number) => Number(v.toFixed(5));
  return [
    round(down(bbox[0])),
    round(down(bbox[1])),
    round(up(bbox[2])),
    round(up(bbox[3])),
  ];
}
