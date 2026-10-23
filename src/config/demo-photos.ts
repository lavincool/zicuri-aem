/**
 * Photos for seeded demo reports: openly licensed pictures from Wikimedia Commons, resized
 * into public/seed/photos/<category>/ (WebP) and thumbs/ (JPEG). They illustrate the
 * problem, not the exact place, and each one is credited on the report sheet.
 */
import type { ReportCategory, SeverityDetail } from "./categories";
import photos from "./demo-photos.json";

/** Cities with demo data; a photo lists the cities it looks plausible in. */
export type DemoCity = "matamoros" | "zacatecas";

export type DemoPhoto = {
  key: string;
  thumbKey: string;
  category: ReportCategory;
  cities: DemoCity[];
  width: number;
  height: number;
  color: string;
  /** What the photo shows, so seeded severity matches the picture. */
  waterDepthCm?: number;
  severityDetail?: SeverityDetail;
  author: string;
  license: string;
  licenseUrl: string | null;
  /** Wikimedia Commons file page. */
  source: string;
};

export type PhotoCredit = Pick<
  DemoPhoto,
  "author" | "license" | "licenseUrl" | "source"
>;

export const DEMO_PHOTOS = photos as DemoPhoto[];

const BY_KEY = new Map(DEMO_PHOTOS.map((photo) => [photo.key, photo]));

export function demoPhotoCredit(key: string): PhotoCredit | null {
  const photo = BY_KEY.get(key);
  return photo
    ? {
        author: photo.author,
        license: photo.license,
        licenseUrl: photo.licenseUrl,
        source: photo.source,
      }
    : null;
}
