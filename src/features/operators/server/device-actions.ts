"use server";

import { refresh, updateTag } from "next/cache";
import {
  deviceUpdateSchema,
  type EditField,
  invalidFields,
} from "@/features/devices/edits";
import {
  rotateDeviceKey,
  updateDevice,
} from "@/features/devices/server/commands";
import { DomainError } from "@/lib/errors";
import { requireOperator } from "./session";

export type UpdateDeviceResult =
  | { ok: true; changed: string[] }
  | { error: "invalid"; fields: EditField[] }
  | { error: "forbidden" | "not_found" };

/** Server Actions are public endpoints: each one re-checks the session and the role. */
export async function updateDeviceAction(
  deviceId: string,
  input: unknown,
): Promise<UpdateDeviceResult> {
  try {
    const operator = await requireOperator("edit_device");
    const parsed = deviceUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "invalid", fields: invalidFields(parsed.error) };
    }
    const changes = await updateDevice(operator, deviceId, parsed.data);
    // Public deep links and metadata are cached per device.
    updateTag(`device:${deviceId}`);
    refresh();
    return { ok: true, changed: Object.keys(changes) };
  } catch (error) {
    return mapError(error);
  }
}

export type RotateKeyResult =
  | { ok: true; key: string }
  | { error: "forbidden" | "not_found" };

export async function rotateDeviceKeyAction(
  deviceId: string,
): Promise<RotateKeyResult> {
  try {
    const operator = await requireOperator("rotate_key");
    const { key } = await rotateDeviceKey(operator, deviceId);
    refresh();
    return { ok: true, key };
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown): { error: "forbidden" | "not_found" } {
  if (error instanceof DomainError) {
    if (error.code === "FORBIDDEN") return { error: "forbidden" };
    if (error.code === "NOT_FOUND") return { error: "not_found" };
  }
  // Redirects (no session) and unexpected failures propagate.
  throw error;
}
