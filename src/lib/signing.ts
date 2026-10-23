import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * HMAC helpers keyed by SESSION_SECRET. Kept free of `server-only` so `proxy.ts`
 * can use them too.
 */
function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET must be set (16+ characters)");
  }
  return value;
}

export function hmac(value: string, length = 32): string {
  return createHmac("sha256", secret())
    .update(value)
    .digest("hex")
    .slice(0, length);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Signs a value as `value.signature`. */
export function sign(value: string): string {
  return `${value}.${hmac(`sig:${value}`, 24)}`;
}

/** Returns the original value when the signature matches, otherwise null. */
export function unsign(token: string): string | null {
  const index = token.lastIndexOf(".");
  if (index <= 0) return null;
  const value = token.slice(0, index);
  return safeEqual(token, sign(value)) ? value : null;
}

export const BROWSER_COOKIE = "cauce_bid";
export const BROWSER_HEADER = "x-cauce-bid";

export function createBrowserToken(): string {
  return sign(randomUUID());
}
