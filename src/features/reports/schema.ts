import { z } from "zod";
import {
  CATEGORY_SEVERITY,
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportStatus,
  SEVERITY_DETAILS,
  WATER_DEPTHS_CM,
} from "@/config/categories";
import {
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  PHOTO_CONTENT_TYPES,
} from "@/config/uploads";

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
  /** 1 while the report waits in the offline outbox (local only) */
  p?: 1;
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

export type ReportDetail = {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  severity: number | null;
  severityDetail: "partial" | "full" | "damaged" | "missing" | null;
  waterDepthCm: number | null;
  note: string | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  address: string | null;
  colonia: string | null;
  photo: {
    fullUrl: string;
    thumbUrl: string;
    width: number;
    height: number;
    color: string | null;
  };
  stillThereCount: number;
  fixedCount: number;
  createdAt: string;
  lastConfirmedAt: string | null;
  resolvedAt: string | null;
  expiresAt: string | null;
  isDemo: boolean;
  mySignal: "still_there" | "fixed" | null;
  myFlagged: boolean;
};

export const signalBodySchema = z.object({
  kind: z.enum(["still_there", "fixed"]),
});

export const FLAG_REASONS = [
  "inappropriate",
  "not_a_problem",
  "duplicate",
  "other",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const flagBodySchema = z.object({ reason: z.enum(FLAG_REASONS) });

export const uploadRequestSchema = z.object({
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  bytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
  thumbBytes: z.number().int().positive().max(MAX_THUMB_BYTES),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export type UploadTicket = {
  uploadId: string;
  full: { key: string; url: string; headers: Record<string, string> };
  thumb: { key: string; url: string; headers: Record<string, string> };
  expiresAt: string;
};

export const LOCATION_SOURCES = ["gps", "exif", "manual"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const createReportSchema = z
  .object({
    clientRequestId: z.uuid(),
    uploadId: z.string().min(1).max(64),
    category: z.enum(REPORT_CATEGORIES),
    severityDetail: z.enum(SEVERITY_DETAILS).nullish(),
    waterDepthCm: z
      .number()
      .refine((v) => (WATER_DEPTHS_CM as readonly number[]).includes(v), {
        message: "Unsupported water depth",
      })
      .nullish(),
    note: z.string().trim().max(280).nullish(),
    location: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracyM: z.number().nonnegative().max(100_000).nullish(),
      source: z.enum(LOCATION_SOURCES),
    }),
    photo: z.object({
      width: z.number().int().positive().max(10_000),
      height: z.number().int().positive().max(10_000),
      color: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .nullish(),
    }),
    aiSuggestionId: z.string().max(64).nullish(),
  })
  .superRefine((value, ctx) => {
    const input = CATEGORY_SEVERITY[value.category];
    if (value.waterDepthCm != null && input.kind !== "depth") {
      ctx.addIssue({
        code: "custom",
        path: ["waterDepthCm"],
        message: "Water depth only applies to water categories",
      });
    }
    if (
      value.severityDetail != null &&
      (input.kind !== "detail" ||
        !(input.options as readonly string[]).includes(value.severityDetail))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["severityDetail"],
        message: "Severity does not match the category",
      });
    }
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

export type CreatedReport = {
  report: {
    id: string;
    category: ReportCategory;
    status: ReportStatus;
    lat: number;
    lng: number;
    createdAt: string;
    photoThumbUrl: string;
  };
  nearbyCount: number;
  shareUrl: string;
};
