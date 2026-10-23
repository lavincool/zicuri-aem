import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { DEVICE_LEVELS, DEVICE_SITE_TYPES } from "@/config/devices";
import { createdAt, timestamp, updatedAt } from "./_shared";
import { organizations } from "./reports";

export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    type: text("type", { enum: ["ultrasonic_level"] }).notNull(),
    siteType: text("site_type", { enum: DEVICE_SITE_TYPES }).notNull(),
    status: text("status", {
      enum: ["pending", "active", "maintenance", "retired"],
    })
      .notNull()
      .default("pending"),
    lat: real("lat"),
    lng: real("lng"),
    h3r8: text("h3_r8"),
    h3r9: text("h3_r9"),
    /** Lets us recompute level from raw distance without a firmware update. */
    mountHeightCm: real("mount_height_cm"),
    warningCm: real("warning_cm").notNull(),
    criticalCm: real("critical_cm").notNull(),
    reportingIntervalS: integer("reporting_interval_s").notNull().default(300),
    /** sha256 of the device key; the key itself is shown once at registration. */
    apiKeyHash: text("api_key_hash").notNull().unique(),
    apiKeyPrefix: text("api_key_prefix").notNull(),
    /** Future QR claim flow. */
    claimCodeHash: text("claim_code_hash"),
    lastSeenAt: timestamp("last_seen_at"),
    lastMeasuredAt: timestamp("last_measured_at"),
    lastLevelCm: real("last_level_cm"),
    lastBatteryPct: integer("last_battery_pct"),
    lastRssiDbm: integer("last_rssi_dbm"),
    firmware: text("firmware"),
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("devices_lat_lng_idx").on(t.lat, t.lng),
    index("devices_h3_r8_idx").on(t.h3r8),
  ],
);

export const sensorReadings = sqliteTable(
  "sensor_readings",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    deviceReadingId: text("device_reading_id"),
    measuredAt: integer("measured_at", { mode: "timestamp_ms" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    levelCm: real("level_cm").notNull(),
    distanceCm: real("distance_cm"),
    batteryPct: integer("battery_pct"),
    batteryMv: integer("battery_mv"),
    rssiDbm: integer("rssi_dbm"),
    firmware: text("firmware"),
    transport: text("transport", {
      enum: ["http", "ttn", "mqtt", "simulator", "seed"],
    }).notNull(),
    /** Untouched reading payload. */
    raw: text("raw", { mode: "json" }).notNull(),
  },
  (t) => [
    // Idempotency and the time-series index in one.
    uniqueIndex("sensor_readings_device_time_idx").on(t.deviceId, t.measuredAt),
    uniqueIndex("sensor_readings_device_rid_idx").on(
      t.deviceId,
      t.deviceReadingId,
    ),
  ],
);

/** Threshold state changes; these feed future alerts. */
export const deviceAlerts = sqliteTable(
  "device_alerts",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    level: text("level", { enum: DEVICE_LEVELS }).notNull(),
    levelCm: real("level_cm"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: timestamp("ended_at"),
  },
  (t) => [index("device_alerts_device_idx").on(t.deviceId, t.startedAt)],
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
