/**
 * Insights seed: flood events from dated news reports, per-cell satellite elevation
 * (from the committed data/elevation-r9.json) and an initial risk run. No network.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cellToLatLng, cellToParent, gridDisk } from "h3-js";
import { COLONIAS } from "@/config/pilot";
import { computeRiskScores } from "@/features/insights/server/risk";
import { db } from "@/lib/db/client";
import { floodHistory, h3Cells } from "@/lib/db/schema";
import { haversineMeters } from "@/lib/geo";
import { h3Cells as cellsFor } from "@/lib/h3";
import { prefixedId } from "@/lib/ids";

const PLANO_OCT_2026 =
  "https://planoinformativo.com/1173492/dejan-lluvias-a-matamoros-bajo-el-agua";

/** Colonias named in the 4 Oct 2026 coverage (frente frío No. 1, 215.9 mm). */
const EVENTS = [
  { colonia: "Buenavista", note: "Sin acceso por acumulación de agua" },
  { colonia: "San Francisco", note: "Sin acceso por acumulación de agua" },
  { colonia: "Los Sauces", note: "Sin acceso por acumulación de agua" },
  { colonia: "Paseo Residencial", note: "Sin acceso por acumulación de agua" },
  { colonia: "Nuevo Milenio", note: "Daños severos; agua dentro de viviendas" },
  {
    colonia: "Rinconada de las Brisas",
    note: "Daños severos; agua dentro de viviendas",
  },
  { colonia: "Los Palmares", note: "Daños severos; agua dentro de viviendas" },
];

const COLONIA_RADIUS_M = 1200;

export async function seedInsights(): Promise<{
  events: number;
  cells: number;
  risk: number;
}> {
  const database = db();

  await database.delete(floodHistory);
  const events = EVENTS.flatMap(({ colonia, note }) => {
    const match = COLONIAS.find((c) => c.name === colonia);
    if (!match) return [];
    const [lng, lat] = match.center;
    return [
      {
        id: prefixedId("fld"),
        source: "news" as const,
        sourceUrl: PLANO_OCT_2026,
        eventDate: "2026-10-04",
        colonia,
        lat,
        lng,
        h3r8: cellsFor(lat, lng).h3r8,
        description: note,
      },
    ];
  });
  if (events.length) await database.insert(floodHistory).values(events);

  const file = JSON.parse(
    await readFile(path.join(process.cwd(), "data/elevation-r9.json"), "utf8"),
  ) as { elevations: Record<string, number> };

  // Mean r9 elevation per r8 cell.
  const sums = new Map<string, { total: number; n: number }>();
  for (const [r9, meters] of Object.entries(file.elevations)) {
    const r8 = cellToParent(r9, 8);
    const entry = sums.get(r8) ?? { total: 0, n: 0 };
    entry.total += meters;
    entry.n += 1;
    sums.set(r8, entry);
  }
  const mean = new Map([...sums].map(([r8, s]) => [r8, s.total / s.n]));

  const rows = [...mean.entries()].map(([h3r8, elevationM]) => {
    const ring = gridDisk(h3r8, 2).filter((c) => c !== h3r8 && mean.has(c));
    const surroundings =
      ring.reduce((total, c) => total + (mean.get(c) ?? 0), 0) /
      (ring.length || 1);
    const [lat, lng] = cellToLatLng(h3r8);
    const nearest = COLONIAS.map((c) => ({
      name: c.name,
      distance: haversineMeters(
        { lat, lng },
        { lat: c.center[1], lng: c.center[0] },
      ),
    })).sort((a, b) => a.distance - b.distance)[0];
    return {
      h3r8,
      centroidLat: lat,
      centroidLng: lng,
      elevationM: Math.round(elevationM * 10) / 10,
      relativeElevationM: ring.length
        ? Math.round((elevationM - surroundings) * 10) / 10
        : null,
      colonia:
        nearest && nearest.distance <= COLONIA_RADIUS_M ? nearest.name : null,
    };
  });

  await database.delete(h3Cells);
  for (let i = 0; i < rows.length; i += 200) {
    await database.insert(h3Cells).values(rows.slice(i, i + 200));
  }

  const run = await computeRiskScores();
  return { events: events.length, cells: rows.length, risk: run.cells };
}
