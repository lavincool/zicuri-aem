/**
 * Cities for `bun run seed:scenario`: flood-prone areas where reports land, and the drains or
 * arroyos where canal reports go. scripts/build-scenario-places.ts turns these into points on
 * real OpenStreetMap streets (data/scenario-places.json).
 */
import type { ReportCategory } from "@/config/categories";
import type { DemoCity } from "@/config/demo-photos";
import { COLONIAS, PILOT } from "@/config/pilot";
import type { LngLat } from "@/config/service-area";

export type ScenarioArea = {
  name: string;
  /** Circle to sample streets from; omit to sample `street` anywhere in the city. */
  center?: LngLat;
  radiusM?: number;
  /** Only streets whose OSM name matches (a corridor such as Av. del Niño). */
  street?: RegExp;
  /** Relative share of reports: low-lying, poorly drained areas get more. */
  weight: number;
  /** Use the name as colonia when reverse geocoding finds none. */
  isColonia?: boolean;
  /** Notes residents write about this hotspot, by category. */
  notes?: Partial<Record<ReportCategory, string[]>>;
};

export type WaterSource = {
  /** Shown in notes: "el dren", "el Arroyo de la Plata". */
  name: string;
  /** OSM waterways (not rivers) whose name matches; `null` takes any, named or not. */
  waterway?: RegExp | null;
  /** A street that runs along the channel, used when the channel itself is not mapped. */
  street?: RegExp;
  weight: number;
};

/** A point on a real street or drain, from data/scenario-places.json. */
export type ScenarioPlace = {
  area: string;
  kind: "street" | "water";
  lat: number;
  lng: number;
  address: string | null;
  colonia: string | null;
  municipality: string | null;
  state: string | null;
  /** Water points: the name residents use ("el dren"). */
  waterway: string | null;
};

export type ScenarioCity = {
  id: DemoCity;
  label: string;
  /** State name as reverse geocoding returns it; points elsewhere are dropped. */
  state: string;
  /** Daytime reports (cleaning, upkeep) follow local hours. */
  timeZone: string;
  /** West, south, east, north: the Overpass query area. */
  bbox: [number, number, number, number];
  /** Points north of this latitude are dropped (Brownsville sits across the river). */
  maxLat?: number;
  /** Waterway points must lie this close to an area center (keeps them in town). */
  waterNearM: number;
  /** Who residents expect to come: shown in some notes. */
  utility: string;
  areas: ScenarioArea[];
  water: WaterSource[];
};

const pilotAreas: ScenarioArea[] = COLONIAS.map((c) => ({
  name: c.name,
  center: c.center,
  radiusM: c.radiusM,
  weight: c.focus ? 3 : c.name === "Centro" ? 0.8 : 1.6,
  isColonia: true,
}));

export const SCENARIO_CITIES: Record<DemoCity, ScenarioCity> = {
  matamoros: {
    id: "matamoros",
    label: `${PILOT.city}, ${PILOT.state}`,
    state: PILOT.state,
    timeZone: PILOT.timeZone,
    bbox: [-97.6, 25.79, -97.44, 25.9],
    maxLat: 25.885,
    waterNearM: 900,
    utility: "la Junta de Aguas",
    areas: [
      ...pilotAreas,
      // OSM neighbourhoods in the same western flood belt and the low east side.
      {
        name: "Los Palmares II",
        center: [-97.5499, 25.8372],
        radiusM: 250,
        weight: 1.4,
        isColonia: true,
      },
      {
        name: "Palmares de las Brisas",
        center: [-97.5635, 25.8551],
        radiusM: 250,
        weight: 1.4,
        isColonia: true,
      },
      {
        name: "Valle de los Reyes",
        center: [-97.5494, 25.8571],
        radiusM: 250,
        weight: 1,
        isColonia: true,
      },
      {
        name: "Jacarandas",
        center: [-97.5658, 25.8577],
        radiusM: 200,
        weight: 1,
        isColonia: true,
      },
      {
        name: "Paseo del Nogalar",
        center: [-97.5653, 25.8616],
        radiusM: 250,
        weight: 0.8,
        isColonia: true,
      },
      {
        name: "Colonia Montalvo",
        center: [-97.5844, 25.8724],
        radiusM: 250,
        weight: 0.8,
        isColonia: true,
      },
      {
        name: "Melitón Suárez",
        center: [-97.4834, 25.8317],
        radiusM: 300,
        weight: 1.2,
        isColonia: true,
      },
      {
        name: "25 de Mayo",
        center: [-97.4688, 25.8264],
        radiusM: 300,
        weight: 1.2,
        isColonia: true,
      },
      {
        name: "Tierra Prometida",
        center: [-97.4591, 25.8204],
        radiusM: 250,
        weight: 1.2,
        isColonia: true,
      },
      {
        name: "Puerta Dorada",
        center: [-97.4649, 25.8358],
        radiusM: 250,
        weight: 0.8,
        isColonia: true,
      },
      // Corridors from the October 2026 news (PLAN.md §1).
      {
        name: "Avenida del Niño",
        street: /^Av\. Del Niño$/,
        weight: 1.5,
        notes: {
          sewage_backflow: [
            "Otra vez brota el drenaje en la Del Niño, igual que en el frente frío.",
            "Aguas negras sobre la avenida, los carros las avientan a la banqueta.",
          ],
          flooded_street: ["La Del Niño está cerrada por el agua, desvíense."],
        },
      },
      {
        name: "Avenida Solidaridad",
        // The secondary road near Av. del Niño, not the residential street of the same name.
        street: /^Calle Solidaridad$/,
        center: [-97.495, 25.846],
        radiusM: 1600,
        weight: 1.2,
        notes: {
          flooded_street: [
            "En la Solidaridad ya hay carros varados, el agua está muy honda.",
            "No se metan a la Solidaridad, otra vez está como en octubre.",
          ],
        },
      },
    ],
    water: [
      // Drains in OSM have no names here; residents call them "el dren".
      { name: "el dren", waterway: null, weight: 1 },
    ],
  },
  zacatecas: {
    id: "zacatecas",
    label: "Zacatecas y Guadalupe, Zacatecas",
    state: "Zacatecas",
    timeZone: "America/Mexico_City",
    bbox: [-102.62, 22.72, -102.47, 22.8],
    waterNearM: 1500,
    utility: "la JIAPAZ",
    areas: [
      {
        name: "Bulevar López Mateos",
        street: /López Mateos/i,
        weight: 3,
        notes: {
          flooded_street: [
            "El bulevar se volvió río otra vez, los carros no pueden pasar.",
            "Toda el agua de los cerros baja al bulevar.",
          ],
        },
      },
      {
        name: "Arroyo de la Plata (Guadalupe)",
        center: [-102.541, 22.755],
        radiusM: 600,
        weight: 3,
      },
      {
        name: "Centro Histórico",
        center: [-102.5728, 22.7755],
        radiusM: 450,
        weight: 1.5,
        notes: {
          flooded_street: [
            "El agua baja como río por los callejones del centro.",
            "Se metió el agua a los negocios de la avenida.",
          ],
          other: ["Bajaron piedras y lodo de los callejones."],
        },
      },
      {
        name: "Alma Obrera",
        center: [-102.5657, 22.758],
        radiusM: 450,
        weight: 1.5,
      },
      {
        name: "Calzada Héroes de Chapultepec",
        street: /Héroes de Chapultepec/i,
        weight: 1.5,
      },
      {
        name: "Avenida Pedro Coronel",
        street: /Pedro Coronel/i,
        weight: 1.2,
      },
      {
        name: "Centro de Guadalupe",
        center: [-102.518, 22.747],
        radiusM: 550,
        weight: 1.5,
      },
      {
        name: "Tierra y Libertad",
        center: [-102.515, 22.7585],
        radiusM: 450,
        weight: 1,
      },
      {
        name: "Las Quintas",
        center: [-102.4917, 22.7676],
        radiusM: 450,
        weight: 1,
      },
      {
        name: "Lomas de la Pimienta",
        center: [-102.5863, 22.7649],
        radiusM: 400,
        weight: 0.8,
      },
    ],
    water: [
      {
        name: "el Arroyo de la Plata",
        street: /Vialidad Arroyo de la Plata/i,
        weight: 3,
      },
      { name: "el arroyo", waterway: null, weight: 1.5 },
    ],
  },
};
