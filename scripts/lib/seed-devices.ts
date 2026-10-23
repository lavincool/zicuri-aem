/**
 * Demo sensors with 7 days of readings: most report normally (one rain bump a week
 * ago), one went silent three hours ago, and three show what the operator portal
 * flags: a private one, a low battery and a stuck (flat) reading.
 */
import { eq, inArray, sql } from "drizzle-orm";
import type { DeviceSiteType, DeviceVisibility } from "@/config/devices";
import { levelFor } from "@/features/devices/rules";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  deviceAlerts,
  devices,
  sensorReadings,
} from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";
import {
  ensureDemoOrganization,
  registerDevice,
  type SimulatorDevice,
  saveSimulatorDevices,
} from "./devices";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const STEP = 30 * MINUTE;

type DemoSensor = {
  name: string;
  lng: number;
  lat: number;
  site: DeviceSiteType;
  base: number;
  bump: number;
  silentForMs?: number;
  visibility?: DeviceVisibility;
  /** Battery at the start and the end of the week, in percent. */
  battery?: [start: number, end: number];
  /** A stuck sensor repeats this level with millimetric noise. */
  flatCm?: number;
  /** One glitchy reading (an echo) this long ago, then back to normal. */
  spikeAgoMs?: number;
};

const SENSORS: DemoSensor[] = [
  {
    name: "Buenavista · Calle 1",
    lng: -97.5612,
    lat: 25.8231,
    site: "street_drain",
    base: 2.5,
    bump: 14,
  },
  {
    name: "San Francisco · Calle Laguna",
    lng: -97.5609,
    lat: 25.8318,
    site: "street_drain",
    base: 3,
    bump: 12,
  },
  {
    name: "Los Sauces · Calle Sauce",
    lng: -97.5195,
    lat: 25.8514,
    site: "street_drain",
    base: 2,
    bump: 9,
    spikeAgoMs: 5 * HOUR,
  },
  {
    name: "Dren · Rinconada de las Brisas",
    lng: -97.5662,
    lat: 25.8476,
    site: "canal",
    base: 72,
    bump: 132,
  },
  {
    name: "Centro · Calle 6",
    lng: -97.5046,
    lat: 25.8786,
    site: "street_drain",
    base: 1.5,
    bump: 6,
  },
  {
    name: "Paseo Residencial",
    lng: -97.5236,
    lat: 25.8548,
    site: "street_drain",
    base: 2,
    bump: 8,
    silentForMs: 3 * HOUR,
  },
  {
    name: "Cárcamo de bombeo · Valle Alto",
    lng: -97.5131,
    lat: 25.8499,
    site: "canal",
    base: 64,
    bump: 118,
    visibility: "private",
  },
  {
    name: "Residencial Misiones · Calle San Juan",
    lng: -97.5502,
    lat: 25.8301,
    site: "street_drain",
    base: 2.2,
    bump: 11,
    battery: [31, 14],
  },
  {
    name: "Los Palmares · Av. Palmas",
    lng: -97.5529,
    lat: 25.8446,
    site: "street_drain",
    base: 3.2,
    bump: 0,
    flatCm: 3.2,
  },
];

function levelAt(sensor: DemoSensor, t: number, now: number): number {
  if (sensor.flatCm !== undefined) {
    return Number((sensor.flatCm + Math.sin(t / 3_600_000) * 0.05).toFixed(1));
  }
  const diurnal = Math.sin((t / (24 * HOUR)) * 2 * Math.PI) * 0.6;
  const noise = Math.sin(t / 7_919_000 + sensor.lng * 1000) * 0.4;
  // Rain bump a week ago: ~6 h rise and fall.
  const center = now - 7 * 24 * HOUR + 5 * HOUR;
  const distance = Math.abs(t - center) / (2.5 * HOUR);
  const bump =
    distance < 1 ? (sensor.bump - sensor.base) * (1 - distance ** 2) : 0;
  return Math.max(0, Number((sensor.base + diurnal + noise + bump).toFixed(1)));
}

export async function seedDevices(now = Date.now()): Promise<number> {
  const database = db();
  await ensureDemoOrganization();

  const old = await database
    .select({ id: devices.id })
    .from(devices)
    .where(sql`json_extract(${devices.metadata}, '$.seed') = 1`);
  const oldIds = old.map((d) => d.id);
  if (oldIds.length) {
    await database
      .delete(sensorReadings)
      .where(inArray(sensorReadings.deviceId, oldIds));
    await database
      .delete(deviceAlerts)
      .where(inArray(deviceAlerts.deviceId, oldIds));
    await database
      .delete(auditEvents)
      .where(inArray(auditEvents.entityId, oldIds));
    await database.delete(devices).where(inArray(devices.id, oldIds));
  }

  const simulator: SimulatorDevice[] = [];
  for (const sensor of SENSORS) {
    const { device, key } = await registerDevice({
      name: sensor.name,
      lat: sensor.lat,
      lng: sensor.lng,
      siteType: sensor.site,
      // Matches the 30-min history so seeded sensors stay "online" for 90 min between demos.
      reportingIntervalS: 1800,
      metadata: { seed: 1 },
    });
    simulator.push({
      id: device.id,
      name: device.name,
      key,
      siteType: device.siteType,
      warningCm: device.warningCm,
      criticalCm: device.criticalCm,
    });

    const end = now - (sensor.silentForMs ?? 2 * MINUTE);
    const readings: (typeof sensorReadings.$inferInsert)[] = [];
    const alerts: (typeof deviceAlerts.$inferInsert)[] = [];
    let previous: string | null = null;
    for (let t = now - 7 * 24 * HOUR; t <= end; t += STEP) {
      const spike =
        sensor.spikeAgoMs !== undefined &&
        Math.abs(t - (now - sensor.spikeAgoMs)) < STEP / 2;
      const levelCm = spike ? 38.5 : levelAt(sensor, t, now);
      const [batteryStart, batteryEnd] = sensor.battery ?? [98, 89];
      const battery = Math.round(
        batteryStart -
          ((t - (now - 7 * 24 * HOUR)) / (7 * 24 * HOUR)) *
            (batteryStart - batteryEnd),
      );
      readings.push({
        id: prefixedId("rdg"),
        deviceId: device.id,
        measuredAt: new Date(t),
        receivedAt: new Date(t + 1500),
        levelCm,
        batteryPct: battery,
        rssiDbm: -62 - Math.round(Math.abs(Math.sin(t)) * 12),
        firmware: "0.3.1",
        transport: "seed",
        raw: { measured_at: new Date(t).toISOString(), level_cm: levelCm },
      });
      const level = levelFor(levelCm, device);
      if (level !== previous) {
        const open = alerts.at(-1);
        if (open) open.endedAt = new Date(t);
        alerts.push({
          id: prefixedId("alt"),
          deviceId: device.id,
          level,
          levelCm,
          startedAt: new Date(t),
        });
        previous = level;
      }
    }
    for (let i = 0; i < readings.length; i += 200) {
      await database.insert(sensorReadings).values(readings.slice(i, i + 200));
    }
    if (alerts.length) await database.insert(deviceAlerts).values(alerts);

    const last = readings.at(-1);
    await database
      .update(devices)
      .set({
        status: "active",
        visibility: sensor.visibility ?? "public",
        lastSeenAt: last?.receivedAt,
        lastMeasuredAt: last?.measuredAt,
        lastLevelCm: last?.levelCm,
        lastBatteryPct: last?.batteryPct,
        lastRssiDbm: last?.rssiDbm,
        firmware: "0.3.1",
      })
      .where(eq(devices.id, device.id));
  }

  await saveSimulatorDevices(simulator, { replace: true });
  return SENSORS.length;
}
