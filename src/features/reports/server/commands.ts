import "server-only";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reportFlags,
  reportSignals,
  reportStatusEvents,
  reports,
} from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { prefixedId } from "@/lib/ids";
import {
  applySignalToCounts,
  effectiveStatus,
  expiryFrom,
  SIGNAL_WINDOW_MS,
  type SignalKind,
  shouldHide,
  shouldResolve,
} from "../rules";
import type { FlagReason } from "../schema";

export type SignalResult = {
  status: "open" | "resolved";
  stillThereCount: number;
  fixedCount: number;
  mySignal: SignalKind;
  statusChanged: boolean;
};

export async function recordSignal(input: {
  reportId: string;
  browserHash: string;
  kind: SignalKind;
  now?: Date;
}): Promise<SignalResult> {
  const now = input.now ?? new Date();
  return db().transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new DomainError("NOT_FOUND", 404, "Report not found");
    if (effectiveStatus(report, now) !== "open") {
      throw new DomainError("REPORT_NOT_OPEN", 409, "Report is not open");
    }

    const [existing] = await tx
      .select()
      .from(reportSignals)
      .where(
        and(
          eq(reportSignals.reportId, report.id),
          eq(reportSignals.browserHash, input.browserHash),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.kind !== input.kind) {
        await tx
          .update(reportSignals)
          .set({ kind: input.kind, updatedAt: now })
          .where(eq(reportSignals.id, existing.id));
      }
    } else {
      await tx.insert(reportSignals).values({
        id: prefixedId("sig"),
        reportId: report.id,
        browserHash: input.browserHash,
        kind: input.kind,
        createdAt: now,
        updatedAt: now,
      });
    }

    const counts = applySignalToCounts(
      { stillThere: report.stillThereCount, fixed: report.fixedCount },
      existing?.kind ?? null,
      input.kind,
    );

    const recentRows = await tx
      .select({ kind: reportSignals.kind, total: count() })
      .from(reportSignals)
      .where(
        and(
          eq(reportSignals.reportId, report.id),
          gte(
            reportSignals.updatedAt,
            new Date(now.getTime() - SIGNAL_WINDOW_MS),
          ),
        ),
      )
      .groupBy(reportSignals.kind);
    const recent = {
      fixed: recentRows.find((r) => r.kind === "fixed")?.total ?? 0,
      stillThere: recentRows.find((r) => r.kind === "still_there")?.total ?? 0,
    };
    const resolve = shouldResolve(recent);
    const confirmed = input.kind === "still_there";

    await tx
      .update(reports)
      .set({
        stillThereCount: counts.stillThere,
        fixedCount: counts.fixed,
        ...(confirmed
          ? {
              lastConfirmedAt: now,
              expiresAt: expiryFrom(report.category, now),
            }
          : {}),
        ...(resolve
          ? { status: "resolved", resolvedAt: now, statusChangedAt: now }
          : {}),
        updatedAt: now,
      })
      .where(eq(reports.id, report.id));

    if (resolve) {
      await tx.insert(reportStatusEvents).values({
        id: prefixedId("evt"),
        reportId: report.id,
        fromStatus: "open",
        toStatus: "resolved",
        reason: "signals",
        actor: input.browserHash,
        createdAt: now,
      });
    }

    return {
      status: resolve ? "resolved" : "open",
      stillThereCount: counts.stillThere,
      fixedCount: counts.fixed,
      mySignal: input.kind,
      statusChanged: resolve,
    };
  });
}

export async function recordFlag(input: {
  reportId: string;
  browserHash: string;
  reason: FlagReason;
  now?: Date;
}): Promise<{ hidden: boolean }> {
  const now = input.now ?? new Date();
  return db().transaction(async (tx) => {
    const [report] = await tx
      .select({
        id: reports.id,
        status: reports.status,
        flagCount: reports.flagCount,
      })
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new DomainError("NOT_FOUND", 404, "Report not found");

    const inserted = await tx
      .insert(reportFlags)
      .values({
        id: prefixedId("flg"),
        reportId: report.id,
        browserHash: input.browserHash,
        reason: input.reason,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: reportFlags.id });
    if (inserted.length === 0) return { hidden: report.status === "hidden" };

    const flagCount = report.flagCount + 1;
    const hide = report.status !== "hidden" && shouldHide(flagCount);
    await tx
      .update(reports)
      .set({
        flagCount,
        ...(hide ? { status: "hidden", statusChangedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(reports.id, report.id));
    if (hide) {
      await tx.insert(reportStatusEvents).values({
        id: prefixedId("evt"),
        reportId: report.id,
        fromStatus: report.status,
        toStatus: "hidden",
        reason: "flags",
        actor: "system",
        createdAt: now,
      });
    }
    return { hidden: hide || report.status === "hidden" };
  });
}

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

/**
 * Persists expiry for open water reports whose time ran out. Reads already treat them
 * as expired; this keeps the table and status history accurate. Throttled per instance.
 */
export async function sweepExpiredReports(now = new Date()): Promise<number> {
  if (now.getTime() - lastSweep < SWEEP_INTERVAL_MS) return 0;
  lastSweep = now.getTime();

  const due = await db()
    .select({ id: reports.id, expiresAt: reports.expiresAt })
    .from(reports)
    .where(and(eq(reports.status, "open"), lte(reports.expiresAt, now)))
    .limit(500);
  if (due.length === 0) return 0;

  const ids = due.map((r) => r.id);
  await db().batch([
    db()
      .update(reports)
      .set({
        status: "expired",
        statusChangedAt: sql`${reports.expiresAt}`,
        updatedAt: now,
      })
      .where(and(inArray(reports.id, ids), eq(reports.status, "open"))),
    db()
      .insert(reportStatusEvents)
      .values(
        due.map((r) => ({
          id: prefixedId("evt"),
          reportId: r.id,
          fromStatus: "open" as const,
          toStatus: "expired" as const,
          reason: "expired" as const,
          actor: "system",
          createdAt: r.expiresAt ?? now,
        })),
      ),
  ]);
  return due.length;
}
