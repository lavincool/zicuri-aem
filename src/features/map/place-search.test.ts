import { describe, expect, test } from "bun:test";
import {
  normalizePlace,
  type PlaceIndex,
  preparePlaces,
  searchPlaces,
} from "./place-search";

const index: PlaceIndex = {
  v: 1,
  states: [
    ["Tamaulipas", -98.75, 24],
    ["Ciudad de México", -99.13, 19.28],
    ["Puebla", -97.92, 18.75],
  ],
  places: [
    ["Ciudad de México", 1, -99.1277, 19.4285, 12294193],
    ["Puebla", 2, -98.2072, 19.0478, 1692181],
    ["Heroica Matamoros", 0, -97.5042, 25.8797, 510739],
    ["Ciudad Madero", 0, -97.8364, 22.2756, 197216],
    ["Matamoros", 2, -98.0, 18.6, 30000],
  ],
};
const entries = preparePlaces(index);
const names = (query: string) =>
  searchPlaces(entries, query).map((r) => `${r.name}|${r.state ?? "-"}`);

describe("searchPlaces", () => {
  test("ignores accents and case", () => {
    expect(normalizePlace("  Querétaro, QRO ")).toBe("queretaro qro");
    expect(names("ciudad de mexico")[0]).toBe(
      "Ciudad de México|Ciudad de México",
    );
  });

  test("matches words inside official names, bigger towns first", () => {
    expect(names("matamoros")).toEqual([
      "Heroica Matamoros|Tamaulipas",
      "Matamoros|Puebla",
    ]);
  });

  test("narrows by state", () => {
    expect(names("matamoros tamps")).toEqual([]);
    expect(names("matamoros tamaulipas")).toEqual([
      "Heroica Matamoros|Tamaulipas",
    ]);
  });

  test("finds states and aliases", () => {
    expect(names("tamaulipas")[0]).toBe("Tamaulipas|-");
    expect(names("puebla")).toEqual([
      "Puebla|Puebla",
      "Puebla|-",
      "Matamoros|Puebla",
    ]);
    expect(names("cdmx")[0]).toBe("Ciudad de México|Ciudad de México");
  });

  test("returns nothing for an empty query", () => {
    expect(searchPlaces(entries, "   ")).toEqual([]);
  });
});
