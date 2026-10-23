import { describe, expect, test } from "bun:test";
import { isTransientCategory, normalizeSeverity } from "./categories";
import { isInsidePilot } from "./pilot";

describe("normalizeSeverity", () => {
  test("maps water depth to 1–3", () => {
    expect(normalizeSeverity({ waterDepthCm: 5 })).toBe(1);
    expect(normalizeSeverity({ waterDepthCm: 15 })).toBe(2);
    expect(normalizeSeverity({ waterDepthCm: 80 })).toBe(3);
  });

  test("maps drain and cover details", () => {
    expect(normalizeSeverity({ severityDetail: "partial" })).toBe(1);
    expect(normalizeSeverity({ severityDetail: "damaged" })).toBe(2);
    expect(normalizeSeverity({ severityDetail: "missing" })).toBe(3);
  });

  test("returns null when no severity was given", () => {
    expect(normalizeSeverity({})).toBeNull();
  });
});

test("only water categories are transient", () => {
  expect(isTransientCategory("flooded_street")).toBe(true);
  expect(isTransientCategory("blocked_drain")).toBe(false);
});

test("pilot bounds contain Buenavista and exclude Monterrey", () => {
  expect(isInsidePilot(-97.562, 25.8226)).toBe(true);
  expect(isInsidePilot(-100.31, 25.67)).toBe(false);
});
