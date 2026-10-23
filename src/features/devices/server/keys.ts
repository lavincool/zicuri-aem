import { createHash, randomBytes } from "node:crypto";

/**
 * Device keys are high-entropy random tokens, so a plain SHA-256 is enough
 * (no slow hash needed) and lets us look devices up by hash through a unique index.
 */
export function hashDeviceKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateDeviceKey(): {
  key: string;
  hash: string;
  prefix: string;
} {
  const key = `cdk_${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashDeviceKey(key), prefix: key.slice(0, 8) };
}
