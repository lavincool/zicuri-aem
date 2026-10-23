import { describe, expect, test } from "bun:test";
import { createReportSchema, reportsQuerySchema } from "./schema";

const base = {
  clientRequestId: "0c5e1f0e-1c1a-4d7e-9a43-5d0b0d3b9a51",
  uploadId: "upl_abc",
  location: { lat: 25.82, lng: -97.56, source: "gps" as const },
  photo: { width: 1600, height: 1200 },
};

describe("createReportSchema", () => {
  test("accepts a minimal report", () => {
    expect(
      createReportSchema.safeParse({ ...base, category: "blocked_drain" })
        .success,
    ).toBe(true);
  });

  test("accepts water depth only for water categories", () => {
    expect(
      createReportSchema.safeParse({
        ...base,
        category: "flooded_street",
        waterDepthCm: 45,
      }).success,
    ).toBe(true);
    expect(
      createReportSchema.safeParse({
        ...base,
        category: "blocked_drain",
        waterDepthCm: 45,
      }).success,
    ).toBe(false);
  });

  test("rejects a severity that does not belong to the category", () => {
    expect(
      createReportSchema.safeParse({
        ...base,
        category: "blocked_drain",
        severityDetail: "missing",
      }).success,
    ).toBe(false);
  });

  test("rejects unsupported depths and long notes", () => {
    expect(
      createReportSchema.safeParse({
        ...base,
        category: "flooded_street",
        waterDepthCm: 30,
      }).success,
    ).toBe(false);
    expect(
      createReportSchema.safeParse({
        ...base,
        category: "other",
        note: "x".repeat(281),
      }).success,
    ).toBe(false);
  });
});

describe("reportsQuerySchema", () => {
  test("parses bbox and categories", () => {
    const parsed = reportsQuerySchema.parse({
      bbox: "-97.6,25.8,-97.5,25.9",
      categories: "blocked_drain,flooded_street",
    });
    expect(parsed.bbox).toEqual([-97.6, 25.8, -97.5, 25.9]);
    expect(parsed.categories).toEqual(["blocked_drain", "flooded_street"]);
    expect(parsed.status).toBe("open");
  });

  test("rejects an inverted bbox", () => {
    expect(
      reportsQuerySchema.safeParse({ bbox: "-97.5,25.9,-97.6,25.8" }).success,
    ).toBe(false);
  });
});
