/**
 * Pure rules for operator edits: input validation, the resulting patch, and the
 * audit diff. No I/O; unit-tested.
 */
import { z } from "zod";
import {
  DEVICE_SITE_TYPES,
  DEVICE_VISIBILITIES,
  type DeviceStatus,
  EDITABLE_DEVICE_STATUSES,
} from "@/config/devices";
import type { AuditAction } from "@/config/operators";
import { isInsidePilot } from "@/config/pilot";
import { LEVEL_RANGE_CM } from "./rules";

export const deviceUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    siteType: z.enum(DEVICE_SITE_TYPES),
    status: z.enum(EDITABLE_DEVICE_STATUSES),
    visibility: z.enum(DEVICE_VISIBILITIES),
    lat: z.number().finite(),
    lng: z.number().finite(),
    mountHeightCm: z.number().positive().max(2000).nullable(),
    warningCm: z.number().min(0).max(LEVEL_RANGE_CM.max),
    criticalCm: z.number().min(0).max(LEVEL_RANGE_CM.max),
    reportingIntervalS: z.number().int().min(60).max(86_400),
  })
  .superRefine((input, ctx) => {
    if (input.criticalCm <= input.warningCm) {
      ctx.addIssue({
        code: "custom",
        path: ["criticalCm"],
        message: "critical must be above warning",
      });
    }
    if (!isInsidePilot(input.lng, input.lat)) {
      ctx.addIssue({
        code: "custom",
        path: ["lat"],
        message: "outside the pilot area",
      });
    }
  });
export type DeviceUpdate = z.infer<typeof deviceUpdateSchema>;

/** Form fields that can show an error; latitude and longitude share "location". */
export const EDIT_FIELDS = [
  "name",
  "siteType",
  "status",
  "visibility",
  "location",
  "mountHeightCm",
  "warningCm",
  "criticalCm",
  "reportingIntervalS",
] as const;
export type EditField = (typeof EDIT_FIELDS)[number];

export function invalidFields(error: z.ZodError): EditField[] {
  const fields = new Set<EditField>();
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    const field = key === "lat" || key === "lng" ? "location" : key;
    if ((EDIT_FIELDS as readonly string[]).includes(field)) {
      fields.add(field as EditField);
    }
  }
  return [...fields];
}

type EditableDevice = Omit<DeviceUpdate, "status"> & { status: DeviceStatus };

/**
 * Values to store. A pending sensor stays pending when the form says "active":
 * only its first reading activates it.
 */
export function nextDeviceValues(
  device: EditableDevice,
  input: DeviceUpdate,
): EditableDevice {
  return {
    ...input,
    status:
      device.status === "pending" && input.status === "active"
        ? "pending"
        : input.status,
  };
}

export type Changes = Record<string, { from: unknown; to: unknown }>;

export function diffDevice(
  before: EditableDevice,
  after: EditableDevice,
): Changes {
  const changes: Changes = {};
  for (const key of Object.keys(after) as (keyof EditableDevice)[]) {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}

/** A single-purpose edit gets its own action so the history reads naturally. */
export function auditActionFor(changes: Changes): AuditAction {
  const keys = Object.keys(changes);
  if (keys.length === 1 && keys[0] === "status") return "status_change";
  if (keys.length === 1 && keys[0] === "visibility") return "visibility_change";
  return "update";
}

export function thresholdsChanged(changes: Changes): boolean {
  return "warningCm" in changes || "criticalCm" in changes;
}
