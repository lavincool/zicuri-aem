import { describe, expect, test } from "bun:test";
import {
  blockageWeight,
  drainPriority,
  levelForScore,
  type RiskInputs,
  scoreCell,
} from "./model";

const quiet: RiskInputs = {
  rain48hMm: 0,
  blockageWeight: 0,
  blockageCount: 0,
  floodHistoryCount: 0,
  sensorRatio: null,
  relativeElevationM: 0,
};

describe("scoreCell", () => {
  test("a quiet cell scores zero and is baseline", () => {
    const result = scoreCell(quiet);
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
    expect(result.baseline).toBe(true);
  });

  test("heavy rain alone is capped at its weight", () => {
    const result = scoreCell({ ...quiet, rain48hMm: 200 });
    expect(result.score).toBe(35);
    expect(result.baseline).toBe(false);
    expect(result.factors[0]?.key).toBe("rain");
    expect(result.factors[0]?.value).toBe(200);
  });

  test("everything maxed reaches very high", () => {
    const result = scoreCell({
      rain48hMm: 120,
      blockageWeight: 30,
      blockageCount: 12,
      floodHistoryCount: 40,
      sensorRatio: 1.4,
      relativeElevationM: -4,
    });
    expect(result.score).toBeGreaterThanOrEqual(98);
    expect(result.level).toBe("very_high");
  });

  test("only low-lying terrain counts, never high ground", () => {
    expect(scoreCell({ ...quiet, relativeElevationM: 5 }).score).toBe(0);
    expect(scoreCell({ ...quiet, relativeElevationM: -1.5 }).score).toBe(5);
  });

  test("missing forecast and sensors are handled", () => {
    const result = scoreCell({
      ...quiet,
      rain48hMm: null,
      sensorRatio: null,
      relativeElevationM: null,
    });
    expect(result.score).toBe(0);
    expect(result.factors.find((f) => f.key === "rain")?.value).toBeNull();
  });

  test("factors are sorted by contribution", () => {
    const result = scoreCell({
      ...quiet,
      rain48hMm: 40,
      floodHistoryCount: 20,
    });
    const contributions = result.factors.map((f) => f.contribution);
    expect(contributions).toEqual([...contributions].sort((a, b) => b - a));
  });
});

test("levels follow the 25/50/75 bands", () => {
  expect(levelForScore(24)).toBe("low");
  expect(levelForScore(25)).toBe("moderate");
  expect(levelForScore(50)).toBe("high");
  expect(levelForScore(75)).toBe("very_high");
});

test("severe, confirmed blockages weigh more and rank higher", () => {
  const mild = { severity: 1, stillThereCount: 0 };
  const severe = { severity: 3, stillThereCount: 5 };
  expect(blockageWeight(severe)).toBeGreaterThan(blockageWeight(mild));
  expect(drainPriority(60, severe)).toBeGreaterThan(drainPriority(60, mild));
});
