import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditEvents, type Device, devices } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { h3Cells } from "@/lib/h3";
import { prefixedId } from "@/lib/ids";
import {
  auditActionFor,
  type Changes,
  type DeviceUpdate,
  diffDevice,
  nextDeviceValues,
  thresholdsChanged,
} from "../edits";
import { levelFor } from "../rules";
import { closeOpenAlert, recordLevelChange } from "./alerts";
import { generateDeviceKey } from "./keys";

/** Who is acting: every command is scoped to the actor's organization. */
export type Actor = { userId: string; orgId: string };

async function findOwnDevice(actor: Actor, deviceId: string): Promise<Device> {
  const [device] = await db()
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.orgId, actor.orgId)))
    .limit(1);
  if (!device) throw new DomainError("NOT_FOUND", 404, "Device not found");
  return device;
}

/**
 * Applies an operator edit and records it in `audit_events` in the same transaction.
 * New thresholds re-evaluate the current level at once (opening or closing the alert
 * period) instead of waiting for the next reading.
 */
export async function updateDevice(
  actor: Actor,
  deviceId: string,
  input: DeviceUpdate,
  now = new Date(),
): Promise<Changes> {
  const device = await findOwnDevice(actor, deviceId);
  const before = {
    name: device.name,
    siteType: device.siteType,
    status: device.status,
    visibility: device.visibility,
    // Null until a location is set; the diff then records the first one.
    lat: device.lat as number,
    lng: device.lng as number,
    mountHeightCm: device.mountHeightCm,
    warningCm: device.warningCm,
    criticalCm: device.criticalCm,
    reportingIntervalS: device.reportingIntervalS,
  };
  const after = nextDeviceValues(before, input);
  const changes = diffDevice(before, after);
  if (Object.keys(changes).length === 0) return changes;

  await db().transaction(async (tx) => {
    await tx
      .update(devices)
      .set({
        ...after,
        ...("lat" in changes || "lng" in changes
          ? h3Cells(after.lat, after.lng)
          : {}),
        updatedAt: now,
      })
      .where(eq(devices.id, device.id));
    await tx.insert(auditEvents).values({
      id: prefixedId("aud"),
      orgId: actor.orgId,
      userId: actor.userId,
      entity: "device",
      entityId: device.id,
      action: auditActionFor(changes),
      changes,
      createdAt: now,
    });

    const active = after.status === "active" || after.status === "pending";
    if (!active && "status" in changes) {
      await closeOpenAlert(tx, device.id, now);
    } else if (
      active &&
      device.lastLevelCm !== null &&
      (thresholdsChanged(changes) || "status" in changes)
    ) {
      await recordLevelChange(tx, {
        deviceId: device.id,
        level: levelFor(device.lastLevelCm, after),
        levelCm: device.lastLevelCm,
        startedAt: now,
        now,
      });
    }
  });
  return changes;
}

/**
 * Replaces the device key. The old key stops working at once (no grace period);
 * the new one is returned exactly once.
 */
export async function rotateDeviceKey(
  actor: Actor,
  deviceId: string,
  now = new Date(),
): Promise<{ key: string }> {
  const device = await findOwnDevice(actor, deviceId);
  const { key, hash, prefix } = generateDeviceKey();
  await db().transaction(async (tx) => {
    await tx
      .update(devices)
      .set({ apiKeyHash: hash, apiKeyPrefix: prefix, updatedAt: now })
      .where(eq(devices.id, device.id));
    await tx.insert(auditEvents).values({
      id: prefixedId("aud"),
      orgId: actor.orgId,
      userId: actor.userId,
      entity: "device",
      entityId: device.id,
      action: "key_rotation",
      changes: { apiKeyPrefix: { from: device.apiKeyPrefix, to: prefix } },
      createdAt: now,
    });
  });
  return { key };
}
