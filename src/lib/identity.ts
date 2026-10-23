import "server-only";
import { cookies, headers } from "next/headers";
import { BROWSER_COOKIE, BROWSER_HEADER, hmac, unsign } from "./signing";

/** Stable, anonymous per-browser key (HMAC of the signed cookie ID). Null if absent. */
export async function getBrowserHash(): Promise<string | null> {
  const token =
    (await cookies()).get(BROWSER_COOKIE)?.value ??
    (await headers()).get(BROWSER_HEADER) ??
    null;
  const id = token ? unsign(token) : null;
  return id ? hmac(`browser:${id}`) : null;
}

/** HMAC of the client IP so rate limits never store raw addresses. */
export async function getIpHash(): Promise<string> {
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip") ||
    "unknown";
  return hmac(`ip:${ip}`);
}
