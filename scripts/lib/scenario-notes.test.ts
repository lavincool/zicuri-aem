import { describe, expect, test } from "bun:test";
import { DEMO_PHOTOS } from "@/config/demo-photos";
import { matchingPhoto, photosFor } from "./photos";
import { createRandom } from "./random";
import { type NoteContext, scenarioNote } from "./scenario-notes";

const base: NoteContext = {
  city: "matamoros",
  category: "flooded_street",
  waterDepthCm: 45,
  severityDetail: null,
  photo: "camioneta-cruzando",
  street: null,
  colonia: null,
  waterway: null,
  local: [],
};

function notes(ctx: NoteContext, runs = 300): string[] {
  const { random } = createRandom(42);
  return Array.from({ length: runs }, () => scenarioNote(ctx, random)).filter(
    (n): n is string => n !== null,
  );
}

describe("scenarioNote", () => {
  test("skips templates whose place is unknown", () => {
    for (const note of notes(base)) expect(note).not.toMatch(/\{|\}/);
  });

  test("fills the street and capitalizes generic waterway names", () => {
    const canal = notes({
      ...base,
      category: "overflowing_canal",
      waterDepthCm: 80,
      waterway: "el dren",
      street: "Av. Del Niño",
    });
    expect(canal.some((n) => n.startsWith("El dren"))).toBe(true);
    const street = notes({ ...base, street: "Calle Sexta" });
    expect(street.some((n) => n.includes("Calle Sexta"))).toBe(true);
  });

  test("describes what an 'other' photo shows", () => {
    const hail = notes({
      ...base,
      city: "zacatecas",
      category: "other",
      waterDepthCm: null,
      photo: "granizo-en-autos",
    });
    expect(hail.length).toBeGreaterThan(0);
    for (const note of hail) expect(note.toLowerCase()).toContain("graniz");
  });

  test("leaves some reports without a note", () => {
    expect(notes(base).length).toBeLessThan(300);
  });
});

describe("matchingPhoto", () => {
  const { pick } = createRandom(7);

  test("picks the closest water depth", () => {
    const photos = photosFor("matamoros").flooded_street;
    const photo = matchingPhoto(
      photos,
      { waterDepthCm: 80, severityDetail: null },
      pick,
    );
    expect(photo.waterDepthCm).toBe(80);
  });

  test("picks the same damage", () => {
    const photos = photosFor("zacatecas").broken_cover;
    const photo = matchingPhoto(
      photos,
      { waterDepthCm: null, severityDetail: "missing" },
      pick,
    );
    expect(photo.severityDetail).toBe("missing");
  });

  test("every category has photos for both cities", () => {
    for (const city of ["matamoros", "zacatecas"] as const) {
      for (const list of Object.values(photosFor(city))) {
        expect(list.length).toBeGreaterThan(0);
        for (const p of list) {
          expect(DEMO_PHOTOS.some((d) => d.key === p.key)).toBe(true);
        }
      }
    }
  });
});
