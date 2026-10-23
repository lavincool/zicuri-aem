import { describe, expect, test } from "bun:test";
import { can, durationParts, loginTokenState, normalizeEmail } from "./rules";

describe("can", () => {
  test("owners and admins manage devices", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(can(role, "view_fleet")).toBe(true);
      expect(can(role, "edit_device")).toBe(true);
      expect(can(role, "rotate_key")).toBe(true);
    }
  });

  test("viewers only read", () => {
    expect(can("viewer", "view_fleet")).toBe(true);
    expect(can("viewer", "edit_device")).toBe(false);
    expect(can("viewer", "rotate_key")).toBe(false);
  });
});

test("normalizeEmail trims and lowercases", () => {
  expect(normalizeEmail("  Ana.Lopez@JAD.gob.MX ")).toBe(
    "ana.lopez@jad.gob.mx",
  );
});

describe("loginTokenState", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const later = new Date(now.getTime() + 60_000);

  test("unknown, used and expired tokens are rejected", () => {
    expect(loginTokenState(null, now)).toBe("unknown");
    expect(loginTokenState({ expiresAt: later, usedAt: now }, now)).toBe(
      "used",
    );
    expect(loginTokenState({ expiresAt: now, usedAt: null }, now)).toBe(
      "expired",
    );
  });

  test("an unused token before its expiry is valid", () => {
    expect(loginTokenState({ expiresAt: later, usedAt: null }, now)).toBe(
      "valid",
    );
  });
});

test("durationParts picks a readable unit", () => {
  expect(durationParts(20_000)).toEqual({ unit: "minutes", minutes: 1 });
  expect(durationParts(45 * 60_000)).toEqual({ unit: "minutes", minutes: 45 });
  expect(durationParts(135 * 60_000)).toEqual({
    unit: "hours",
    hours: 2,
    minutes: 15,
  });
  expect(durationParts((3 * 24 + 4) * 3_600_000)).toEqual({
    unit: "days",
    days: 3,
    hours: 4,
  });
});
