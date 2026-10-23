import "server-only";
import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { cellToParent, gridDisk } from "h3-js";
import { deviceLevel } from "@/features/devices/rules";
import { effectiveStatus } from "@/features/reports/rules";
import { db } from "@/lib/db/client";
import {
  devices,
  floodHistory,
  forecastCells,
  forecastSnapshots,
  h3Cells,
  reports,
  riskScores,
} from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";
import {
  blockageWeight,
  RISK_MODEL_VERSION,
  type RiskInputs,
  scoreCell,
} from "../risk/model";

const DAY_MS = 24 * 3_600_000;
const BLOCKAGE_CATEGORIES = ["blocked_drain", "broken_cover"] as const;
const WATER_CATEGORIES = [
  "flooded_street",
  "overflowing_canal",
  "sewage_backflow",
] as const;
/** A recorded flood event weighs like a couple of neighbor reports. */
const EVENT_WEIGHT = 2;
const NEIGHBOR_SHARE = 0.5;

type CellAccumulator = {
  blockageWeight: number;
  blockageCount: number;
  history: number;
  sensorRatio: number | null;
};

/** Latest Open-Meteo snapshot (real or scenario) used for scoring. */
export async function latestForecastSnapshot() {
  const [snapshot] = await db()
    .select()
    .from(forecastSnapshots)
    .where(eq(forecastSnapshots.provider, "open_meteo"))
    .orderBy(desc(forecastSnapshots.fetchedAt))
    .limit(1);
  return snapshot ?? null;
}

/** Scores every known cell and stores the batch as a new run. Returns the run id. */
export async function computeRiskScores(now = new Date()): Promise<{
  runId: string;
  cells: number;
}> {
  const database = db();
  const snapshot = await latestForecastSnapshot();
  const rainByR7 = new Map<string, number>();
  if (snapshot) {
    const rows = await database
      .select({ h3r7: forecastCells.h3r7, mm: forecastCells.precip48hMm })
      .from(forecastCells)
      .where(eq(forecastCells.snapshotId, snapshot.id));
    for (const row of rows) rainByR7.set(row.h3r7, row.mm);
  }

  const [cellRows, reportRows, historyRows, deviceRows] = await Promise.all([
    database.select().from(h3Cells),
    database
      .select({
        h3r8: reports.h3r8,
        category: reports.category,
        status: reports.status,
        expiresAt: reports.expiresAt,
        severity: reports.severity,
        stillThereCount: reports.stillThereCount,
      })
      .from(reports)
      .where(
        and(
          ne(reports.status, "hidden"),
          gte(reports.createdAt, new Date(now.getTime() - 365 * DAY_MS)),
        ),
      ),
    database.select({ h3r8: floodHistory.h3r8 }).from(floodHistory),
    database.select().from(devices).where(ne(devices.status, "retired")),
  ]);

  const acc = new Map<string, CellAccumulator>();
  const cell = (h3: string) => {
    let entry = acc.get(h3);
    if (!entry) {
      entry = {
        blockageWeight: 0,
        blockageCount: 0,
        history: 0,
        sensorRatio: null,
      };
      acc.set(h3, entry);
    }
    return entry;
  };
  for (const row of cellRows) cell(row.h3r8);

  for (const report of reportRows) {
    if (
      (BLOCKAGE_CATEGORIES as readonly string[]).includes(report.category) &&
      effectiveStatus(report, now) === "open"
    ) {
      const weight = blockageWeight(report);
      for (const neighbor of gridDisk(report.h3r8, 1)) {
        const share = neighbor === report.h3r8 ? 1 : NEIGHBOR_SHARE;
        cell(neighbor).blockageWeight += weight * share;
      }
      cell(report.h3r8).blockageCount += 1;
    }
    if ((WATER_CATEGORIES as readonly string[]).includes(report.category)) {
      cell(report.h3r8).history += 1;
    }
  }
  for (const event of historyRows) cell(event.h3r8).history += EVENT_WEIGHT;

  for (const device of deviceRows) {
    if (!device.h3r8 || device.lastLevelCm === null) continue;
    if (deviceLevel(device, now) === "offline") continue;
    const ratio = Math.max(0, device.lastLevelCm / device.warningCm);
    for (const neighbor of gridDisk(device.h3r8, 1)) {
      const entry = cell(neighbor);
      entry.sensorRatio = Math.max(entry.sensorRatio ?? 0, ratio);
    }
  }

  const elevation = new Map(
    cellRows.map((c) => [c.h3r8, c.relativeElevationM]),
  );
  const runId = prefixedId("run");
  const rows = [...acc.entries()].map(([h3r8, entry]) => {
    const rain = rainByR7.get(cellToParent(h3r8, 7));
    const inputs: RiskInputs = {
      rain48hMm: snapshot ? (rain ?? 0) : null,
      blockageWeight: entry.blockageWeight,
      blockageCount: entry.blockageCount,
      floodHistoryCount: entry.history,
      sensorRatio: entry.sensorRatio,
      relativeElevationM: elevation.get(h3r8) ?? null,
    };
    const result = scoreCell(inputs);
    return {
      id: prefixedId("rsk"),
      runId,
      h3r8,
      computedAt: now,
      modelVersion: RISK_MODEL_VERSION,
      forecastSnapshotId: snapshot?.id ?? null,
      score: result.score,
      level: result.level,
      baseline: result.baseline,
      factors: result.factors,
    };
  });

  for (let i = 0; i < rows.length; i += 200) {
    await database.insert(riskScores).values(rows.slice(i, i + 200));
  }
  return { runId, cells: rows.length };
}

export async function latestRunId(): Promise<string | null> {
  const [row] = await db()
    .select({ runId: riskScores.runId })
    .from(riskScores)
    .orderBy(desc(riskScores.computedAt))
    .limit(1);
  return row?.runId ?? null;
}

export async function scoresForRun(runId: string, cells?: string[]) {
  return db()
    .select()
    .from(riskScores)
    .where(
      cells
        ? and(eq(riskScores.runId, runId), inArray(riskScores.h3r8, cells))
        : eq(riskScores.runId, runId),
    );
}
