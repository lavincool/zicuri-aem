import "server-only";
import { cookies } from "next/headers";
import { PANEL_COOKIE, type PanelRole, panelRole } from "@/lib/panel-auth";

/** The current panel session's role; the proxy already rejected missing sessions. */
export async function currentPanelRole(): Promise<PanelRole | null> {
  return panelRole((await cookies()).get(PANEL_COOKIE)?.value);
}
