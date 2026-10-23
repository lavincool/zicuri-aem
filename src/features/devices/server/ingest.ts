import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { type Device, devices, sensorReadings } from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";
import {
  checkReading,
  deviceLevel,
  levelFor,
  nextIntervalSeconds,
} from "../rules";
import type { IngestResponse, ReadingPayload } from "../schema";
import { recordLevelChange } from "./alerts";

export type Transport = "http" | "ttn" | "mqtt" | "simulator" | "seed";

/**
 * The single ingestion path for every transport (HTTP today; TTN/LoRaWAN webhooks
 * or an MQTT bridge later are thin adapters around this). Idempotent: repeated
 * readings (same device + timestamp, or same device reading ID) count as duplicates.
 */
export async function ingestReadings(
  device: Device,
  payloads: ReadingPayload[],
  options: { transport: Transport; now?: Date },
): Promise<IngestResponse> {
  const now = options.now ?? new Date();
  const rejected: IngestResponse["rejected"] = [];
  const valid: { payload: ReadingPayload; measuredAt: Date }[] = [];

  payloads.forEach((payload, index) => {
    const measuredAt = new Date(payload.measured_at);
    const problem = checkReading(
      { measuredAt, levelCm: payload.level_cm },
      now,
    );
    if (problem) rejected.push({ index, code: problem });
    else valid.push({ payload, measuredAt });
  });

  const inserted = valid.length
    ? await db()
        .insert(sensorReadings)
        .values(
          valid.map(({ payload, measuredAt }) => ({
            id: prefixedId("rdg"),
            deviceId: device.id,
            deviceReadingId: payload.id ?? null,
            measuredAt,
            receivedAt: now,
            levelCm: payload.level_cm,
            distanceCm: payload.distance_cm ?? null,
            batteryPct: payload.battery_pct ?? null,
            batteryMv: payload.battery_mv ?? null,
            rssiDbm: payload.rssi_dbm ?? null,
            firmware: payload.firmware ?? null,
            transport: options.transport,
            raw: payload,
          })),
        )
        .onConflictDoNothing()
        .returning({
          measuredAt: sensorReadings.measuredAt,
          levelCm: sensorReadings.levelCm,
          batteryPct: sensorReadings.batteryPct,
          rssiDbm: sensorReadings.rssiDbm,
          firmware: sensorReadings.firmware,
        })
    : [];

  const latest = inserted.reduce<(typeof inserted)[number] | null>(
    (best, row) => (!best || row.measuredAt > best.measuredAt ? row : best),
    null,
  );
  const isNewest =
    latest !== null &&
    (!device.lastMeasuredAt || latest.measuredAt > device.lastMeasuredAt);

  const updated: Device = {
    ...device,
    status:
      device.status === "pending" && valid.length ? "active" : device.status,
    lastSeenAt: valid.length ? now : device.lastSeenAt,
    ...(isNewest && latest
      ? {
          lastMeasuredAt: latest.measuredAt,
          lastLevelCm: latest.levelCm,
          lastBatteryPct: latest.batteryPct ?? device.lastBatteryPct,
          lastRssiDbm: latest.rssiDbm ?? device.lastRssiDbm,
          firmware: latest.firmware ?? device.firmware,
        }
      : {}),
  };

  if (valid.length) {
    await db()
      .update(devices)
      .set({
        status: updated.status,
        lastSeenAt: updated.lastSeenAt,
        lastMeasuredAt: updated.lastMeasuredAt,
        lastLevelCm: updated.lastLevelCm,
        lastBatteryPct: updated.lastBatteryPct,
        lastRssiDbm: updated.lastRssiDbm,
        firmware: updated.firmware,
        updatedAt: now,
      })
      .where(eq(devices.id, device.id));
  }

  if (isNewest && latest) {
    await recordLevelChange(db(), {
      deviceId: device.id,
      level: levelFor(latest.levelCm, updated),
      levelCm: latest.levelCm,
      startedAt: latest.measuredAt,
      now,
    });
  }

  const level = deviceLevel(updated, now);
  return {
    accepted: inserted.length,
    duplicates: valid.length - inserted.length,
    rejected,
    status: level,
    next_interval_s: nextIntervalSeconds(level, device.reportingIntervalS),
    server_time: now.toISOString(),
  };
}
