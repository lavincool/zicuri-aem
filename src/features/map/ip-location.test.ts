import { expect, test } from "bun:test";
import { approxLocation } from "./ip-location";

const headers = (values: Record<string, string>) => new Headers(values);

test("returns the city center for Mexican visitors", () => {
  expect(
    approxLocation(
      headers({
        "x-vercel-ip-country": "MX",
        "x-vercel-ip-latitude": "20.6597",
        "x-vercel-ip-longitude": "-103.3496",
      }),
    ),
  ).toEqual([-103.3496, 20.6597]);
});

test("ignores other countries and missing or broken headers", () => {
  expect(
    approxLocation(
      headers({
        "x-vercel-ip-country": "US",
        "x-vercel-ip-latitude": "29.76",
        "x-vercel-ip-longitude": "-95.37",
      }),
    ),
  ).toBeNull();
  expect(approxLocation(headers({ "x-vercel-ip-country": "MX" }))).toBeNull();
  expect(
    approxLocation(
      headers({
        "x-vercel-ip-country": "MX",
        "x-vercel-ip-latitude": "abc",
        "x-vercel-ip-longitude": "-99.1",
      }),
    ),
  ).toBeNull();
});
