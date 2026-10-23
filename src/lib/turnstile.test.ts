import { expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { acceptSiteverify } = await import("./turnstile");

const hostnames = new Set(["cauce.mx"]);

test("accepts a successful answer for the action and hostname", () => {
  expect(
    acceptSiteverify(
      { success: true, action: "report", hostname: "cauce.mx" },
      "report",
      hostnames,
    ),
  ).toBe(true);
});

test("rejects failures, other actions, other hostnames and junk", () => {
  const cases: unknown[] = [
    { success: false, action: "report", hostname: "cauce.mx" },
    { success: true, action: "login", hostname: "cauce.mx" },
    { success: true, action: "report", hostname: "evil.example" },
    { success: true, action: "report" },
    null,
    "ok",
  ];
  for (const body of cases) {
    expect(acceptSiteverify(body, "report", hostnames)).toBe(false);
  }
});
