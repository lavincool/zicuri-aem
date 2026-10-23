import "server-only";
import { z } from "zod";
import { env } from "./env";

/** Browsers send a fresh Turnstile token with each protected request. */
export const TURNSTILE_HEADER = "x-turnstile-token";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const siteverifySchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
});

export type TurnstileOutcome = "ok" | "invalid" | "unavailable";

/** A siteverify answer counts only for the expected action and an approved hostname. */
export function acceptSiteverify(
  body: unknown,
  action: string,
  hostnames: ReadonlySet<string>,
): boolean {
  const parsed = siteverifySchema.safeParse(body);
  return (
    parsed.success &&
    parsed.data.success &&
    parsed.data.action === action &&
    hostnames.has(parsed.data.hostname ?? "")
  );
}

export function turnstileEnabled(): boolean {
  return Boolean(env().TURNSTILE_SECRET);
}

/**
 * Canonical server-side Turnstile check. Fails closed: a missing or bad token is
 * "invalid"; an unreachable siteverify is "unavailable" so clients retry later.
 */
export async function verifyTurnstile(
  token: string | null,
  { action, remoteIp }: { action: string; remoteIp: string | null },
): Promise<TurnstileOutcome> {
  const { TURNSTILE_SECRET: secret, TURNSTILE_HOSTNAMES: hostnames } = env();
  if (!secret || hostnames.size === 0) return "invalid";
  if (!token || token.length > 2048) return "invalid";
  let body: unknown;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    body = await response.json();
  } catch (error) {
    console.error("Turnstile siteverify failed", error);
    return "unavailable";
  }
  return acceptSiteverify(body, action, hostnames) ? "ok" : "invalid";
}
