import { eq } from "drizzle-orm";
import { DEFAULT_THRESHOLDS, type DeviceSiteType } from "@/config/devices";
import { DEMO_ORG_ID } from "@/config/operators";
import { generateDeviceKey } from "@/features/devices/server/keys";
import { db } from "@/lib/db/client";
import { type Device, devices, organizations } from "@/lib/db/schema";
import { h3Cells } from "@/lib/h3";
import { prefixedId } from "@/lib/ids";

export {
  readSimulatorDevices,
  type SimulatorDevice,
  saveSimulatorDevices,
} from "./simulator-file";

export { DEMO_ORG_ID };

const DEMO_ORG_NAME = "Operador demo";
/** Owns the seeded sensors; the demo operator account belongs to it. */
export async function ensureDemoOrganization(): Promise<void> {
  await db()
    .insert(organizations)
    .values({ id: DEMO_ORG_ID, name: DEMO_ORG_NAME, kind: "operator" })
    .onConflictDoUpdate({
      target: organizations.id,
      set: { name: DEMO_ORG_NAME },
    });
}

export async function registerDevice(input: {
  name: string;
  lat: number;
  lng: number;
  siteType: DeviceSiteType;
  warningCm?: number;
  criticalCm?: number;
  reportingIntervalS?: number;
  orgId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ device: Device; key: string }> {
  const defaults = DEFAULT_THRESHOLDS[input.siteType];
  const { key, hash, prefix } = generateDeviceKey();
  const [device] = await db()
    .insert(devices)
    .values({
      id: prefixedId("dev"),
      orgId: input.orgId ?? DEMO_ORG_ID,
      name: input.name,
      type: "ultrasonic_level",
      siteType: input.siteType,
      status: "pending",
      lat: input.lat,
      lng: input.lng,
      ...h3Cells(input.lat, input.lng),
      warningCm: input.warningCm ?? defaults.warningCm,
      criticalCm: input.criticalCm ?? defaults.criticalCm,
      reportingIntervalS: input.reportingIntervalS ?? 300,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (!device) throw new Error("Device insert failed");
  return { device, key };
}

export async function deviceExists(id: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);
  return Boolean(row);
}
