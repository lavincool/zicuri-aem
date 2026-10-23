import { z } from "zod";
import {
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportStatus,
} from "@/config/categories";

export const SINCE_OPTIONS = ["24h", "7d", "30d", "all"] as const;
export type SinceOption = (typeof SINCE_OPTIONS)[number];

export const STATUS_FILTERS = ["open", "resolved", "all"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SINCE_MS: Record<SinceOption, number | null> = {
  "24h": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
  "30d": 30 * 24 * 3_600_000,
  all: null,
};

const coordinate = (min: number, max: number) =>
  z.number().finite().min(min).max(max);

export const bboxSchema = z
  .string()
  .transform((value) => value.split(",").map(Number))
  .pipe(
    z.tuple([
      coordinate(-180, 180),
      coordinate(-90, 90),
      coordinate(-180, 180),
      coordinate(-90, 90),
    ]),
  )
  .refine(([west, south, east, north]) => west < east && south < north, {
    message:
      "bbox must be west,south,east,north with west < east and south < north",
  });

export const reportsQuerySchema = z.object({
  bbox: bboxSchema,
  categories: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(REPORT_CATEGORIES))),
  status: z.enum(STATUS_FILTERS).default("open"),
  since: z.enum(SINCE_OPTIONS).default("30d"),
});
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

/** Short property keys keep map payloads small. */
export type ReportFeatureProps = {
  id: string;
  /** category */
  c: ReportCategory;
  /** effective status (open reports past their expiry are reported as expired) */
  s: ReportStatus;
  /** created at, epoch ms */
  t: number;
  /** "still there" confirmations */
  v: number;
  /** normalized severity 1–3 */
  sev: number | null;
};

export type ReportFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [lng: number, lat: number] };
  properties: ReportFeatureProps;
};

export type ReportFeatureCollection = {
  type: "FeatureCollection";
  truncated: boolean;
  features: ReportFeature[];
};
