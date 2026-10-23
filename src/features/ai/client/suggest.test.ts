import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import type { Suggestion } from "../schema";
import { fetchSuggestion } from "./suggest";

const originalFetch = globalThis.fetch;
const response: Suggestion = {
  suggestionId: "ais_test",
  category: "blocked_drain",
  confidence: 0.9,
  description: "Alcantarilla tapada con hojas",
  isRelevant: true,
};
const apiFetch = mock<
  (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
>(async () => Response.json(response));

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(async () => Response.json(response));
  globalThis.fetch = Object.assign(apiFetch, {
    preconnect: originalFetch.preconnect,
  });
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

test("requests a suggestion only for the uploaded photo", async () => {
  expect(
    await fetchSuggestion("upl_test", new AbortController().signal),
  ).toEqual(response);
  const [url, init] = apiFetch.mock.calls[0] ?? [];
  expect(url).toBe("/api/ai/suggest");
  expect(JSON.parse(String(init?.body))).toEqual({ uploadId: "upl_test" });
});

test.each([204, 401, 404, 429, 503])(
  "HTTP %s leaves the report flow without a suggestion",
  async (status) => {
    apiFetch.mockImplementation(async () => new Response(null, { status }));
    expect(
      await fetchSuggestion("upl_test", new AbortController().signal),
    ).toBeNull();
  },
);

test("invalid JSON or an unknown category is ignored", async () => {
  apiFetch.mockImplementation(async () => new Response("not json"));
  expect(
    await fetchSuggestion("upl_test", new AbortController().signal),
  ).toBeNull();
  apiFetch.mockImplementation(async () =>
    Response.json({ ...response, category: "invented" }),
  );
  expect(
    await fetchSuggestion("upl_test", new AbortController().signal),
  ).toBeNull();
});

test("a cancelled photo request and network failures are optional", async () => {
  const controller = new AbortController();
  controller.abort();
  apiFetch.mockImplementation(async (_input, init) => {
    init?.signal?.throwIfAborted();
    throw new TypeError("Offline");
  });
  expect(await fetchSuggestion("upl_test", controller.signal)).toBeNull();
  expect(apiFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(
    await fetchSuggestion("upl_test", new AbortController().signal),
  ).toBeNull();
});
