/** Sensor configuration shared by the API, the map and scripts. */

export const DEVICE_SITE_TYPES = [
  "street_drain",
  "canal",
  "river",
  "other",
] as const;
export type DeviceSiteType = (typeof DEVICE_SITE_TYPES)[number];

export const DEVICE_STATUSES = [
  "pending",
  "active",
  "maintenance",
  "retired",
] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
/** States an operator can set; `pending` only ends with the first reading. */
export const EDITABLE_DEVICE_STATUSES = [
  "active",
  "maintenance",
  "retired",
] as const;
export type EditableDeviceStatus = (typeof EDITABLE_DEVICE_STATUSES)[number];

/** Private sensors stay off the public map but still feed the risk model and the panel. */
export const DEVICE_VISIBILITIES = ["public", "private"] as const;
export type DeviceVisibility = (typeof DEVICE_VISIBILITIES)[number];

/** Threshold level of a reading. `offline` is derived from silence, not from a reading. */
export const DEVICE_LEVELS = [
  "normal",
  "warning",
  "critical",
  "offline",
] as const;
export type DeviceLevel = (typeof DEVICE_LEVELS)[number];

/** Starting thresholds per site (cm above the site's zero), editable per device. */
export const DEFAULT_THRESHOLDS: Record<
  DeviceSiteType,
  { warningCm: number; criticalCm: number }
> = {
  street_drain: { warningCm: 10, criticalCm: 25 },
  canal: { warningCm: 120, criticalCm: 180 },
  river: { warningCm: 300, criticalCm: 450 },
  other: { warningCm: 20, criticalCm: 40 },
};

export const LEVEL_COLORS: Record<DeviceLevel, string> = {
  normal: "#009e73",
  warning: "#f0b400",
  critical: "#d7263d",
  offline: "#8a96a3",
};

/** A device is offline after this many missed reporting intervals. */
export const OFFLINE_AFTER_INTERVALS = 3;
/** Devices report faster while water is above the warning level. */
export const ALERT_INTERVAL_S = 60;
export const MAX_BATCH = 100;
