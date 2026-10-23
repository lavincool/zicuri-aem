/**
 * Registers a water-level sensor and prints its API key once.
 *
 * Usage:
 *   bun run device:register -- --name "Buenavista · Calle 1" --lat 25.8226 --lng -97.562 \
 *     [--site street_drain] [--warning 10] [--critical 25] [--interval 300] [--write-local]
 *
 * --write-local also saves the key to .simulator-devices.json (git-ignored) for the simulator.
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { DEVICE_SITE_TYPES } from "@/config/devices";
import {
  ensureDemoOrganization,
  registerDevice,
  saveSimulatorDevices,
} from "./lib/devices";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    lat: { type: "string" },
    lng: { type: "string" },
    site: { type: "string", default: "street_drain" },
    warning: { type: "string" },
    critical: { type: "string" },
    interval: { type: "string", default: "300" },
    "write-local": { type: "boolean", default: false },
  },
});

const args = z
  .object({
    name: z.string().min(3),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    site: z.enum(DEVICE_SITE_TYPES),
    warning: z.coerce.number().positive().optional(),
    critical: z.coerce.number().positive().optional(),
    interval: z.coerce.number().int().min(10).max(86_400),
  })
  .safeParse(values);

if (!args.success) {
  console.error("Invalid arguments:");
  for (const issue of args.error.issues) {
    console.error(`  --${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

await ensureDemoOrganization();
const { device, key } = await registerDevice({
  name: args.data.name,
  lat: args.data.lat,
  lng: args.data.lng,
  siteType: args.data.site,
  warningCm: args.data.warning,
  criticalCm: args.data.critical,
  reportingIntervalS: args.data.interval,
});

if (values["write-local"]) {
  await saveSimulatorDevices([
    {
      id: device.id,
      name: device.name,
      key,
      siteType: device.siteType,
      warningCm: device.warningCm,
      criticalCm: device.criticalCm,
    },
  ]);
}

console.log(`
Device registered
  id:         ${device.id}
  name:       ${device.name}
  thresholds: warning ${device.warningCm} cm · critical ${device.criticalCm} cm
  interval:   ${device.reportingIntervalS} s

API key (shown only once, store it in the device firmware):
  ${key}

Send readings with:
  curl -X POST $APP_URL/api/v1/readings \\
    -H "Authorization: Bearer ${key}" \\
    -H "Content-Type: application/json" \\
    -d '{"measured_at":"${new Date().toISOString()}","level_cm":4.2,"battery_pct":90}'
`);
