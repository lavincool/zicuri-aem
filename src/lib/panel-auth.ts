import { sign, unsign } from "./signing";

/**
 * Session for the authorities panel (signed, expiring cookie). The shared password
 * grants an admin session; with DEMO_MODE anyone can open a read-only viewer session.
 */
export const PANEL_COOKIE = "cauce_panel";
export const PANEL_SESSION_MS = 30 * 24 * 3_600_000;

export type PanelRole = "admin" | "viewer";

const PREFIX: Record<PanelRole, string> = {
  admin: "panel",
  viewer: "panel-viewer",
};

export function createPanelToken(
  role: PanelRole = "admin",
  now = Date.now(),
): string {
  return sign(`${PREFIX[role]}:${now + PANEL_SESSION_MS}`);
}

export function panelRole(
  token: string | null | undefined,
  now = Date.now(),
): PanelRole | null {
  const value = token ? unsign(token) : null;
  const [prefix, expires] = value?.split(":") ?? [];
  if (!(Number(expires) > now)) return null;
  if (prefix === PREFIX.admin) return "admin";
  if (prefix === PREFIX.viewer) return "viewer";
  return null;
}

export function isValidPanelToken(
  token: string | null | undefined,
  now = Date.now(),
): boolean {
  return panelRole(token, now) !== null;
}
