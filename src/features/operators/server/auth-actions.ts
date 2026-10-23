"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  DEMO_OPERATOR_EMAIL,
  LOGIN_REQUESTS_PER_WINDOW,
  LOGIN_WINDOW_S,
} from "@/config/operators";
import { db } from "@/lib/db/client";
import { memberships, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getIpHash } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { hmac } from "@/lib/signing";
import { loginEmailSchema } from "../schema";
import { consumeLoginToken, sendLoginLink } from "./magic-link";
import { endSession, startSession } from "./session";

export type LinkRequestState =
  | { status: "sent" }
  | { error: "invalid_email" | "rate_limited" }
  | null;

/**
 * Always answers "sent" for a well-formed email, so the form never reveals who
 * has an account. Only users with a membership get a link.
 */
export async function requestLoginLinkAction(
  _state: LinkRequestState,
  formData: FormData,
): Promise<LinkRequestState> {
  const parsed = loginEmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "invalid_email" };
  const email = parsed.data;

  const limit = await rateLimit(
    [
      `op-link:email:${hmac(`email:${email}`)}`,
      `op-link:ip:${await getIpHash()}`,
    ],
    LOGIN_REQUESTS_PER_WINDOW,
    LOGIN_WINDOW_S,
  );
  if (!limit.allowed) return { error: "rate_limited" };

  const [user] = await db()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);
  if (user) await sendLoginLink(user);
  return { status: "sent" };
}

export type TokenSignInState = { error: "invalid_link" } | null;

export async function signInWithTokenAction(
  _state: TokenSignInState,
  formData: FormData,
): Promise<TokenSignInState> {
  const token = String(formData.get("token") ?? "");
  const userId = token ? await consumeLoginToken(token) : null;
  if (!userId) return { error: "invalid_link" };
  await startSession(userId);
  redirect("/operador");
}

export type DemoSignInState = { error: "disabled" | "missing" } | null;

/** One-click access to the seeded demo organization; does not exist without DEMO_MODE. */
export async function demoSignInAction(): Promise<DemoSignInState> {
  if (!env().DEMO_MODE) return { error: "disabled" };
  const [user] = await db()
    .select({ id: users.id })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.email, DEMO_OPERATOR_EMAIL))
    .limit(1);
  if (!user) return { error: "missing" };
  await startSession(user.id);
  redirect("/operador");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/operador/entrar");
}
