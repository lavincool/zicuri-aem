/** Area covered by forecasts, elevation and risk scores (urban Matamoros). */
export const INSIGHTS_BBOX = {
  west: -97.62,
  south: 25.77,
  east: -97.43,
  north: 25.93,
} as const;

/** Polygon ring for h3 polygonToCells (lat, lng order). */
export const INSIGHTS_POLYGON: [number, number][] = [
  [INSIGHTS_BBOX.south, INSIGHTS_BBOX.west],
  [INSIGHTS_BBOX.south, INSIGHTS_BBOX.east],
  [INSIGHTS_BBOX.north, INSIGHTS_BBOX.east],
  [INSIGHTS_BBOX.north, INSIGHTS_BBOX.west],
];

/** SMN (CONAGUA) web service ids for Matamoros, Tamaulipas. */
export const SMN_MUNICIPALITY = { ides: "28", idmun: "22" } as const;
