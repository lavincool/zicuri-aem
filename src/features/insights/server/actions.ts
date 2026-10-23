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
  isValidPanelToken,
  PANEL_COOKIE,
  PANEL_SESSION_MS,
} from "@/lib/panel-auth";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/signing";
import { refreshInsights, runStormScenario } from "./refresh";

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

  (await cookies()).set(PANEL_COOKIE, createPanelToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PANEL_SESSION_MS / 1000,
    path: "/",
  });
  redirect("/panel");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(PANEL_COOKIE);
  redirect("/panel/entrar");
}

/** Server Actions are public endpoints: re-check the session in each one. */
async function requirePanel(): Promise<void> {
  if (!isValidPanelToken((await cookies()).get(PANEL_COOKIE)?.value)) {
    redirect("/panel/entrar");
  }
}

export async function refreshForecastAction(): Promise<{ ok: boolean }> {
  await requirePanel();
  const result = await refreshInsights({ force: true });
  refresh();
  return { ok: result.openMeteo !== "failed" };
}

export async function runScenarioAction(): Promise<void> {
  await requirePanel();
  if (!env().DEMO_MODE) return;
  await runStormScenario();
  refresh();
}

export async function setReportHiddenAction(
  reportId: string,
  hidden: boolean,
): Promise<void> {
  await requirePanel();
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
