import { describe, expect, test } from "bun:test";
import { isTransientCategory } from "@/config/categories";
import { DEMO_PHOTOS, type DemoCity } from "@/config/demo-photos";
import {
  SIGNAL_WINDOW_MS,
  shouldResolve,
  TRANSIENT_TTL_MS,
} from "@/features/reports/rules";
import { photosFor } from "./photos";
import { createScenarioGenerator, SCENARIOS, type Scenario } from "./scenario";
import { SCENARIO_CITIES, type ScenarioPlace } from "./scenario-cities";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-10-23T17:00:00Z");
const places = Object.fromEntries(
  Object.values(SCENARIO_CITIES).map((city) => [
    city.id,
    ["street", "water"].map((kind) => ({
      area: city.areas[0]?.name ?? "Centro",
      kind,
      lat: (city.bbox[1] + city.bbox[3]) / 2,
      lng: (city.bbox[0] + city.bbox[2]) / 2,
      address: "Calle de prueba",
      colonia: "Centro",
      municipality: city.id === "matamoros" ? "Matamoros" : "Zacatecas",
      state: city.state,
      waterway: kind === "water" ? "el arroyo" : null,
    })),
  ]),
) as Record<DemoCity, ScenarioPlace[]>;

function generate(city: DemoCity, scenario: Scenario, now = NOW, seed = 42) {
  const gen = createScenarioGenerator(seed, now, places);
  return gen
    .scenario(scenario, SCENARIO_CITIES[city], 1)
    .map((draft) => gen.build(draft, photosFor(city)));
}

describe("scenario lifecycle", () => {
  for (const city of ["matamoros", "zacatecas"] as const) {
    for (const scenario of Object.keys(SCENARIOS) as Scenario[]) {
      test(`${city}/${scenario}: timestamps, counters, expiry and resolution agree`, () => {
        const built = generate(city, scenario);
        expect(built.length).toBeGreaterThan(20);
        for (const { row, signals, events } of built) {
          const created = row.createdAt?.getTime() ?? NaN;
          expect(created).toBeLessThanOrEqual(NOW);
          expect(created).toBeGreaterThanOrEqual(NOW - 61 * DAY);
          expect(row.updatedAt?.getTime()).toBeGreaterThanOrEqual(created);
          expect(row.updatedAt?.getTime()).toBeLessThanOrEqual(NOW);
          expect(row.source).toBe("seed");
          expect(row.clientRequestId).toStartWith(`scenario:${city}:`);
          expect(row.stillThereCount).toBe(
            signals.filter((s) => s.kind === "still_there").length,
          );
          expect(row.fixedCount).toBe(
            signals.filter((s) => s.kind === "fixed").length,
          );
          for (const signal of signals) {
            expect(signal.createdAt?.getTime()).toBeGreaterThanOrEqual(created);
            expect(signal.createdAt?.getTime()).toBeLessThanOrEqual(
              row.updatedAt?.getTime() ?? 0,
            );
          }
          const confirmations = signals
            .filter((s) => s.kind === "still_there")
            .map((s) => s.createdAt?.getTime() ?? NaN)
            .sort((a, b) => a - b);
          expect(row.lastConfirmedAt?.getTime() ?? null).toBe(
            confirmations.at(-1) ?? null,
          );
          if (isTransientCategory(row.category)) {
            expect(row.expiresAt?.getTime()).toBe(
              (confirmations.at(-1) ?? created) + TRANSIENT_TTL_MS,
            );
            expect(row.status).toBe(
              (row.expiresAt?.getTime() ?? 0) <= NOW ? "expired" : "open",
            );
            let previous = created;
            for (const at of confirmations) {
              expect(at - previous).toBeLessThan(TRANSIENT_TTL_MS);
              previous = at;
            }
          } else {
            expect(row.expiresAt).toBeNull();
          }
          expect(events[0]?.toStatus).toBe("open");
          if (row.status === "resolved") {
            const resolved = row.resolvedAt?.getTime() ?? NaN;
            const recent = signals.filter(
              (s) =>
                (s.updatedAt?.getTime() ?? 0) >= resolved - SIGNAL_WINDOW_MS,
            );
            expect(
              shouldResolve({
                fixed: recent.filter((s) => s.kind === "fixed").length,
                stillThere: recent.filter((s) => s.kind === "still_there")
                  .length,
              }),
            ).toBe(true);
            expect(
              Math.max(
                ...signals
                  .filter((s) => s.kind === "fixed")
                  .map((s) => s.createdAt?.getTime() ?? 0),
              ),
            ).toBe(resolved);
            expect(events.at(-1)?.createdAt?.getTime()).toBe(resolved);
          }
        }
      });
    }
  }

  test("aftermath leaves most water expired and a few continuously confirmed low spots open", () => {
    const water = generate("matamoros", "aftermath").filter((b) =>
      isTransientCategory(b.row.category),
    );
    const open = water.filter((b) => b.row.status === "open");
    expect(open.length).toBeGreaterThan(0);
    expect(open.length).toBeLessThan(water.length / 2);
  });

  test("historical storms expire while recent storms remain visible", () => {
    expect(
      generate("zacatecas", "season")
        .filter(
          (b) =>
            isTransientCategory(b.row.category) &&
            (b.row.createdAt?.getTime() ?? 0) < NOW - 3 * DAY,
        )
        .every((b) => b.row.status === "expired"),
    ).toBe(true);
    expect(
      generate("matamoros", "storm")
        .filter(
          (b) =>
            isTransientCategory(b.row.category) &&
            (b.row.createdAt?.getTime() ?? 0) > NOW - 3 * HOUR,
        )
        .every((b) => b.row.status === "open"),
    ).toBe(true);
  });

  test("water depth and damage match the selected photo", () => {
    for (const city of ["matamoros", "zacatecas"] as const) {
      for (const { row } of generate(city, "storm")) {
        const photo = DEMO_PHOTOS.find((p) => p.key === row.photoFullKey);
        expect(photo?.cities).toContain(city);
        expect(photo?.category).toBe(row.category);
        if (row.waterDepthCm !== null)
          expect(row.waterDepthCm).toBe(photo?.waterDepthCm);
        if (row.severityDetail !== null)
          expect(row.severityDetail).toBe(photo?.severityDetail);
      }
    }
  });

  test("live reports use the current instant even at night and have no invented votes", () => {
    const start = Date.parse("2026-10-23T05:00:00Z");
    for (const city of ["matamoros", "zacatecas"] as const) {
      for (const scenario of Object.keys(SCENARIOS) as Scenario[]) {
        const gen = createScenarioGenerator(42, start, places);
        for (let tick = 1; tick <= 20; tick++) {
          const elapsed = tick * 20_000;
          const { row, signals } = gen.build(
            gen.liveDraft(scenario, SCENARIO_CITIES[city], elapsed),
            photosFor(city),
          );
          expect(row.createdAt?.getTime()).toBe(start + elapsed);
          expect(row.updatedAt?.getTime()).toBe(start + elapsed);
          expect(row.status).toBe("open");
          expect(signals).toHaveLength(0);
        }
      }
    }
  });
});
