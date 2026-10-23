/**
 * The git-ignored file that holds simulator device keys. Kept free of database
 * imports so the simulator can run against any deployment without local secrets.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DeviceSiteType } from "@/config/devices";

export const SIMULATOR_FILE = path.join(
  process.cwd(),
  ".simulator-devices.json",
);

export type SimulatorDevice = {
  id: string;
  name: string;
  key: string;
  siteType: DeviceSiteType;
  warningCm: number;
  criticalCm: number;
};

export async function readSimulatorDevices(): Promise<SimulatorDevice[]> {
  try {
    const data = JSON.parse(await readFile(SIMULATOR_FILE, "utf8")) as {
      devices?: SimulatorDevice[];
    };
    return data.devices ?? [];
  } catch {
    return [];
  }
}

/** Keeps device keys for the simulator in a git-ignored local file. */
export async function saveSimulatorDevices(
  entries: SimulatorDevice[],
  { replace = false } = {},
): Promise<void> {
  const current = replace ? [] : await readSimulatorDevices();
  const ids = new Set(entries.map((e) => e.id));
  const merged = [...current.filter((d) => !ids.has(d.id)), ...entries];
  await writeFile(
    SIMULATOR_FILE,
    `${JSON.stringify({ devices: merged }, null, 2)}\n`,
  );
}
