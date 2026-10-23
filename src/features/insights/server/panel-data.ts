import "server-only";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";
import type { ReportCategory } from "@/config/categories";
import { deviceLevel } from "@/features/devices/rules";
import { db } from "@/lib/db/client";
import { devices, h3Cells, reports } from "@/lib/db/schema";
import { photoUrl } from "@/lib/storage/urls";
import { drainPriority, type RiskFactor, type RiskLevel } from "../risk/model";
import { latestSnapshots, SCENARIO_MODEL } from "./refresh";
import { latestRunId, scoresForRun } from "./risk";

const DAY_MS = 24 * 3_600_000;
const BLOCKAGES = ["blocked_drain", "broken_cover"] as const;
const MAX_DRAINS = 15;

export type RiskCell = {
  h3r8: string;
  score: number;
  level: RiskLevel;
  baseline: boolean;
  colonia: string | null;
  factors: RiskFactor[];
};

export type DrainItem = {
  id: string;
  category: ReportCategory;
  colonia: string | null;
  address: string | null;
  thumbUrl: string;
  photoColor: string | null;
  severity: number | null;
  stillThereCount: number;
  createdAt: string;
  priority: number;
  cell: RiskCell | null;
};

export type PanelData = {
  /** Server render time, so relative labels hydrate consistently. */
  renderedAt: number;
  forecast: Awaited<ReturnType<typeof latestSnapshots>>;
  scenario: boolean;
  computedAt: string | null;
  kpis: {
    openBlockages: number;
    newReports7d: number;
    medianResolutionHours: number | null;
    sensorsInAlert: number;
    sensorsTotal: number;
  };
  drains: DrainItem[];
  cells: RiskCell[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export async function getPanelData(now = new Date()): Promise<PanelData> {
  const database = db();
  const runId = await latestRunId();
  const [
    forecast,
    scores,
    cellRows,
    blockageRows,
    newReports,
    resolved,
    deviceRows,
  ] = await Promise.all([
    latestSnapshots(),
    runId ? scoresForRun(runId) : Promise.resolve([]),
    database
      .select({ h3r8: h3Cells.h3r8, colonia: h3Cells.colonia })
      .from(h3Cells),
    database
      .select()
      .from(reports)
      .where(
        and(
          inArray(reports.category, BLOCKAGES),
          eq(reports.status, "open"),
          or(isNull(reports.expiresAt), gt(reports.expiresAt, now)),
        ),
      ),
    database
      .select({ total: count() })
      .from(reports)
      .where(
        and(
          ne(reports.status, "hidden"),
          gte(reports.createdAt, new Date(now.getTime() - 7 * DAY_MS)),
        ),
      ),
    database
      .select({ createdAt: reports.createdAt, resolvedAt: reports.resolvedAt })
      .from(reports)
      .where(gte(reports.resolvedAt, new Date(now.getTime() - 30 * DAY_MS))),
    database.select().from(devices).where(ne(devices.status, "retired")),
  ]);

  const colonias = new Map(cellRows.map((c) => [c.h3r8, c.colonia]));
  const cells: RiskCell[] = scores
    .map((s) => ({
      h3r8: s.h3r8,
      score: s.score,
      level: s.level,
      baseline: s.baseline,
      colonia: colonias.get(s.h3r8) ?? null,
      factors: s.factors,
    }))
    .sort((a, b) => b.score - a.score);
  const byCell = new Map(cells.map((c) => [c.h3r8, c]));

  const drains = blockageRows
    .map((report): DrainItem => {
      const cell = byCell.get(report.h3r8) ?? null;
      return {
        id: report.id,
        category: report.category,
        colonia: report.colonia ?? cell?.colonia ?? null,
        address: report.address,
        thumbUrl: photoUrl(report.photoThumbKey),
        photoColor: report.photoColor,
        severity: report.severity,
        stillThereCount: report.stillThereCount,
        createdAt: report.createdAt.toISOString(),
        priority: drainPriority(cell?.score ?? 0, report),
        cell,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_DRAINS);

  const levels = deviceRows.map((d) => deviceLevel(d, now));
  const latestScore = scores[0];

  return {
    renderedAt: now.getTime(),
    forecast,
    scenario: forecast.openMeteo?.model === SCENARIO_MODEL,
    computedAt: latestScore ? latestScore.computedAt.toISOString() : null,
    kpis: {
      openBlockages: blockageRows.length,
      newReports7d: newReports[0]?.total ?? 0,
      medianResolutionHours: median(
        resolved
          .filter((r) => r.resolvedAt)
          .map(
            (r) =>
              ((r.resolvedAt as Date).getTime() - r.createdAt.getTime()) /
              3_600_000,
          ),
      ),
      sensorsInAlert: levels.filter((l) => l === "warning" || l === "critical")
        .length,
      sensorsTotal: deviceRows.length,
    },
    drains,
    cells,
  };
}

/** Moderation queue: hidden reports and any report with flags. */
export async function getModerationQueue() {
  const rows = await db()
    .select()
    .from(reports)
    .where(or(eq(reports.status, "hidden"), gt(reports.flagCount, 0)))
    .orderBy(desc(reports.flagCount), desc(reports.updatedAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    flagCount: r.flagCount,
    colonia: r.colonia,
    note: r.note,
    thumbUrl: photoUrl(r.photoThumbKey),
    createdAt: r.createdAt.toISOString(),
  }));
}
