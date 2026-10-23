import { expect, test } from "bun:test";
import { MIN_CONFIDENCE, type Triage, toSuggestion } from "./schema";

const base: Triage = {
  category: "blocked_drain",
  is_relevant: true,
  description_es: "Alcantarilla tapada con basura y hojas",
  confidence: 0.86,
  privacy_concerns: [],
};

test("a confident, relevant answer becomes a suggestion", () => {
  const s = toSuggestion("ais_1", base);
  expect(s.category).toBe("blocked_drain");
  expect(s.description).toBe("Alcantarilla tapada con basura y hojas");
});

test("low confidence or unclear photos suggest no category", () => {
  expect(
    toSuggestion("ais_2", { ...base, confidence: 0.3 }).category,
  ).toBeNull();
  expect(
    toSuggestion("ais_2", { ...base, confidence: 0.3 }).description,
  ).toBeNull();
  expect(
    toSuggestion("ais_3", { ...base, category: "unclear" }).category,
  ).toBeNull();
  expect(
    toSuggestion("ais_3", { ...base, category: "unclear" }).description,
  ).toBeNull();
});

test("confidence at the threshold is usable and descriptions are trimmed and bounded", () => {
  const s = toSuggestion("ais_5", {
    ...base,
    confidence: MIN_CONFIDENCE,
    description_es: `  ${"a".repeat(150)}  `,
  });
  expect(s.category).toBe("blocked_drain");
  expect(s.description).toBe("a".repeat(140));
});

test("irrelevant photos get neither category nor description", () => {
  const s = toSuggestion("ais_4", { ...base, is_relevant: false });
  expect(s.category).toBeNull();
  expect(s.description).toBeNull();
});
