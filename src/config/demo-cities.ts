import { PILOT } from "./pilot";
import type { LngLat } from "./service-area";

/** Places to explore the seeded examples from the map's empty state. */
export const DEMO_CITIES = [
  { id: "matamoros", city: PILOT.city, center: PILOT.center, zoom: PILOT.zoom },
  {
    id: "zacatecas",
    city: "Zacatecas",
    center: [-102.553, 22.763] as LngLat,
    zoom: 13,
  },
] as const;
