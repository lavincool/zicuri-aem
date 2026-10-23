import { sign, unsign } from "./signing";

/** Shared-password session for the authorities panel (signed, expiring cookie). */
export const PANEL_COOKIE = "cauce_panel";
export const PANEL_SESSION_MS = 30 * 24 * 3_600_000;

export function createPanelToken(now = Date.now()): string {
  return sign(`panel:${now + PANEL_SESSION_MS}`);
}

export function isValidPanelToken(
  token: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const value = unsign(token);
  if (!value?.startsWith("panel:")) return false;
  return Number(value.slice("panel:".length)) > now;
}
