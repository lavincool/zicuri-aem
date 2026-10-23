import { describe, expect, test } from "bun:test";
import {
  applySignalToCounts,
  effectiveStatus,
  expiryFrom,
  shouldHide,
  shouldResolve,
  TRANSIENT_TTL_MS,
} from "./rules";

const now = new Date("2026-10-22T18:00:00Z");

describe("shouldResolve", () => {
  test("needs at least two fixed signals", () => {
    expect(shouldResolve({ fixed: 1, stillThere: 0 })).toBe(false);
    expect(shouldResolve({ fixed: 2, stillThere: 0 })).toBe(true);
  });

  test("fixed must outnumber still-there", () => {
    expect(shouldResolve({ fixed: 2, stillThere: 2 })).toBe(false);
    expect(shouldResolve({ fixed: 3, stillThere: 2 })).toBe(true);
  });
});

describe("effectiveStatus", () => {
  test("open reports past expiry read as expired", () => {
    const expiresAt = new Date(now.getTime() - 1);
    expect(effectiveStatus({ status: "open", expiresAt }, now)).toBe("expired");
  });

  test("reports without expiry keep their status", () => {
    expect(effectiveStatus({ status: "open", expiresAt: null }, now)).toBe(
      "open",
    );
    expect(effectiveStatus({ status: "resolved", expiresAt: null }, now)).toBe(
      "resolved",
    );
  });
});

describe("expiryFrom", () => {
  test("water categories expire 24 h after confirmation", () => {
    expect(expiryFrom("flooded_street", now)?.getTime()).toBe(
      now.getTime() + TRANSIENT_TTL_MS,
    );
  });

  test("infrastructure categories never expire", () => {
    expect(expiryFrom("blocked_drain", now)).toBeNull();
  });
});

describe("applySignalToCounts", () => {
  test("adds a first signal", () => {
    expect(
      applySignalToCounts({ stillThere: 1, fixed: 0 }, null, "fixed"),
    ).toEqual({ stillThere: 1, fixed: 1 });
  });

  test("moves a changed signal between counters", () => {
    expect(
      applySignalToCounts({ stillThere: 1, fixed: 0 }, "still_there", "fixed"),
    ).toEqual({ stillThere: 0, fixed: 1 });
  });

  test("repeating the same signal changes nothing", () => {
    const counts = { stillThere: 2, fixed: 1 };
    expect(applySignalToCounts(counts, "fixed", "fixed")).toBe(counts);
  });
});

test("three flags hide a report", () => {
  expect(shouldHide(2)).toBe(false);
  expect(shouldHide(3)).toBe(true);
});
