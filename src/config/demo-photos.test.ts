import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { REPORT_CATEGORIES } from "./categories";
import { DEMO_PHOTOS, demoPhotoCredit } from "./demo-photos";

describe("demo photo catalog", () => {
  test("all photos and thumbnails exist and include attribution", () => {
    const keys = new Set<string>();
    for (const photo of DEMO_PHOTOS) {
      expect(keys.has(photo.key)).toBe(false);
      keys.add(photo.key);
      for (const key of [photo.key, photo.thumbKey]) {
        expect(key).toStartWith(`seed/photos/${photo.category}/`);
        expect(existsSync(path.join(process.cwd(), "public", key))).toBe(true);
      }
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);
      expect(photo.author.length).toBeGreaterThan(0);
      expect(new URL(photo.source).hostname).toBe("commons.wikimedia.org");
      if (photo.license.startsWith("CC")) {
        expect(new URL(photo.licenseUrl ?? "").hostname).toBe(
          "creativecommons.org",
        );
      }
      expect(demoPhotoCredit(photo.key)?.author).toBe(photo.author);
    }
    expect(demoPhotoCredit("uploads/user-photo.webp")).toBeNull();
  });

  test("both cities have varied real photos for every report category", () => {
    for (const city of ["matamoros", "zacatecas"] as const) {
      for (const category of REPORT_CATEGORIES) {
        expect(
          DEMO_PHOTOS.filter(
            (p) => p.category === category && p.cities.includes(city),
          ).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
