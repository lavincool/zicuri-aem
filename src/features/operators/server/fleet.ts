import "server-only";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { gridDisk } from "h3-js";
import type { ReportCategory } from "@/config/categories";
import type {
  DeviceLevel,
  DeviceSiteType,
  DeviceStatus,
  DeviceVisibility,
} from "@/config/devices";
import type { AuditAction } from "@/config/operators";
import {
  availabilityPct,
  FLAT_LINE,
  type HealthIssue,
  type HealthStats,
  healthIssues,
  isSpike,
  MIN_SPIKE_CM,
  SPIKE_WINDOW_MS,
  spikeThresholdCm,
} from "@/features/devices/health";
import { deviceLevel } from "@/features/devices/rules";
import type {
  DeviceFeatureCollection,
  ReadingRange,
  ReadingSeries,
} from "@/features/devices/schema";
import {
  getReadingSeries,
  toDeviceFeatures,
} from "@/features/devices/server/queries";
import type { RiskFactor, RiskLevel } from "@/features/insights/risk/model";
import { latestSnapshots } from "@/features/insights/server/refresh";
import { latestRunId, scoresForRun } from "@/features/insights/server/risk";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  type Device,
  deviceAlerts,
  devices,
  reports,
  sensorReadings,
  users,
} from "@/lib/db/schema";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Alert and offline episodes shown in the portal. */
export const EVENTS_WINDOW_MS = 30 * DAY_MS;
const MAX_EVENTS = 300;

export type FleetDevice = {
  id: string;
  name: string;
  siteType: DeviceSiteType;
  status: DeviceStatus;
  visibility: DeviceVisibility;
  level: DeviceLevel;
  lastLevelCm: number | null;
  lastSeenAt: Date | null;
  lastBatteryPct: number | null;
  lastRssiDbm: number | null;
  firmware: string | null;
  reportingIntervalS: number;
  issues: HealthIssue[];
};

const LEVEL_ORDER: Record<DeviceLevel, number> = {
  critical: 0,
  warning: 1,
  offline: 2,
  normal: 3,
};

function toFleetDevice(
  device: Device,
  stats: HealthStats | null,
  now: Date,
): FleetDevice {
  return {
    id: device.id,
    name: device.name,
    siteType: device.siteType,
    status: device.status,
    visibility: device.visibility,
    level: deviceLevel(device, now),
    lastLevelCm: device.lastLevelCm,
    lastSeenAt: device.lastSeenAt,
    lastBatteryPct: device.lastBatteryPct,
    lastRssiDbm: device.lastRssiDbm,
    firmware: device.firmware,
    reportingIntervalS: device.reportingIntervalS,
    issues: healthIssues(device, stats, now),
  };
}

/** Sensors needing attention first, then by level, then by name; retired last. */
function compareFleet(a: FleetDevice, b: FleetDevice): number {
  const retired =
    Number(a.status === "retired") - Number(b.status === "retired");
  if (retired) return retired;
  const attention = Number(b.issues.length > 0) - Number(a.issues.length > 0);
  if (attention) return attention;
  const level = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
  return level || a.name.localeCompare(b.name, "es");
}

/** Flat-line stats and spike counts for many devices in two queries. */
async function healthStats(
  rows: Device[],
  now: Date,
): Promise<Map<string, HealthStats>> {
  const live = rows.filter((d) => d.status !== "retired");
  const ids = live.map((d) => d.id);
  const stats = new Map<string, HealthStats>();
  if (ids.length === 0) return stats;

  const aggregates = await db()
    .select({
      deviceId: sensorReadings.deviceId,
      readings: count(),
      minCm: sql<number | null>`min(${sensorReadings.levelCm})`,
      maxCm: sql<number | null>`max(${sensorReadings.levelCm})`,
      firstAt: sql<number | null>`min(${sensorReadings.measuredAt})`,
    })
    .from(sensorReadings)
    .where(
      and(
        inArray(sensorReadings.deviceId, ids),
        gte(
          sensorReadings.measuredAt,
          new Date(now.getTime() - FLAT_LINE.windowMs),
        ),
      ),
    )
    .groupBy(sensorReadings.deviceId);

  // Readings that jump away from a neighbor; `isSpike` decides per device.
  const candidates = await db().all<{
    device_id: string;
    prev: number;
    level: number;
    next: number;
  }>(sql`
    select device_id, prev, level, next from (
      select device_id, level_cm as level,
        lag(level_cm) over w as prev,
        lead(level_cm) over w as next
      from sensor_readings
      where device_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
        and measured_at >= ${now.getTime() - SPIKE_WINDOW_MS}
      window w as (partition by device_id order by measured_at)
    )
    where prev is not null and next is not null
      and abs(level - prev) >= ${MIN_SPIKE_CM}
  `);
  const critical = new Map(live.map((d) => [d.id, d.criticalCm]));
  const spikes = new Map<string, number>();
  for (const row of candidates) {
    const threshold = spikeThresholdCm(critical.get(row.device_id) ?? 0);
    if (isSpike(row.prev, row.level, row.next, threshold)) {
      spikes.set(row.device_id, (spikes.get(row.device_id) ?? 0) + 1);
    }
  }

  for (const id of ids) {
    const aggregate = aggregates.find((a) => a.deviceId === id);
    stats.set(id, {
      readings: aggregate?.readings ?? 0,
      minCm: aggregate?.minCm ?? null,
      maxCm: aggregate?.maxCm ?? null,
      firstAt: aggregate?.firstAt ? new Date(aggregate.firstAt) : null,
      spikes: spikes.get(id) ?? 0,
    });
  }
  return stats;
}

async function orgDevices(orgId: string): Promise<Device[]> {
  return db().select().from(devices).where(eq(devices.orgId, orgId));
}

export async function getFleet(
  orgId: string,
  now = new Date(),
): Promise<FleetDevice[]> {
  const rows = await orgDevices(orgId);
  const stats = await healthStats(rows, now);
  return rows
    .map((d) => toFleetDevice(d, stats.get(d.id) ?? null, now))
    .sort(compareFleet);
}

export type FleetOverview = {
  fleet: FleetDevice[];
  /** All non-retired sensors of the organization, private ones included. */
  features: DeviceFeatureCollection;
  events7d: number;
  forecast: Awaited<ReturnType<typeof latestSnapshots>>;
};

export async function getFleetOverview(
  orgId: string,
  now = new Date(),
): Promise<FleetOverview> {
  const rows = await orgDevices(orgId);
  const live = rows.filter((d) => d.status !== "retired");
  const [stats, forecast, [events]] = await Promise.all([
    healthStats(rows, now),
    latestSnapshots(),
    live.length
      ? db()
          .select({ total: count() })
          .from(deviceAlerts)
          .where(
            and(
              inArray(
                deviceAlerts.deviceId,
                live.map((d) => d.id),
              ),
              inArray(deviceAlerts.level, ["warning", "critical"]),
              gte(deviceAlerts.startedAt, new Date(now.getTime() - 7 * DAY_MS)),
            ),
          )
      : Promise.resolve([{ total: 0 }]),
  ]);
  return {
    fleet: rows
      .map((d) => toFleetDevice(d, stats.get(d.id) ?? null, now))
      .sort(compareFleet),
    features: toDeviceFeatures(live, now),
    events7d: events?.total ?? 0,
    forecast,
  };
}

export type FleetEvent = {
  id: string;
  deviceId: string;
  deviceName: string;
  level: "warning" | "critical" | "offline";
  startedAt: Date;
  endedAt: Date | null;
  peakCm: number | null;
};

/**
 * Warning and critical periods (from `device_alerts`) plus offline periods derived
 * from silence: gaps longer than the offline rule between consecutive readings, and
 * the current silence of sensors that stopped reporting.
 */
export async function getFleetEvents(
  orgId: string,
  filters: { deviceId?: string; level?: FleetEvent["level"] } = {},
  now = new Date(),
): Promise<FleetEvent[]> {
  const since = new Date(now.getTime() - EVENTS_WINDOW_MS);
  const rows = (await orgDevices(orgId)).filter(
    (d) => !filters.deviceId || d.id === filters.deviceId,
  );
  if (rows.length === 0) return [];
  const ids = rows.map((d) => d.id);
  const names = new Map(rows.map((d) => [d.id, d.name]));
  const events: FleetEvent[] = [];

  if (filters.level !== "offline") {
    // Qualified names: the correlated subquery must compare against the outer alert row.
    const peak = sql<number | null>`(
      select max(r.level_cm) from sensor_readings r
      where r.device_id = "device_alerts"."device_id"
        and r.measured_at >= "device_alerts"."started_at"
        and r.measured_at <= coalesce("device_alerts"."ended_at", ${now.getTime()})
    )`;
    const alerts = await db()
      .select({
        id: deviceAlerts.id,
        deviceId: deviceAlerts.deviceId,
        level: deviceAlerts.level,
        startedAt: deviceAlerts.startedAt,
        endedAt: deviceAlerts.endedAt,
        levelCm: deviceAlerts.levelCm,
        peakCm: peak,
      })
      .from(deviceAlerts)
      .where(
        and(
          inArray(deviceAlerts.deviceId, ids),
          filters.level
            ? eq(deviceAlerts.level, filters.level)
            : inArray(deviceAlerts.level, ["warning", "critical"]),
          or(isNull(deviceAlerts.endedAt), gt(deviceAlerts.endedAt, since)),
        ),
      )
      .orderBy(desc(deviceAlerts.startedAt))
      .limit(MAX_EVENTS);
    for (const alert of alerts) {
      if (alert.level !== "warning" && alert.level !== "critical") continue;
      events.push({
        id: alert.id,
        deviceId: alert.deviceId,
        deviceName: names.get(alert.deviceId) ?? "",
        level: alert.level,
        startedAt: alert.startedAt,
        endedAt: alert.endedAt,
        peakCm: alert.peakCm ?? alert.levelCm,
      });
    }
  }

  if (!filters.level || filters.level === "offline") {
    const gaps = await db().all<{
      device_id: string;
      prev_at: number;
      measured_at: number;
    }>(sql`
      select device_id, prev_at, measured_at from (
        select r.device_id, r.measured_at,
          lag(r.measured_at) over (partition by r.device_id order by r.measured_at) as prev_at,
          d.reporting_interval_s as interval_s
        from sensor_readings r
        join devices d on d.id = r.device_id
        where r.device_id in (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})
          and r.measured_at >= ${since.getTime()}
      )
      where prev_at is not null and measured_at - prev_at > 3 * interval_s * 1000
      order by measured_at desc
      limit ${MAX_EVENTS}
    `);
    for (const gap of gaps) {
      events.push({
        id: `gap_${gap.device_id}_${gap.prev_at}`,
        deviceId: gap.device_id,
        deviceName: names.get(gap.device_id) ?? "",
        level: "offline",
        startedAt: new Date(gap.prev_at),
        endedAt: new Date(gap.measured_at),
        peakCm: null,
      });
    }
    for (const device of rows) {
      const silent =
        (device.status === "active" || device.status === "pending") &&
        deviceLevel(device, now) === "offline" &&
        device.lastSeenAt;
      if (silent && device.lastSeenAt) {
        events.push({
          id: `silent_${device.id}`,
          deviceId: device.id,
          deviceName: device.name,
          level: "offline",
          startedAt: device.lastMeasuredAt ?? device.lastSeenAt,
          endedAt: null,
          peakCm: null,
        });
      }
    }
  }

  return events
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, MAX_EVENTS);
}

export type DeviceHistoryEntry = {
  id: string;
  action: AuditAction;
  changes: Record<string, { from: unknown; to: unknown }>;
  actor: string | null;
  createdAt: Date;
};

export type NearbyReport = {
  id: string;
  category: ReportCategory;
  createdAt: Date;
  colonia: string | null;
};

export type FleetDeviceDetail = {
  device: Device;
  summary: FleetDevice;
  series: ReadingSeries | null;
  events: FleetEvent[];
  health: {
    availability7dPct: number | null;
    readings7d: number;
    battery7dAgoPct: number | null;
    longestGapMs: number | null;
  };
  nearby: { reports: NearbyReport[]; total: number };
  risk: { level: RiskLevel; score: number; factors: RiskFactor[] } | null;
  history: DeviceHistoryEntry[];
};

/** One device of the organization, or null (another org's device is "not found"). */
export async function getFleetDeviceDetail(
  orgId: string,
  deviceId: string,
  range: ReadingRange,
  now = new Date(),
): Promise<FleetDeviceDetail | null> {
  const [device] = await db()
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.orgId, orgId)))
    .limit(1);
  if (!device) return null;
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const cells = device.h3r9 ? gridDisk(device.h3r9, 1) : [];

  const [
    stats,
    series,
    events,
    week,
    firstBattery,
    gap,
    nearby,
    risk,
    history,
  ] = await Promise.all([
    healthStats([device], now),
    getReadingSeries(device.id, range, { includePrivate: true, now }),
    getFleetEvents(orgId, { deviceId: device.id }, now),
    db()
      .select({
        total: count(),
        firstAt: sql<number | null>`min(${sensorReadings.measuredAt})`,
      })
      .from(sensorReadings)
      .where(
        and(
          eq(sensorReadings.deviceId, device.id),
          gte(sensorReadings.measuredAt, weekAgo),
        ),
      ),
    db()
      .select({ batteryPct: sensorReadings.batteryPct })
      .from(sensorReadings)
      .where(
        and(
          eq(sensorReadings.deviceId, device.id),
          gte(sensorReadings.measuredAt, weekAgo),
          sql`${sensorReadings.batteryPct} is not null`,
        ),
      )
      .orderBy(sensorReadings.measuredAt)
      .limit(1),
    db().all<{ gap: number | null }>(sql`
        select max(measured_at - prev_at) as gap from (
          select measured_at, lag(measured_at) over (order by measured_at) as prev_at
          from sensor_readings
          where device_id = ${device.id} and measured_at >= ${weekAgo.getTime()}
        )
      `),
    cells.length
      ? db()
          .select({
            id: reports.id,
            category: reports.category,
            createdAt: reports.createdAt,
            colonia: reports.colonia,
          })
          .from(reports)
          .where(
            and(
              inArray(reports.h3r9, cells),
              eq(reports.status, "open"),
              or(isNull(reports.expiresAt), gt(reports.expiresAt, now)),
            ),
          )
          .orderBy(desc(reports.createdAt))
      : Promise.resolve([]),
    device.h3r8
      ? latestRunId().then((runId) =>
          runId && device.h3r8
            ? scoresForRun(runId, [device.h3r8])
            : Promise.resolve([]),
        )
      : Promise.resolve([]),
    db()
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        changes: auditEvents.changes,
        name: users.name,
        email: users.email,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.userId))
      .where(
        and(
          eq(auditEvents.orgId, orgId),
          eq(auditEvents.entity, "device"),
          eq(auditEvents.entityId, device.id),
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(20),
  ]);

  const cell = risk[0];
  return {
    device,
    summary: toFleetDevice(device, stats.get(device.id) ?? null, now),
    series,
    events: events.slice(0, 20),
    health: {
      availability7dPct: week[0]?.firstAt
        ? availabilityPct(
            week[0].total,
            now.getTime() - week[0].firstAt,
            device.reportingIntervalS,
          )
        : null,
      readings7d: week[0]?.total ?? 0,
      battery7dAgoPct: firstBattery[0]?.batteryPct ?? null,
      longestGapMs: gap[0]?.gap ?? null,
    },
    nearby: { reports: nearby.slice(0, 5), total: nearby.length },
    risk: cell
      ? { level: cell.level, score: cell.score, factors: cell.factors }
      : null,
    history: history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      changes: entry.changes ?? {},
      actor: entry.name ?? entry.email,
      createdAt: entry.createdAt,
    })),
  };
}
