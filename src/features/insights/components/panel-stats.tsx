"use client";

import { CircleCheck, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CATEGORY_COLORS, REPORT_CATEGORIES } from "@/config/categories";
import { RISK_COLORS } from "@/features/map/lib/risk-layers";
import { CategoryIcon } from "@/features/reports/components/category-icon";
import { cn } from "@/lib/utils";
import { levelShares } from "../activity";
import { RISK_LEVELS } from "../risk/model";
import type { PanelData } from "../server/panel-data";
import { ForecastCard } from "./forecast-card";
import { ArcGauge, SparkBars, SparkLine } from "./mini-charts";

/** Bento overview: forecast, gauges and activity, each group on a tinted tray. */
export function PanelStats({ data, now }: { data: PanelData; now: Date }) {
  return (
    <section className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Tray>
        <ForecastCard data={data} now={now} />
      </Tray>
      <Tray className="grid grid-cols-2 gap-1.5">
        <MaxRiskCard data={data} />
        <SensorsCard data={data} />
        <ResolutionCard data={data} />
        <CategoriesCard data={data} />
      </Tray>
      <Tray className="grid grid-cols-2 gap-1.5 lg:col-span-2 lg:grid-cols-4 2xl:col-span-1 2xl:grid-cols-2">
        <BlockagesCard data={data} />
        <ReportsCard data={data} />
        <ZonesCard data={data} className="col-span-2" />
      </Tray>
    </section>
  );
}

function Tray({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] bg-foreground/[0.045] p-1.5 ring-1 ring-white/60 dark:bg-white/[0.035] dark:ring-white/5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatCard({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-3xl bg-card p-4 sm:p-5",
        className,
      )}
    >
      {/* The aside drops under the title when the card is too narrow for both. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h3 className="font-sans text-sm font-medium text-muted-foreground sm:text-base">
          {title}
        </h3>
        {aside ? (
          <span className="text-xs whitespace-nowrap text-muted-foreground sm:text-sm">
            {aside}
          </span>
        ) : null}
      </header>
      {children}
    </article>
  );
}

function BigNumber({
  value,
  unit,
  className,
}: {
  value: ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-display text-4xl font-light tracking-tight tabular-nums sm:text-5xl",
        className,
      )}
    >
      {value}
      {unit ? (
        <span className="ml-0.5 text-xl text-muted-foreground">{unit}</span>
      ) : null}
    </p>
  );
}

function MaxRiskCard({ data }: { data: PanelData }) {
  const t = useTranslations("panel.stats");
  const top = data.cells[0];
  return (
    <StatCard title={t("maxRisk")} aside={top?.colonia ?? undefined}>
      <BigNumber value={top?.score ?? 0} unit="/100" />
      <ArcGauge
        value={(top?.score ?? 0) / 100}
        color={RISK_COLORS[top?.level ?? "low"]}
        className="mt-auto"
      />
    </StatCard>
  );
}

function SensorsCard({ data }: { data: PanelData }) {
  const t = useTranslations("panel.stats");
  const { sensorsInAlert: alert, sensorsTotal: total } = data.kpis;
  const share = total ? alert / total : 0;
  return (
    <StatCard title={t("sensors")} aside={t("sensorsRatio", { alert, total })}>
      <BigNumber value={Math.round(share * 100)} unit="%" />
      <ArcGauge
        value={share}
        color={alert ? "var(--sensor-critical)" : "var(--sensor-normal)"}
        className="mt-auto"
      />
    </StatCard>
  );
}

function ResolutionCard({ data }: { data: PanelData }) {
  const t = useTranslations("panel.stats");
  const hours = data.kpis.medianResolutionHours;
  const value =
    hours === null
      ? t("noData")
      : hours >= 48
        ? t("days", { days: Math.round(hours / 24) })
        : t("hours", { hours: Math.max(1, Math.round(hours)) });
  return (
    <StatCard title={t("resolution")} aside={t("resolutionWindow")}>
      <p className="font-display text-3xl font-light tracking-tight">{value}</p>
      <div className="mt-auto space-y-1.5 pt-2">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <MapPin className="size-5 shrink-0 fill-foreground text-card" />
          <span className="h-px flex-1 bg-foreground/20" />
          <span className="size-2.5 shrink-0 rounded-full ring-2 ring-muted-foreground/50" />
          <span className="h-px flex-1 bg-foreground/20" />
          <CircleCheck className="size-5 shrink-0 text-success" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground sm:text-sm">
          <span>{t("reported")}</span>
          <span>{t("resolved")}</span>
        </div>
      </div>
    </StatCard>
  );
}

function CategoriesCard({ data }: { data: PanelData }) {
  const t = useTranslations("panel.stats");
  const tc = useTranslations("categories");
  return (
    <StatCard title={t("types")} aside={t("typesWindow")}>
      <ul className="mt-auto grid grid-cols-3 gap-1.5">
        {REPORT_CATEGORIES.map((category) => {
          const count = data.activity.byCategory7d[category];
          return (
            <li
              key={category}
              title={tc(category)}
              className="flex flex-col items-center gap-0.5 rounded-xl py-1.5"
              style={{
                backgroundColor: `color-mix(in oklab, ${CATEGORY_COLORS[category]} 14%, transparent)`,
                color: CATEGORY_COLORS[category],
              }}
            >
              <CategoryIcon category={category} className="size-4" />
              <span className="text-xs font-bold text-foreground tabular-nums">
                <span className="sr-only">{tc(category)}: </span>
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </StatCard>
  );
}

function BlockagesCard({ data }: { data: PanelData }) {
  const t = useTranslations("panel.stats");
  return (
    <StatCard title={t("openBlockages")}>
      <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
        <BigNumber value={data.kpis.openBlockages} />
        <SparkBars
          values={data.activity.blockagesByDay}
          label={t("blockagesTrend")}
          className="mb-1.5"
        />
      </div>
    </StatCard>
  );
}

function ReportsCard({ data }: { data: PanelData }) {
  const t = useTranslations("panel.stats");
  return (
    <StatCard title={t("newReports")}>
      <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
        <BigNumber value={data.kpis.newReports7d} />
        <SparkLine
          values={data.activity.reportsByDay}
          label={t("reportsTrend")}
          className="mb-2 w-14 shrink-0 sm:w-28"
        />
      </div>
    </StatCard>
  );
}

function ZonesCard({
  data,
  className,
}: {
  data: PanelData;
  className?: string;
}) {
  const t = useTranslations("panel");
  const shares = levelShares(data.cells.map((c) => c.level));
  return (
    <StatCard
      title={t("stats.zones")}
      aside={t("stats.zonesCount", { count: data.cells.length })}
      className={className}
    >
      <ul
        className="mt-auto grid gap-2 pt-4"
        style={{
          gridTemplateColumns: RISK_LEVELS.map(
            (level) => `minmax(3.5rem, ${Math.max(shares[level], 4)}fr)`,
          ).join(" "),
        }}
      >
        {RISK_LEVELS.map((level) => (
          <li key={level} className="flex min-w-0 flex-col">
            <span className="font-display text-2xl font-light tabular-nums">
              {shares[level]}%
            </span>
            <span className="ml-px h-5 w-px bg-foreground/25" />
            <span
              className="h-1.5 rounded-full"
              style={{ backgroundColor: RISK_COLORS[level] }}
            />
            <span className="mt-1.5 truncate text-xs text-muted-foreground sm:text-sm">
              {t(`levels.${level}`)}
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}
