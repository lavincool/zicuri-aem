import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  SEVERITY_DETAILS,
} from "@/config/categories";
import { createdAt, timestamp, updatedAt } from "./_shared";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind", {
    enum: [
      "operator",
      "municipality",
      "utility",
      "civil_protection",
      "school",
      "other",
    ],
  }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Presigned upload intents: a report can only reference keys we issued. */
export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  fullKey: text("full_key").notNull().unique(),
  thumbKey: text("thumb_key").notNull().unique(),
  contentType: text("content_type", {
    enum: ["image/webp", "image/jpeg"],
  }).notNull(),
  declaredBytes: integer("declared_bytes").notNull(),
  browserHash: text("browser_hash").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: createdAt(),
});

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    category: text("category", { enum: REPORT_CATEGORIES }).notNull(),
    /** Normalized 1–3; null when the reporter skipped the severity step. */
    severity: integer("severity"),
    severityDetail: text("severity_detail", { enum: SEVERITY_DETAILS }),
    waterDepthCm: integer("water_depth_cm"),
    note: text("note"),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    accuracyM: real("accuracy_m"),
    locationSource: text("location_source", {
      enum: ["gps", "exif", "manual"],
    }).notNull(),
    h3r8: text("h3_r8").notNull(),
    h3r9: text("h3_r9").notNull(),
    address: text("address"),
    colonia: text("colonia"),
    photoFullKey: text("photo_full_key").notNull(),
    photoThumbKey: text("photo_thumb_key").notNull(),
    photoWidth: integer("photo_width").notNull(),
    photoHeight: integer("photo_height").notNull(),
    photoColor: text("photo_color"),
    stillThereCount: integer("still_there_count").notNull().default(0),
    fixedCount: integer("fixed_count").notNull().default(0),
    flagCount: integer("flag_count").notNull().default(0),
    lastConfirmedAt: timestamp("last_confirmed_at"),
    statusChangedAt: timestamp("status_changed_at")
      .notNull()
      .$defaultFn(() => new Date()),
    /** Set for transient (water) categories; extended by "Still there". */
    expiresAt: timestamp("expires_at"),
    resolvedAt: timestamp("resolved_at"),
    /** HMAC of the browser ID; the raw ID is never stored. */
    reporterHash: text("reporter_hash").notNull(),
    userId: text("user_id"),
    /** Idempotency key so outbox replays never create duplicates. */
    clientRequestId: text("client_request_id").notNull().unique(),
    aiSuggestionId: text("ai_suggestion_id"),
    source: text("source", { enum: ["web", "seed", "import"] })
      .notNull()
      .default("web"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("reports_lat_lng_idx").on(t.lat, t.lng),
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_h3_r8_idx").on(t.h3r8),
    index("reports_h3_r9_idx").on(t.h3r9),
    index("reports_expires_idx").on(t.expiresAt),
  ],
);

/** One community signal per browser per report; changing your mind updates it. */
export const reportSignals = sqliteTable(
  "report_signals",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    browserHash: text("browser_hash").notNull(),
    kind: text("kind", { enum: ["still_there", "fixed"] }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("report_signals_once_idx").on(t.reportId, t.browserHash)],
);

export const reportFlags = sqliteTable(
  "report_flags",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    browserHash: text("browser_hash").notNull(),
    reason: text("reason", {
      enum: ["inappropriate", "not_a_problem", "duplicate", "other"],
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("report_flags_once_idx").on(t.reportId, t.browserHash)],
);

/** Full status history: time-to-resolution and audits. */
export const reportStatusEvents = sqliteTable(
  "report_status_events",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    fromStatus: text("from_status", { enum: REPORT_STATUSES }),
    toStatus: text("to_status", { enum: REPORT_STATUSES }).notNull(),
    reason: text("reason", {
      enum: ["created", "signals", "expired", "flags", "moderator"],
    }).notNull(),
    /** Browser hash, "system" or "panel". */
    actor: text("actor"),
    createdAt: createdAt(),
  },
  (t) => [index("report_status_events_report_idx").on(t.reportId, t.createdAt)],
);

/** Fixed-window counters; in-memory limits don't work across serverless instances. */
export const rateLimitBuckets = sqliteTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
});

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
