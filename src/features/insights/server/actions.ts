"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { reportStatusEvents, reports } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getIpHash } from "@/lib/identity";
import { prefixedId } from "@/lib/ids";
import {
  createPanelToken,
  PANEL_COOKIE,
  PANEL_SESSION_MS,
  type PanelRole,
} from "@/lib/panel-auth";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/signing";
import { refreshInsights, runStormScenario } from "./refresh";
import { currentPanelRole } from "./session";

export type LoginState = {
  error: "invalid" | "rate_limited" | "disabled";
} | null;

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const expected = env().PANEL_PASSWORD;
  if (!expected) return { error: "disabled" };
  const limit = await rateLimit(
    [`panel-login:${await getIpHash()}`],
    5,
    15 * 60,
  );
  if (!limit.allowed) return { error: "rate_limited" };
  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, expected)) return { error: "invalid" };

  await startSession("admin");
  redirect("/panel");
}

/** Read-only access for judges and visitors while DEMO_MODE is on. */
export async function demoLogin(): Promise<LoginState> {
  if (!env().DEMO_MODE) return { error: "disabled" };
  await startSession("viewer");
  redirect("/panel");
}

async function startSession(role: PanelRole): Promise<void> {
  (await cookies()).set(PANEL_COOKIE, createPanelToken(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PANEL_SESSION_MS / 1000,
    path: "/",
  });
}

export async function logout(): Promise<void> {
  (await cookies()).delete(PANEL_COOKIE);
  redirect("/panel/entrar");
}

/**
 * Server Actions are public endpoints: re-check the session in each one. Every
 * action changes shared state, so read-only viewers are turned away too.
 */
async function requirePanelAdmin(): Promise<boolean> {
  const role = await currentPanelRole();
  if (!role) redirect("/panel/entrar");
  return role === "admin";
}

export async function refreshForecastAction(): Promise<{ ok: boolean }> {
  if (!(await requirePanelAdmin())) return { ok: false };
  const result = await refreshInsights({ force: true });
  refresh();
  return { ok: result.openMeteo !== "failed" };
}

export async function runScenarioAction(): Promise<void> {
  if (!(await requirePanelAdmin())) return;
  if (!env().DEMO_MODE) return;
  await runStormScenario();
  refresh();
}

export async function setReportHiddenAction(
  reportId: string,
  hidden: boolean,
): Promise<void> {
  if (!(await requirePanelAdmin())) return;
  const [report] = await db()
    .select({ status: reports.status, expiresAt: reports.expiresAt })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  if (!report) return;
  const now = new Date();
  const restored =
    report.expiresAt && report.expiresAt <= now ? "expired" : "open";
  const toStatus = hidden ? "hidden" : restored;
  if (report.status === toStatus) return;
  await db()
    .update(reports)
    .set({ status: toStatus, statusChangedAt: now, updatedAt: now })
    .where(eq(reports.id, reportId));
  await db()
    .insert(reportStatusEvents)
    .values({
      id: prefixedId("evt"),
      reportId,
      fromStatus: report.status,
      toStatus,
      reason: "moderator",
      actor: "panel",
      createdAt: now,
    });
  refresh();
}
