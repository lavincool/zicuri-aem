import { expect, test } from "bun:test";
import { fitMexico, isInsideServiceArea } from "./service-area";

test("accepts cities, coasts and islands across Mexico", () => {
  const places: [string, number, number][] = [
    ["Buenavista, Matamoros", -97.562, 25.8226],
    ["Matamoros by the Río Bravo", -97.505, 25.883],
    ["Monterrey", -100.31, 25.67],
    ["Ciudad de México", -99.133, 19.432],
    ["Tijuana", -117.02, 32.52],
    ["Mérida", -89.62, 20.97],
    ["Tapachula", -92.26, 14.9],
    ["Cancún hotel zone", -86.77, 21.11],
    ["Isla Mujeres", -86.73, 21.23],
    ["La Paz", -110.31, 24.14],
    ["Isla Socorro", -110.95, 18.78],
  ];
  for (const [name, lng, lat] of places) {
    expect([name, isInsideServiceArea(lng, lat)]).toEqual([name, true]);
  }
});

test("rejects places outside Mexico", () => {
  const places: [string, number, number][] = [
    ["Houston", -95.37, 29.76],
    ["San Diego", -117.16, 32.72],
    ["Las Cruces", -106.78, 32.32],
    ["Guatemala City", -90.51, 14.63],
    ["Belize City", -88.2, 17.5],
    ["Havana", -82.37, 23.11],
    ["Gulf of Mexico", -92.0, 24.0],
    ["Pacific Ocean", -105.0, 15.0],
  ];
  for (const [name, lng, lat] of places) {
    expect([name, isInsideServiceArea(lng, lat)]).toEqual([name, false]);
  }
});

test("fits Mexico in a phone and zooms closer on a desktop", () => {
  const phone = fitMexico(375, 812);
  const desktop = fitMexico(1440, 900);
  expect(phone.center[0]).toBeCloseTo(-101.9, 1);
  expect(phone.zoom).toBeGreaterThanOrEqual(2.5);
  expect(phone.zoom).toBeLessThan(3.2);
  expect(desktop.zoom).toBeGreaterThan(4);
  expect(desktop.zoom).toBeLessThanOrEqual(5.5);
});
