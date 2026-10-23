import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimitBuckets } from "@/lib/db/schema";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Fixed-window counter in the database (in-memory limits don't work across
 * serverless instances). Every key must stay within `limit` per window.
 */
export async function rateLimit(
  keys: string[],
  limit: number,
  windowSeconds: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const retryAfterSeconds = Math.ceil((windowStart + windowMs - now) / 1000);

  let allowed = true;
  for (const key of keys) {
    const [row] = await db()
      .insert(rateLimitBuckets)
      .values({ key: `${key}:${windowStart}`, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: { count: sql`${rateLimitBuckets.count} + 1` },
      })
      .returning({ count: rateLimitBuckets.count });
    if ((row?.count ?? 0) > limit) allowed = false;
  }

  // Opportunistic cleanup of old windows.
  if (Math.random() < 0.05) {
    await db()
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.expiresAt, new Date(now)));
  }
  return { allowed, retryAfterSeconds };
}
