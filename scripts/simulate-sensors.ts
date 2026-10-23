/**
 * Sends realistic water-level readings to the device API, using the keys in
 * .simulator-devices.json (written by `bun run seed` or `device:register --write-local`).
 *
 * Usage:
 *   bun run simulate -- --scenario rising [--device buenavista] [--tick 3] [--base-url http://localhost:3000]
 *
 * Scenarios (the target device follows the scenario; the others report calm levels):
 *   calm     steady low readings for every device
 *   rain     gradual rise to just above warning over ~3 minutes
 *   rising   demo: 2 → 35 cm in ~90 s (warning at ~30 s, critical at ~60 s), then holds
 *   outage   goes silent for --silence seconds, then sends the buffered readings as one batch
 *   noisy    ultrasonic glitches: spikes, a negative echo and an out-of-range value
 */
import { parseArgs } from "node:util";
import {
  readSimulatorDevices,
  type SimulatorDevice,
} from "./lib/simulator-file";

const { values } = parseArgs({
  options: {
    scenario: { type: "string", default: "calm" },
    device: { type: "string" },
    tick: { type: "string", default: "3" },
    silence: { type: "string", default: "30" },
    duration: { type: "string" },
    "base-url": {
      type: "string",
      default: process.env.SIMULATOR_BASE_URL ?? "http://localhost:3000",
    },
  },
});

const SCENARIOS = ["calm", "rain", "rising", "outage", "noisy"] as const;
type Scenario = (typeof SCENARIOS)[number];
const scenario = values.scenario as Scenario;
if (!SCENARIOS.includes(scenario)) {
  console.error(
    `Unknown scenario "${values.scenario}". Use: ${SCENARIOS.join(", ")}`,
  );
  process.exit(1);
}
const tickS = Number(values.tick);
const baseUrl = String(values["base-url"]).replace(/\/$/, "");

const all = await readSimulatorDevices();
if (all.length === 0) {
  console.error(
    "No devices in .simulator-devices.json. Run `bun run seed` first.",
  );
  process.exit(1);
}
const live = all.filter((d) => !d.name.startsWith("Paseo Residencial")); // keep the demo's offline sensor silent
const needle = (values.device ?? "buenavista").toLowerCase();
const target =
  live.find(
    (d) => d.id === values.device || d.name.toLowerCase().includes(needle),
  ) ?? live[0];
if (!target) process.exit(1);

const colors = {
  normal: "\x1b[32m",
  warning: "\x1b[33m",
  critical: "\x1b[31m",
  offline: "\x1b[90m",
} as const;
const reset = "\x1b[0m";
const time = () => new Date().toLocaleTimeString("es-MX", { hour12: false });

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const jitter = (amount: number) => (Math.random() - 0.5) * 2 * amount;

function calmLevel(device: SimulatorDevice): number {
  return device.siteType === "canal" ? 72 + jitter(2) : 2.5 + jitter(0.6);
}

function targetLevel(elapsedS: number): number | null {
  switch (scenario) {
    case "rising":
      return 2 + 33 * smoothstep(elapsedS / 90) + jitter(0.4);
    case "rain":
      return 3 + 9 * smoothstep(elapsedS / 180) + jitter(0.4);
    case "noisy": {
      const roll = Math.random();
      if (roll < 0.1) return 60 + jitter(20); // multipath spike
      if (roll < 0.15) return -8; // negative echo (still accepted, kept raw)
      if (roll < 0.18) return 4000; // out of range → rejected by the API
      return 3 + jitter(0.5);
    }
    default:
      return null;
  }
}

type Reading = {
  id: string;
  measured_at: string;
  level_cm: number;
  battery_pct: number;
  rssi_dbm: number;
  firmware: string;
};
let counter = 0;
function reading(level: number): Reading {
  counter += 1;
  return {
    id: `sim-${Date.now()}-${counter}`,
    measured_at: new Date().toISOString(),
    level_cm: Number(level.toFixed(1)),
    battery_pct: 87,
    rssi_dbm: -64 + Math.round(jitter(4)),
    firmware: "0.3.1-sim",
  };
}

async function send(device: SimulatorDevice, readings: Reading[]) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/readings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${device.key}`,
        "Content-Type": "application/json",
        "X-Cauce-Transport": "simulator",
      },
      body: JSON.stringify(readings.length === 1 ? readings[0] : { readings }),
    });
    const body = (await response.json()) as {
      status?: keyof typeof colors;
      next_interval_s?: number;
      accepted?: number;
      duplicates?: number;
      rejected?: { code: string }[];
      error?: { code: string };
    };
    if (!response.ok) {
      console.log(
        `[${time()}] ${device.name}: HTTP ${response.status} ${body.error?.code ?? ""}`,
      );
      return;
    }
    const level = readings.at(-1)?.level_cm;
    const color = colors[body.status ?? "offline"];
    const extra = [
      readings.length > 1 ? `batch ${readings.length}` : null,
      body.duplicates ? `${body.duplicates} dup` : null,
      body.rejected?.length
        ? `rejected: ${body.rejected.map((r) => r.code).join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(
      `[${time()}] ${device.name.padEnd(32)} ${String(level).padStart(6)} cm → ${color}${body.status}${reset} (next ${body.next_interval_s}s)${extra ? ` · ${extra}` : ""}`,
    );
  } catch (error) {
    console.log(
      `[${time()}] ${device.name}: network error (${(error as Error).message})`,
    );
  }
}

console.log(
  `Simulating "${scenario}" against ${baseUrl}; target: ${target.name}. Ctrl+C to stop.\n`,
);
const startedAt = Date.now();
const durationMs = values.duration
  ? Number(values.duration) * 1000
  : Number.POSITIVE_INFINITY;
const buffer: Reading[] = [];
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
  console.log("\nStopped.");
  process.exit(0);
});

while (!stopped && Date.now() - startedAt < durationMs) {
  const elapsedS = (Date.now() - startedAt) / 1000;
  for (const device of live) {
    if (device.id === target.id && scenario === "outage") {
      const silence = Number(values.silence);
      buffer.push(reading(calmLevel(device)));
      if (elapsedS >= silence) {
        await send(device, buffer.splice(0, buffer.length));
      } else {
        console.log(
          `[${time()}] ${device.name.padEnd(32)} (offline, buffered ${buffer.length})`,
        );
      }
      continue;
    }
    const level = device.id === target.id ? targetLevel(elapsedS) : null;
    await send(device, [reading(level ?? calmLevel(device))]);
  }
  await new Promise((resolve) => setTimeout(resolve, tickS * 1000));
}
