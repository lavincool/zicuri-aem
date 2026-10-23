import { createHash, randomBytes } from "node:crypto";

/**
 * Session IDs and magic-link tokens are 256-bit random values, so a plain SHA-256
 * is enough to store them (same reasoning as device keys).
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
