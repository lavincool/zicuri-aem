import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DeviceLevel } from "@/config/devices";
import type { Database } from "@/lib/db/client";
import { deviceAlerts } from "@/lib/db/schema";
import { prefixedId } from "@/lib/ids";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

async function openAlert(executor: Executor, deviceId: string) {
  const [open] = await executor
    .select()
    .from(deviceAlerts)
    .where(
      and(eq(deviceAlerts.deviceId, deviceId), isNull(deviceAlerts.endedAt)),
    )
    .orderBy(desc(deviceAlerts.startedAt))
    .limit(1);
  return open;
}

/**
 * Opens a new alert period when the threshold level changes (normal ↔ warning ↔
 * critical). Called on new readings and when an operator edits the thresholds.
 */
export async function recordLevelChange(
  executor: Executor,
  input: {
    deviceId: string;
    level: Exclude<DeviceLevel, "offline">;
    levelCm: number;
    startedAt: Date;
    now: Date;
  },
): Promise<void> {
  const open = await openAlert(executor, input.deviceId);
  if (open?.level === input.level) return;
  if (open) {
    await executor
      .update(deviceAlerts)
      .set({ endedAt: input.now })
      .where(eq(deviceAlerts.id, open.id));
  }
  await executor.insert(deviceAlerts).values({
    id: prefixedId("alt"),
    deviceId: input.deviceId,
    level: input.level,
    levelCm: input.levelCm,
    startedAt: input.startedAt,
  });
}

/** Ends the open period when a sensor goes to maintenance or is retired. */
export async function closeOpenAlert(
  executor: Executor,
  deviceId: string,
  now: Date,
): Promise<void> {
  await executor
    .update(deviceAlerts)
    .set({ endedAt: now })
    .where(
      and(eq(deviceAlerts.deviceId, deviceId), isNull(deviceAlerts.endedAt)),
    );
}
