import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  EyeOff,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CATEGORY_COLORS } from "@/config/categories";
import {
  DEVICE_SITE_TYPES,
  DEVICE_STATUSES,
  DEVICE_VISIBILITIES,
} from "@/config/devices";
import { LevelChart } from "@/features/devices/components/level-chart";
import { signalQuality } from "@/features/devices/rules";
import {
  OPERATOR_READING_RANGES,
  type ReadingRange,
} from "@/features/devices/schema";
import { topReasons } from "@/features/insights/components/reasons";
import { RISK_COLORS } from "@/features/map/lib/risk-layers";
import { CategoryIcon } from "@/features/reports/components/category-icon";
import { cn } from "@/lib/utils";
import { can } from "../rules";
import type { FleetDeviceDetail } from "../server/fleet";
import type { Operator } from "../server/session";
import { IssueText, StateBadge, useDuration, VisibilityBadge } from "./badges";
import { DeviceEditForm } from "./device-edit-form";
import { EventList } from "./event-list";
import { KeyRotation } from "./key-rotation";

const HISTORY_FIELDS = [
  "name",
  "siteType",
  "status",
  "visibility",
  "lat",
  "lng",
  "mountHeightCm",
  "warningCm",
  "criticalCm",
  "reportingIntervalS",
  "apiKeyPrefix",
] as const;

function isOneOf<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}

export function DeviceDetailView({
  detail,
  range,
  operator,
  now,
}: {
  detail: FleetDeviceDetail;
  range: ReadingRange;
  operator: Operator;
  now: Date;
}) {
  const t = useTranslations("operator.detail");
  const ts = useTranslations("sensors.sites");
  const tr = useTranslations("operator.edit");
  const { device, summary } = detail;
  const canEdit = can(operator.role, "edit_device");

  return (
    <div className="space-y-6">
      <Link
        href="/operador/sensores"
        className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge level={summary.level} status={summary.status} />
          <VisibilityBadge visibility={summary.visibility} />
          <span className="text-sm text-muted-foreground">
            {ts(device.siteType)}
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-extrabold break-words">
            {device.name}
          </h1>
          <div className="sm:text-right">
            <p className="text-sm text-muted-foreground">{t("current")}</p>
            <p className="font-display text-5xl font-extrabold tabular-nums">
              {device.lastLevelCm !== null
                ? `${device.lastLevelCm.toFixed(1)} cm`
                : "—"}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("thresholds", {
            warning: device.warningCm,
            critical: device.criticalCm,
          })}
        </p>
        <StatusNotes detail={detail} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
            <RangeTabs deviceId={device.id} range={range} />
            {detail.series ? (
              <LevelChart series={detail.series} now={now.getTime()} />
            ) : null}
          </section>
          <HealthSection detail={detail} now={now} />
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold">{t("events.title")}</h2>
            {detail.events.length ? (
              <EventList events={detail.events} now={now} />
            ) : (
              <p className="rounded-2xl bg-card p-4 text-muted-foreground ring-1 ring-foreground/10">
                {t("events.empty")}
              </p>
            )}
            <Link
              href={`/operador/eventos?sensor=${device.id}`}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {t("events.viewAll")}
              <ArrowRight className="size-4" />
            </Link>
          </section>
          <ContextSection detail={detail} />
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
            <h2 className="text-xl font-extrabold">{tr("title")}</h2>
            {canEdit ? (
              <DeviceEditForm
                device={{
                  id: device.id,
                  name: device.name,
                  siteType: device.siteType,
                  status: device.status,
                  visibility: device.visibility,
                  lat: device.lat,
                  lng: device.lng,
                  mountHeightCm: device.mountHeightCm,
                  warningCm: device.warningCm,
                  criticalCm: device.criticalCm,
                  reportingIntervalS: device.reportingIntervalS,
                  lastLevelCm: device.lastLevelCm,
                }}
              />
            ) : (
              <p className="text-muted-foreground">{tr("readOnly")}</p>
            )}
          </section>
          {can(operator.role, "rotate_key") ? (
            <KeyRotation deviceId={device.id} prefix={device.apiKeyPrefix} />
          ) : null}
          <HistorySection detail={detail} now={now} />
        </div>
      </div>
    </div>
  );
}

function StatusNotes({ detail }: { detail: FleetDeviceDetail }) {
  const t = useTranslations("operator.detail");
  const { device } = detail;
  const notes: { icon: ReactNode; text: string }[] = [];
  if (device.status === "maintenance") {
    notes.push({
      icon: <Wrench className="size-4" />,
      text: t("maintenanceNote"),
    });
  }
  if (device.status === "retired") {
    notes.push({ icon: <Wrench className="size-4" />, text: t("retiredNote") });
  }
  if (device.visibility === "private") {
    notes.push({ icon: <EyeOff className="size-4" />, text: t("privateNote") });
  }
  return (
    <>
      {notes.map((note) => (
        <p
          key={note.text}
          className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold [&>svg]:mt-0.5 [&>svg]:shrink-0"
        >
          {note.icon}
          {note.text}
        </p>
      ))}
      {device.visibility === "public" && device.status !== "retired" ? (
        <Link
          href={`/s/${device.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("publicLink")}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </>
  );
}

function RangeTabs({
  deviceId,
  range,
}: {
  deviceId: string;
  range: ReadingRange;
}) {
  const t = useTranslations("operator.detail");
  return (
    <nav
      aria-label={t("rangeLabel")}
      className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1"
    >
      {OPERATOR_READING_RANGES.map((option) => (
        <Link
          key={option}
          href={`/operador/sensores/${deviceId}?rango=${option}`}
          replace
          scroll={false}
          aria-current={range === option ? "page" : undefined}
          className={cn(
            "flex h-10 items-center justify-center rounded-full text-sm font-bold transition-colors hover:bg-card/60",
            range === option && "bg-card shadow-sm hover:bg-card",
          )}
        >
          {t(`ranges.${option}`)}
        </Link>
      ))}
    </nav>
  );
}

function HealthSection({
  detail,
  now,
}: {
  detail: FleetDeviceDetail;
  now: Date;
}) {
  const t = useTranslations("operator.detail.health");
  const tq = useTranslations("operator.sensors.signalQuality");
  const duration = useDuration();
  const { device, summary, health } = detail;
  const rows: { label: string; value: string }[] = [
    {
      label: t("availability"),
      value:
        health.availability7dPct !== null
          ? `${t("availabilityValue", { percent: health.availability7dPct })} · ${t("readings", { count: health.readings7d })}`
          : t("noData"),
    },
    {
      label: t("battery"),
      value:
        device.lastBatteryPct !== null
          ? `${device.lastBatteryPct} %${health.battery7dAgoPct !== null ? ` · ${t("batteryTrend", { from: health.battery7dAgoPct })}` : ""}`
          : t("noData"),
    },
    {
      label: t("signal"),
      value:
        device.lastRssiDbm !== null
          ? t("signalValue", {
              dbm: device.lastRssiDbm,
              quality: tq(signalQuality(device.lastRssiDbm)),
            })
          : t("noData"),
    },
    {
      label: t("longestGap"),
      value:
        health.longestGapMs !== null
          ? duration(health.longestGapMs)
          : t("noData"),
    },
    {
      label: t("interval"),
      value: t("intervalValue", {
        minutes: Math.round(device.reportingIntervalS / 60),
      }),
    },
    { label: t("firmware"), value: device.firmware ?? t("noData") },
  ];
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <h2 className="text-xl font-extrabold">{t("title")}</h2>
      {summary.issues.length ? (
        <ul className="space-y-1.5">
          {summary.issues.map((issue) => (
            <li
              key={issue.kind}
              className="flex items-start gap-2 font-semibold"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>
                <IssueText issue={issue} now={now} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 font-semibold">
          <CircleCheck className="size-5 text-success" />
          {t("allGood")}
        </p>
      )}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ContextSection({ detail }: { detail: FleetDeviceDetail }) {
  const t = useTranslations("operator.detail.context");
  const tp = useTranslations("panel");
  const tc = useTranslations("categories");
  const format = useFormatter();
  const { nearby, risk } = detail;
  return (
    <section className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <h2 className="text-xl font-extrabold">{t("title")}</h2>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("risk")}
        </p>
        {risk ? (
          <>
            <span
              className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white"
              style={{ backgroundColor: RISK_COLORS[risk.level] }}
            >
              {t("riskValue", {
                level: tp(`levels.${risk.level}`),
                score: risk.score,
              })}
            </span>
            <ul className="space-y-0.5 text-sm">
              {topReasons(tp, risk.factors).map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm">{t("noRisk")}</p>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-semibold">{t("reports", { count: nearby.total })}</p>
        {nearby.reports.length ? (
          <ul className="space-y-2">
            {nearby.reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/r/${report.id}`}
                  className="flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-muted"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{
                      backgroundColor: CATEGORY_COLORS[report.category],
                    }}
                  >
                    <CategoryIcon
                      category={report.category}
                      className="size-4"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-semibold">{tc(report.category)}</span>
                    {" · "}
                    {format.dateTime(report.createdAt, {
                      day: "numeric",
                      month: "short",
                    })}
                    {report.colonia ? ` · ${report.colonia}` : null}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function HistorySection({
  detail,
  now,
}: {
  detail: FleetDeviceDetail;
  now: Date;
}) {
  const t = useTranslations("operator.detail.history");
  const to = useTranslations("operator");
  const ts = useTranslations("sensors.sites");
  const format = useFormatter();
  const value = (field: string, raw: unknown) => {
    if (raw === null || raw === undefined || raw === "")
      return t("empty_value");
    const text = String(raw);
    if (field === "status" && isOneOf(DEVICE_STATUSES, text)) {
      return to(`status.${text}`);
    }
    if (field === "visibility" && isOneOf(DEVICE_VISIBILITIES, text)) {
      return to(`visibility.${text}`);
    }
    if (field === "siteType" && isOneOf(DEVICE_SITE_TYPES, text)) {
      return ts(text);
    }
    if (field === "apiKeyPrefix") return `${text}…`;
    return text;
  };
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <h2 className="text-xl font-extrabold">{t("title")}</h2>
      {detail.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="space-y-3">
          {detail.history.map((entry) => (
            <li key={entry.id} className="space-y-1 border-l-2 pl-3">
              <p className="font-semibold">{t(`actions.${entry.action}`)}</p>
              <ul className="space-y-0.5 text-sm">
                {Object.entries(entry.changes).map(([field, change]) => (
                  <li key={field} className="break-words">
                    {t("change", {
                      field: isOneOf(HISTORY_FIELDS, field)
                        ? t(`fields.${field}`)
                        : field,
                      from: value(field, change.from),
                      to: value(field, change.to),
                    })}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t("by", {
                  actor: entry.actor ?? t("system"),
                  time: format.relativeTime(entry.createdAt, now),
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
