/**
 * Photos for seeded reports, per category: the Wikimedia Commons set in src/config/demo-photos.json
 * that fits the city, or the category illustrations when a category has none.
 */
import {
  CATEGORY_COLORS,
  REPORT_CATEGORIES,
  type ReportCategory,
  type SeverityDetail,
} from "@/config/categories";
import {
  DEMO_PHOTOS,
  type DemoCity,
  type DemoPhoto,
} from "@/config/demo-photos";
import { ILLUSTRATION_VARIANTS, illustrationKey } from "./illustrations";

export type SeedPhoto = Pick<
  DemoPhoto,
  | "key"
  | "thumbKey"
  | "width"
  | "height"
  | "color"
  | "waterDepthCm"
  | "severityDetail"
>;

export type PhotoSet = Record<ReportCategory, SeedPhoto[]>;

export function photosFor(city: DemoCity): PhotoSet {
  const set = {} as PhotoSet;
  for (const category of REPORT_CATEGORIES) {
    const real = DEMO_PHOTOS.filter(
      (p) => p.category === category && p.cities.includes(city),
    );
    set[category] = real.length
      ? real
      : Array.from({ length: ILLUSTRATION_VARIANTS }, (_, v) => ({
          key: illustrationKey(category, v),
          thumbKey: illustrationKey(category, v),
          width: 1600,
          height: 1200,
          color: CATEGORY_COLORS[category],
        }));
  }
  return set;
}

/** A photo that shows what the report says: the closest water depth, or the same damage. */
export function matchingPhoto(
  pool: SeedPhoto[],
  report: {
    waterDepthCm: number | null;
    severityDetail: SeverityDetail | null;
  },
  pick: <T>(items: readonly T[]) => T,
): SeedPhoto {
  const { waterDepthCm, severityDetail } = report;
  if (waterDepthCm != null) {
    const gap = (p: SeedPhoto) =>
      Math.abs((p.waterDepthCm ?? waterDepthCm) - waterDepthCm);
    const best = Math.min(...pool.map(gap));
    return pick(pool.filter((p) => gap(p) === best));
  }
  const same = pool.filter((p) => p.severityDetail === severityDetail);
  return pick(same.length ? same : pool);
}
