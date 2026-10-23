import {
  BatteryMedium,
  ChevronRight,
  Clock,
  Signal,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { signalQuality } from "@/features/devices/rules";
import type { FleetDevice } from "../server/fleet";
import { IssueText, StateBadge, VisibilityBadge } from "./badges";

export function DeviceCard({
  device,
  now,
}: {
  device: FleetDevice;
  now: Date;
}) {
  const t = useTranslations("operator");
  const ts = useTranslations("sensors.sites");
  const format = useFormatter();
  return (
    <Link
      href={`/operador/sensores/${device.id}`}
      className="group flex gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge level={device.level} status={device.status} />
          <VisibilityBadge visibility={device.visibility} />
          <span className="text-sm text-muted-foreground">
            {ts(device.siteType)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 text-lg leading-snug font-extrabold">
            {device.name}
          </h3>
          <p className="shrink-0 font-display text-2xl font-extrabold tabular-nums">
            {device.lastLevelCm !== null
              ? `${device.lastLevelCm.toFixed(1)} cm`
              : "—"}
          </p>
        </div>
        {device.issues.length ? (
          <ul className="space-y-1 text-sm font-semibold">
            {device.issues.map((issue) => (
              <li key={issue.kind} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  <IssueText issue={issue} now={now} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Clock className="size-4" />
            {device.lastSeenAt
              ? t("sensors.lastSeen", {
                  time: format.relativeTime(device.lastSeenAt, now),
                })
              : t("sensors.never")}
          </li>
          {device.lastBatteryPct !== null ? (
            <li className="inline-flex items-center gap-1.5">
              <BatteryMedium className="size-4" />
              {t("sensors.battery", { percent: device.lastBatteryPct })}
            </li>
          ) : null}
          {device.lastRssiDbm !== null ? (
            <li className="inline-flex items-center gap-1.5">
              <Signal className="size-4" />
              {t("sensors.signal", {
                quality: t(
                  `sensors.signalQuality.${signalQuality(device.lastRssiDbm)}`,
                ),
              })}
            </li>
          ) : null}
        </ul>
      </div>
      <ChevronRight className="mt-1 size-5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
