import { beforeAll, describe, expect, mock, spyOn, test } from "bun:test";
import { createClient } from "@libsql/client";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/lib/db/schema";
import type { ServerEnv } from "@/lib/env";

// Real SQL against an in-memory database: org scoping, audited commands, sign-in tokens.
mock.module("server-only", () => ({}));
const client = createClient({ url: "file::memory:" });
const database = drizzle(client, { schema });
const config = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SESSION_SECRET: "m8-test-secret-only",
  EMAIL_DRIVER: "console",
  EMAIL_FROM: "Cauce <test@cauce.example>",
} as ServerEnv;
mock.module("@/lib/db/client", () => ({ db: () => database }));
mock.module("@/lib/env", () => ({
  env: () => config,
  appUrl: () => config.NEXT_PUBLIC_APP_URL,
}));
spyOn(console, "info").mockImplementation(() => {});

const { getFleet, getFleetDeviceDetail, getFleetEvents } = await import(
  "./fleet"
);
const { consumeLoginToken, inspectLoginToken, sendLoginLink } = await import(
  "./magic-link"
);
const { rotateDeviceKey, updateDevice } = await import(
  "@/features/devices/server/commands"
);
const { getDeviceDetail, listDeviceFeatures } = await import(
  "@/features/devices/server/queries"
);
const { authenticateDevice } = await import("@/features/devices/server/auth");
const { generateDeviceKey } = await import("@/features/devices/server/keys");

const HOUR = 3_600_000;
const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const MATAMOROS_BBOX = [-97.68, 25.74, -97.36, 25.98] as [
  number,
  number,
  number,
  number,
];
const actorA = { userId: "usr_a", orgId: "org_a" };
const keys: Record<string, string> = {};

async function addDevice(id: string, orgId: string, lastLevelCm: number) {
  const { key, hash, prefix } = generateDeviceKey();
  keys[id] = key;
  await database.insert(schema.devices).values({
    id,
    orgId,
    name: `Sensor ${id}`,
    type: "ultrasonic_level",
    siteType: "street_drain",
    status: "active",
    lat: 25.8231,
    lng: -97.5612,
    h3r8: "8848a2b0e5fffff",
    h3r9: "8948a2b0e5bffff",
    warningCm: 10,
    criticalCm: 25,
    reportingIntervalS: 300,
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    lastSeenAt: ago(60_000),
    lastMeasuredAt: ago(60_000),
    lastLevelCm,
    lastBatteryPct: 80,
  });
}

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(schema.organizations).values([
    { id: "org_a", name: "Operador A", kind: "operator" },
    { id: "org_b", name: "Operador B", kind: "utility" },
  ]);
  await database
    .insert(schema.users)
    .values([{ id: "usr_a", email: "a@a.example", name: "Ana" }]);
  await addDevice("dev_a1", "org_a", 18);
  await addDevice("dev_b1", "org_b", 3);
  // dev_a1 has been in "warning" for an hour; its hourly readings leave three gaps
  // longer than the offline rule (3 × 5 min).
  await database.insert(schema.deviceAlerts).values({
    id: "alt_a1",
    deviceId: "dev_a1",
    level: "warning",
    levelCm: 12,
    startedAt: ago(HOUR),
  });
  await database.insert(schema.sensorReadings).values(
    [ago(3 * HOUR), ago(2 * HOUR), ago(HOUR), ago(60_000)].map((at, i) => ({
      id: `rdg_${i}`,
      deviceId: "dev_a1",
      measuredAt: at,
      receivedAt: at,
      levelCm: [4, 5, 12, 18][i] as number,
      transport: "seed" as const,
      raw: {},
    })),
  );
  // Another organization's flood must not leak into dev_a1's peak.
  await database.insert(schema.sensorReadings).values({
    id: "rdg_b1",
    deviceId: "dev_b1",
    measuredAt: ago(30 * 60_000),
    receivedAt: ago(30 * 60_000),
    levelCm: 99,
    transport: "seed",
    raw: {},
  });
});

describe("organization scoping", () => {
  test("the fleet only lists the organization's sensors", async () => {
    const fleet = await getFleet("org_a", now);
    expect(fleet.map((d) => d.id)).toEqual(["dev_a1"]);
    expect(fleet[0]?.level).toBe("warning");
  });

  test("another organization's sensor is not found", async () => {
    expect(
      await getFleetDeviceDetail("org_a", "dev_b1", "24h", now),
    ).toBeNull();
    expect(
      await getFleetDeviceDetail("org_a", "dev_a1", "24h", now),
    ).not.toBeNull();
    await expect(
      updateDevice(actorA, "dev_b1", {
        name: "Ajeno",
        siteType: "street_drain",
        status: "active",
        visibility: "public",
        lat: 25.8231,
        lng: -97.5612,
        mountHeightCm: null,
        warningCm: 10,
        criticalCm: 25,
        reportingIntervalS: 300,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("events include alert periods and gaps in readings", async () => {
    const events = await getFleetEvents("org_a", {}, now);
    expect(events.map((e) => e.level).sort()).toEqual([
      "offline",
      "offline",
      "offline",
      "warning",
    ]);
    const warning = events.find((e) => e.level === "warning");
    expect(warning).toMatchObject({
      deviceId: "dev_a1",
      endedAt: null,
      peakCm: 18,
    });
    expect(await getFleetEvents("org_b", {}, now)).toEqual([]);
  });
});

describe("device commands", () => {
  const base = {
    name: "Sensor dev_a1",
    siteType: "street_drain" as const,
    status: "active" as const,
    visibility: "public" as const,
    lat: 25.8231,
    lng: -97.5612,
    mountHeightCm: null,
    warningCm: 10,
    criticalCm: 25,
    reportingIntervalS: 300,
  };

  test("raising the warning threshold turns the sensor normal at once", async () => {
    const changes = await updateDevice(actorA, "dev_a1", {
      ...base,
      warningCm: 20,
      criticalCm: 30,
    });
    expect(Object.keys(changes).sort()).toEqual(["criticalCm", "warningCm"]);
    const open = await database
      .select()
      .from(schema.deviceAlerts)
      .where(
        and(
          eq(schema.deviceAlerts.deviceId, "dev_a1"),
          isNull(schema.deviceAlerts.endedAt),
        ),
      );
    expect(open.map((a) => a.level)).toEqual(["normal"]);
    const [audit] = await database
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.entityId, "dev_a1"));
    expect(audit).toMatchObject({ action: "update", userId: "usr_a" });
    expect(audit?.changes?.warningCm).toEqual({ from: 10, to: 20 });
  });

  test("an unchanged form writes nothing", async () => {
    const before = await database.select().from(schema.auditEvents);
    const changes = await updateDevice(actorA, "dev_a1", {
      ...base,
      warningCm: 20,
      criticalCm: 30,
    });
    expect(changes).toEqual({});
    expect(await database.select().from(schema.auditEvents)).toHaveLength(
      before.length,
    );
  });

  test("a private sensor leaves the public map and API", async () => {
    await updateDevice(actorA, "dev_a1", {
      ...base,
      warningCm: 20,
      criticalCm: 30,
      visibility: "private",
    });
    const publicIds = (await listDeviceFeatures(MATAMOROS_BBOX)).features.map(
      (f) => f.properties.id,
    );
    expect(publicIds).toEqual(["dev_b1"]);
    const panelIds = (
      await listDeviceFeatures(MATAMOROS_BBOX, { includePrivate: true })
    ).features.map((f) => f.properties.id);
    expect(panelIds.sort()).toEqual(["dev_a1", "dev_b1"]);
    expect(await getDeviceDetail("dev_a1")).toBeNull();
    // The owner still sees it.
    expect((await getFleet("org_a", now)).map((d) => d.id)).toEqual(["dev_a1"]);
  });

  test("a rotated key rejects the old one and accepts the new one", async () => {
    const request = (key: string) =>
      new Request("http://localhost/api/v1/readings", {
        headers: { authorization: `Bearer ${key}` },
      });
    const { key } = await rotateDeviceKey(actorA, "dev_a1");
    await expect(
      authenticateDevice(request(keys.dev_a1 as string)),
    ).rejects.toMatchObject({ code: "INVALID_KEY" });
    expect((await authenticateDevice(request(key))).id).toBe("dev_a1");
    await expect(rotateDeviceKey(actorA, "dev_b1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("magic links", () => {
  test("a link works once", async () => {
    const link = await sendLoginLink({
      id: "usr_a",
      email: "a@a.example",
      name: "Ana",
    });
    const token = link.split("/").at(-1) as string;
    expect(await inspectLoginToken(token)).toBe("valid");
    expect(await consumeLoginToken(token)).toBe("usr_a");
    expect(await consumeLoginToken(token)).toBeNull();
    expect(await inspectLoginToken(token)).toBe("used");
  });

  test("an expired link is rejected", async () => {
    const link = await sendLoginLink(
      { id: "usr_a", email: "a@a.example", name: "Ana" },
      ago(16 * 60_000),
    );
    const token = link.split("/").at(-1) as string;
    expect(await consumeLoginToken(token)).toBeNull();
    expect(await inspectLoginToken(token)).toBe("expired");
  });
});
