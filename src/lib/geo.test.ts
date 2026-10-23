import { expect, test } from "bun:test";
import { insidePolygons, polygonsBbox, snapBbox } from "./geo";

const square = (x: number, y: number, size: number) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

test("point in polygon respects holes and several polygons", () => {
  const polygons = [[square(0, 0, 10), square(4, 4, 2)], [square(20, 0, 2)]];
  expect(insidePolygons(1, 1, polygons)).toBe(true);
  expect(insidePolygons(5, 5, polygons)).toBe(false);
  expect(insidePolygons(21, 1, polygons)).toBe(true);
  expect(insidePolygons(15, 1, polygons)).toBe(false);
});

test("bbox spans every polygon", () => {
  expect(polygonsBbox([[square(0, 0, 10)], [square(20, -5, 2)]])).toEqual([
    0, -5, 22, 10,
  ]);
});

test("snapped bboxes stay within valid coordinates at low zoom", () => {
  expect(snapBbox([-130, 5, -70, 40], 2.98)).toEqual([-180, 0, 0, 90]);
  const [west, south, east, north] = snapBbox([-97.6, 25.8, -97.5, 25.9], 13);
  expect(west).toBeLessThanOrEqual(-97.6);
  expect(south).toBeLessThanOrEqual(25.8);
  expect(east).toBeGreaterThanOrEqual(-97.5);
  expect(north).toBeGreaterThanOrEqual(25.9);
});
