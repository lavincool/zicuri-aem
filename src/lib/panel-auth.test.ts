import { beforeAll, expect, test } from "bun:test";
import { createPanelToken, PANEL_SESSION_MS, panelRole } from "./panel-auth";

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-16";
});

test("tokens carry their role until they expire", () => {
  const now = 1_800_000_000_000;
  expect(panelRole(createPanelToken("admin", now), now)).toBe("admin");
  expect(panelRole(createPanelToken("viewer", now), now)).toBe("viewer");
  expect(
    panelRole(createPanelToken("viewer", now), now + PANEL_SESSION_MS + 1),
  ).toBeNull();
});

test("rejects tampered and malformed tokens", () => {
  const token = createPanelToken("viewer");
  expect(panelRole(token.replace("panel-viewer", "panel"))).toBeNull();
  expect(panelRole("panel:9999999999999")).toBeNull();
  expect(panelRole(undefined)).toBeNull();
});
