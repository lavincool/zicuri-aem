import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { createTranslator } from "use-intl/core";
import { LOGIN_TOKEN_TTL_MS } from "@/config/operators";
import { db } from "@/lib/db/client";
import { loginTokens } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import messages from "../../../../messages/es.json";
import { type LoginTokenState, loginTokenState } from "../rules";
import { generateToken, hashToken } from "./tokens";

/**
 * Issues a single-use sign-in link and emails it. Returns the link so the invite
 * script can print it too. Works outside a request (scripts), so the email copy
 * uses next-intl's core translator instead of the request-scoped one.
 */
export async function sendLoginLink(
  user: { id: string; email: string; name: string | null },
  now = new Date(),
): Promise<string> {
  const token = generateToken();
  await db()
    .insert(loginTokens)
    .values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS),
      createdAt: now,
    });
  // Opportunistic cleanup of expired tokens.
  if (Math.random() < 0.1) {
    await db().delete(loginTokens).where(lt(loginTokens.expiresAt, now));
  }

  const link = `${appUrl()}/operador/entrar/${token}`;
  const t = createTranslator({
    locale: "es",
    messages,
    namespace: "operator.email",
  });
  await sendEmail({
    to: user.email,
    subject: t("subject"),
    text: t("body", {
      name: user.name ?? user.email,
      link,
      minutes: LOGIN_TOKEN_TTL_MS / 60_000,
    }),
  });
  return link;
}

/** Checks a link without using it, so the landing page can explain a dead link. */
export async function inspectLoginToken(
  token: string,
  now = new Date(),
): Promise<LoginTokenState> {
  const [row] = await db()
    .select({ expiresAt: loginTokens.expiresAt, usedAt: loginTokens.usedAt })
    .from(loginTokens)
    .where(eq(loginTokens.tokenHash, hashToken(token)))
    .limit(1);
  return loginTokenState(row ?? null, now);
}

/** Atomically marks the token used; returns its user only on the first valid use. */
export async function consumeLoginToken(
  token: string,
  now = new Date(),
): Promise<string | null> {
  const [row] = await db()
    .update(loginTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(loginTokens.tokenHash, hashToken(token)),
        isNull(loginTokens.usedAt),
        gt(loginTokens.expiresAt, now),
      ),
    )
    .returning({ userId: loginTokens.userId });
  return row?.userId ?? null;
}
