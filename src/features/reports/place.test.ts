import { expect, test } from "bun:test";
import { placeLabel } from "./place";

test("prefers colonia and municipality", () => {
  expect(
    placeLabel({
      colonia: "Buenavista",
      municipality: "Matamoros",
      state: "Tamaulipas",
    }),
  ).toBe("Buenavista, Matamoros");
});

test("falls back to municipality and state", () => {
  expect(
    placeLabel({
      colonia: null,
      municipality: "Tlalpan",
      state: "Ciudad de México",
    }),
  ).toBe("Tlalpan, Ciudad de México");
  expect(
    placeLabel({ colonia: null, municipality: "Puebla", state: "Puebla" }),
  ).toBe("Puebla");
});

test("returns null when nothing is known", () => {
  expect(
    placeLabel({ colonia: null, municipality: null, state: null }),
  ).toBeNull();
});
