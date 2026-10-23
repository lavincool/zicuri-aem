import { latLngToCell } from "h3-js";

/** r8 ≈ 0.74 km² (risk, aggregation) · r9 ≈ 0.1 km² ("near here", hotspots). */
export const H3_RESOLUTIONS = { forecast: 7, risk: 8, local: 9 } as const;

export function h3Cells(lat: number, lng: number) {
  return {
    h3r8: latLngToCell(lat, lng, H3_RESOLUTIONS.risk),
    h3r9: latLngToCell(lat, lng, H3_RESOLUTIONS.local),
  };
}
