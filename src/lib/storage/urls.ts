/**
 * Public URL for a stored photo key. Seed assets ship in public/; uploads live in
 * R2 (production) or the local dev store.
 */
export function photoUrl(key: string): string {
  if (key.startsWith("seed/")) return `/${key}`;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (process.env.STORAGE_DRIVER === "r2" && base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  return `/api/dev/uploads/${key}`;
}
