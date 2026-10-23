/**
 * Pilot city: Matamoros, Tamaulipas. Reports are accepted anywhere in Mexico
 * (config/service-area.ts); the pilot frames the authorities panel, the insights
 * area and the demo data.
 * Colonia centroids are approximate (OSM coverage of colonias is thin); see PLAN.md §1.
 */
import type { LngLat } from "./service-area";

export const PILOT = {
  city: "Matamoros",
  state: "Tamaulipas",
  timeZone: "America/Matamoros",
  /** The west/southwest flood belt plus downtown. */
  center: [-97.54, 25.84] as LngLat,
  zoom: 13,
  minZoom: 10,
  maxZoom: 19,
} as const;

export type Colonia = {
  name: string;
  center: LngLat;
  /** Approximate radius in meters, used to scatter demo data. */
  radiusM: number;
  focus: boolean;
};

export const COLONIAS: Colonia[] = [
  { name: "Buenavista", center: [-97.562, 25.8226], radiusM: 450, focus: true },
  {
    name: "San Francisco",
    center: [-97.5617, 25.8312],
    radiusM: 400,
    focus: true,
  },
  { name: "Los Sauces", center: [-97.52, 25.851], radiusM: 400, focus: true },
  {
    name: "Paseo Residencial",
    center: [-97.524, 25.8545],
    radiusM: 350,
    focus: false,
  },
  {
    name: "Los Palmares",
    center: [-97.5533, 25.8441],
    radiusM: 400,
    focus: false,
  },
  {
    name: "Rinconada de las Brisas",
    center: [-97.5641, 25.8465],
    radiusM: 350,
    focus: false,
  },
  {
    name: "Nuevo Milenio",
    center: [-97.5585, 25.8385],
    radiusM: 350,
    focus: false,
  },
  {
    name: "Residencial Misiones",
    center: [-97.5498, 25.8297],
    radiusM: 350,
    focus: false,
  },
  {
    name: "Valle Alto",
    center: [-97.5139, 25.8507],
    radiusM: 400,
    focus: false,
  },
  { name: "Centro", center: [-97.5047, 25.8797], radiusM: 700, focus: false },
];
