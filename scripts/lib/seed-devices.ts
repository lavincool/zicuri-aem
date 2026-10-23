/**
 * Demo sensors with 7 days of readings: five reporting normally (one rain bump a week
 * ago) and one that went silent three hours ago, so every map state is visible.
 */
import { eq, inArray, sql } from "drizzle-orm";
import type { DeviceSiteType } from "@/config/devices";
import { levelFor } from "@/features/devices/rules";
import { db } from "@/lib/db/client";
import { deviceAlerts, devices, sensorReadings } from "@/lib/db/schema";
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
];

function levelAt(sensor: DemoSensor, t: number, now: number): number {
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
      const levelCm = levelAt(sensor, t, now);
      const battery = Math.round(
        98 - ((t - (now - 7 * 24 * HOUR)) / (7 * 24 * HOUR)) * 9,
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
