"use client";

import {
  CloudRain,
  ExternalLink,
  FlaskConical,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Timer,
  TriangleAlert,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS } from "@/config/categories";
import { PILOT } from "@/config/pilot";
import { FloodMap, type MapView } from "@/features/map/components/flood-map";
import { useSensorsFeed } from "@/features/map/hooks/use-sensors-feed";
import { RISK_COLORS } from "@/features/map/lib/risk-layers";
import { CategoryIcon } from "@/features/reports/components/category-icon";
import { useLiveNow } from "@/hooks/use-live-now";
import { RISK_MODEL_VERSION, type RiskFactor } from "../risk/model";
import { refreshForecastAction, runScenarioAction } from "../server/actions";
import type { PanelData, RiskCell } from "../server/panel-data";
import { reasonText, topReasons } from "./reasons";

const STALE_FORECAST_MS = 6 * 3_600_000;
const noopSubscribe = () => () => {};
const EMPTY_REPORTS = {
  type: "FeatureCollection" as const,
  truncated: false,
  features: [],
};

export function PanelDashboard({
  data,
  demoMode,
}: {
  data: PanelData;
  demoMode: boolean;
}) {
  const t = useTranslations("panel");
  const format = useFormatter();
  const now = useLiveNow(60_000, data.renderedAt);
  const [pending, startTransition] = useTransition();
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const cell = data.cells.find((c) => c.h3r8 === selectedCell) ?? null;

  const refresh = () =>
    startTransition(async () => {
      const result = await refreshForecastAction();
      if (result.ok) toast.success(t("refreshed"));
      else toast.error(t("refreshFailed"));
    });
  const scenario = () =>
    startTransition(async () => {
      await runScenarioAction();
      toast.success(t("scenario.ran"));
    });

  const baseline = data.cells.every((c) => c.baseline);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
          <p className="text-sm text-muted-foreground">
            {data.computedAt
              ? t("updated", {
                  time: format.relativeTime(new Date(data.computedAt), now),
                })
              : t("notComputed")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {demoMode ? (
            data.scenario ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={refresh}
                className="h-11 rounded-full px-4 font-semibold"
              >
                <CloudRain className="size-4" />
                {t("scenario.real")}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={scenario}
                className="h-11 rounded-full px-4 font-semibold"
              >
                <FlaskConical className="size-4" />
                {t("scenario.run")}
              </Button>
            )
          ) : null}
          <Button
            disabled={pending}
            onClick={refresh}
            className="h-11 rounded-full px-4 font-bold"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {pending ? t("refreshing") : t("refresh")}
          </Button>
        </div>
      </header>

      {data.scenario ? (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-warning bg-warning/10 px-4 py-3 font-semibold">
          <FlaskConical className="mt-0.5 size-5 shrink-0" />
          {t("scenario.banner")}
        </p>
      ) : null}

      <ForecastStrip data={data} now={now} />
      <KpiTiles data={data} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <DrainsList
          data={data}
          baseline={baseline}
          onSelectCell={setSelectedCell}
        />
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-extrabold">{t("map.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("map.hint")}</p>
          </div>
          <div className="relative h-[28rem] overflow-hidden rounded-2xl ring-1 ring-foreground/10 lg:h-[36rem]">
            <RiskMap
              cells={data.cells}
              selected={selectedCell}
              onSelect={setSelectedCell}
            />
            {cell ? (
              <CellDetail cell={cell} onClose={() => setSelectedCell(null)} />
            ) : null}
          </div>
          <RiskLegend />
        </section>
      </div>
    </div>
  );
}

function ForecastStrip({ data, now }: { data: PanelData; now: Date }) {
  const t = useTranslations("panel.forecast");
  const format = useFormatter();
  const { openMeteo, smn } = data.forecast;
  const stale = (fetchedAt: Date | undefined) =>
    !fetchedAt ||
    now.getTime() - new Date(fetchedAt).getTime() > STALE_FORECAST_MS;

  return (
    <section aria-label={t("title")} className="grid gap-4 md:grid-cols-2">
      <article className="space-y-2 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("openMeteo")}
        </p>
        {openMeteo ? (
          <>
            <p className="flex items-center gap-2 font-display text-3xl font-extrabold">
              <CloudRain className="size-7 text-water" />
              {openMeteo.summary.next48hMm >= 1
                ? t("upTo", { mm: openMeteo.summary.next48hMm })
                : t("noRain")}
            </p>
            <p className="text-sm">
              {t("next24", { mm: openMeteo.summary.next24hMm })}
              {openMeteo.summary.maxProbPct !== null
                ? ` · ${t("probability", { percent: openMeteo.summary.maxProbPct })}`
                : null}
            </p>
            {openMeteo.summary.peakAt ? (
              <p className="text-sm">
                {t("peak", {
                  time: format.dateTime(new Date(openMeteo.summary.peakAt), {
                    weekday: "long",
                    hour: "numeric",
                  }),
                })}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("age", {
                time: format.relativeTime(new Date(openMeteo.fetchedAt), now),
              })}
            </p>
            {stale(openMeteo.fetchedAt) && !data.scenario ? (
              <p className="text-xs font-semibold text-warning">{t("stale")}</p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">{t("unavailable")}</p>
        )}
      </article>

      <article className="space-y-2 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("smn")}
        </p>
        {smn ? (
          <>
            <p className="flex items-center gap-2 font-display text-3xl font-extrabold">
              <CloudRain className="size-7 text-water" />
              {smn.summary.next48hMm >= 1
                ? t("upTo", { mm: smn.summary.next48hMm })
                : t("noRain")}
            </p>
            <ul className="space-y-0.5 text-sm">
              {(smn.summary.days ?? []).slice(0, 3).map((day) => (
                <li key={day.date}>
                  {t("day", {
                    date: format.dateTime(new Date(`${day.date}T12:00:00`), {
                      weekday: "short",
                      day: "numeric",
                    }),
                    mm: day.precipMm,
                    percent: day.probPct,
                  })}{" "}
                  <span className="text-muted-foreground">· {day.sky}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("age", {
                time: format.relativeTime(new Date(smn.fetchedAt), now),
              })}
            </p>
            {stale(smn.fetchedAt) ? (
              <p className="text-xs font-semibold text-warning">{t("stale")}</p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">{t("unavailable")}</p>
        )}
      </article>
    </section>
  );
}

function KpiTiles({ data }: { data: PanelData }) {
  const t = useTranslations("panel.kpis");
  const hours = data.kpis.medianResolutionHours;
  const tiles = [
    {
      icon: TriangleAlert,
      label: t("openBlockages"),
      value: String(data.kpis.openBlockages),
    },
    {
      icon: Waves,
      label: t("newReports"),
      value: String(data.kpis.newReports7d),
    },
    {
      icon: Timer,
      label: t("resolution"),
      value:
        hours === null
          ? t("noData")
          : hours >= 48
            ? t("resolutionDays", { days: Math.round(hours / 24) })
            : t("resolutionValue", { hours: Math.max(1, Math.round(hours)) }),
    },
    {
      icon: Gauge,
      label: t("sensors"),
      value: t("sensorsValue", {
        alert: data.kpis.sensorsInAlert,
        total: data.kpis.sensorsTotal,
      }),
    },
  ];
  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value }) => (
        <article
          key={label}
          className="space-y-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <Icon className="size-5 text-muted-foreground" />
          <p className="font-display text-2xl font-extrabold tabular-nums">
            {value}
          </p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </article>
      ))}
    </section>
  );
}

function LevelBadge({ cell }: { cell: RiskCell }) {
  const t = useTranslations("panel");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white"
      style={{ backgroundColor: RISK_COLORS[cell.level] }}
    >
      {cell.baseline ? `${t("baseline")} · ` : null}
      {t(`levels.${cell.level}`)} · {cell.score}
    </span>
  );
}

function DrainsList({
  data,
  baseline,
  onSelectCell,
}: {
  data: PanelData;
  baseline: boolean;
  onSelectCell: (h3r8: string) => void;
}) {
  const t = useTranslations("panel");
  const tc = useTranslations("categories");
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold">{t("drains.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("drains.body")}</p>
      </div>
      {baseline ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold">
          {t("drains.baselineNote")}
        </p>
      ) : null}
      {data.drains.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-foreground/10">
          {t("drains.empty")}
        </p>
      ) : (
        <ol className="space-y-3">
          {data.drains.map((drain, index) => (
            <li
              key={drain.id}
              className="flex gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10"
            >
              <span className="w-6 shrink-0 pt-1 text-center font-display text-lg font-extrabold text-muted-foreground">
                {index + 1}
              </span>
              {/* biome-ignore lint/performance/noImgElement: report thumbnails come from storage. */}
              <img
                src={drain.thumbUrl}
                alt=""
                className="size-20 shrink-0 rounded-xl object-cover"
                style={{ backgroundColor: drain.photoColor ?? undefined }}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span
                    className="flex size-6 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: CATEGORY_COLORS[drain.category] }}
                  >
                    <CategoryIcon
                      category={drain.category}
                      className="size-3.5"
                    />
                  </span>
                  <span className="font-bold">{tc(drain.category)}</span>
                  {drain.cell ? (
                    <button
                      type="button"
                      onClick={() =>
                        drain.cell && onSelectCell(drain.cell.h3r8)
                      }
                      className="rounded-full"
                    >
                      <LevelBadge cell={drain.cell} />
                    </button>
                  ) : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[drain.address, drain.colonia].filter(Boolean).join(", ") ||
                    "Matamoros"}
                  {" · "}
                  {t("drains.confirmations", { count: drain.stillThereCount })}
                </p>
                {drain.cell ? (
                  <ul className="space-y-0.5 text-sm">
                    {topReasons(t, drain.cell.factors).map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href={`/r/${drain.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {t("drains.view")}
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RiskMap({
  cells,
  selected,
  onSelect,
}: {
  cells: RiskCell[];
  selected: string | null;
  onSelect: (h3r8: string) => void;
}) {
  const t = useTranslations("panel.map");
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  // The map is client-only; match the server render during hydration.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [view, setView] = useState<MapView | null>(null);
  const sensors = useSensorsFeed(view);
  const riskCells = useMemo(
    () => cells.map(({ h3r8, level, score }) => ({ h3r8, level, score })),
    [cells],
  );
  if (!mounted || !resolvedTheme) return null;
  return (
    <FloodMap
      className="absolute inset-0"
      styleUrl={`/map/styles/cauce-${theme}.json`}
      theme={theme}
      initialCenter={PILOT.center}
      initialZoom={12.2}
      minZoom={PILOT.minZoom}
      maxZoom={PILOT.maxZoom}
      reports={EMPTY_REPORTS}
      sensors={sensors}
      riskCells={riskCells}
      selectedRiskCell={selected}
      onRiskCellClick={onSelect}
      onViewChange={setView}
      ariaLabel={t("ariaLabel")}
    />
  );
}

function CellDetail({
  cell,
  onClose,
}: {
  cell: RiskCell;
  onClose: () => void;
}) {
  const t = useTranslations("panel");
  return (
    <aside className="absolute inset-x-3 bottom-3 z-10 max-h-[70%] space-y-3 overflow-y-auto rounded-2xl bg-card p-4 shadow-xl ring-1 ring-foreground/10 sm:inset-x-auto sm:right-3 sm:w-96">
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-lg font-extrabold">
            {cell.colonia
              ? t("cell.title", { colonia: cell.colonia })
              : t("cell.unnamed")}
          </h3>
          <LevelBadge cell={cell} />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("cell.close")}
          className="size-9 rounded-full"
        >
          <X className="size-4" />
        </Button>
      </header>
      <p className="text-sm font-bold">{t("cell.factors")}</p>
      <ul className="space-y-2.5">
        {cell.factors.map((factor) => (
          <FactorRow key={factor.key} factor={factor} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t("cell.model", { version: RISK_MODEL_VERSION })}
      </p>
    </aside>
  );
}

function FactorRow({ factor }: { factor: RiskFactor }) {
  const t = useTranslations("panel");
  const reason = reasonText(t, factor);
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">
          {t(`cell.factorNames.${factor.key}`)}
        </span>
        <span className="tabular-nums text-muted-foreground">
          +{factor.contribution} / {factor.weight}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-water"
          style={{ width: `${(factor.contribution / factor.weight) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {reason ?? t("cell.noValue")}
      </p>
    </li>
  );
}

function RiskLegend() {
  const t = useTranslations("panel.levels");
  return (
    <ul className="flex flex-wrap gap-3 text-sm">
      {(["low", "moderate", "high", "very_high"] as const).map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span
            className="size-3.5 rounded-sm"
            style={{ backgroundColor: RISK_COLORS[level] }}
          />
          {t(level)}
        </li>
      ))}
    </ul>
  );
}
