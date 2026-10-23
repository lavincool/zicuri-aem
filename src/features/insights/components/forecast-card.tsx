"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PanelData } from "../server/panel-data";
import { RainGauge } from "./mini-charts";

const STALE_FORECAST_MS = 6 * 3_600_000;
const SOURCES = ["openMeteo", "smn"] as const;
type Source = (typeof SOURCES)[number];

const STATUS_STYLES = {
  scenario: "bg-primary text-primary-foreground",
  fresh: "bg-success/12 text-success",
  stale: "bg-destructive/12 text-destructive",
  none: "bg-muted text-muted-foreground",
} as const;

/** Rain outlook with a rain gauge; arrows switch between Open-Meteo and SMN. */
export function ForecastCard({ data, now }: { data: PanelData; now: Date }) {
  const t = useTranslations("panel.forecast");
  const format = useFormatter();
  const [source, setSource] = useState<Source>("openMeteo");
  const snapshot = data.forecast[source];
  const summary = snapshot?.summary;
  const fetchedAt = snapshot ? new Date(snapshot.fetchedAt) : null;
  const status: keyof typeof STATUS_STYLES = !fetchedAt
    ? "none"
    : source === "openMeteo" && data.scenario
      ? "scenario"
      : now.getTime() - fetchedAt.getTime() > STALE_FORECAST_MS
        ? "stale"
        : "fresh";
  const cycle = (step: 1 | -1) =>
    setSource(
      (current) =>
        SOURCES[
          (SOURCES.indexOf(current) + step + SOURCES.length) % SOURCES.length
        ] ?? "openMeteo",
    );

  const rows: { label: string; value: string }[] = [];
  if (summary && source === "openMeteo") {
    rows.push({
      label: t("labels.next24"),
      value: t("mm", { mm: summary.next24hMm }),
    });
    if (summary.maxProbPct !== null) {
      rows.push({
        label: t("labels.probability"),
        value: t("percent", { percent: summary.maxProbPct }),
      });
    }
    if (summary.peakAt) {
      rows.push({
        label: t("labels.peak"),
        value: format.dateTime(new Date(summary.peakAt), {
          weekday: "long",
          hour: "numeric",
        }),
      });
    }
  }
  if (summary && source === "smn") {
    for (const day of (summary.days ?? []).slice(0, 3)) {
      rows.push({
        label: format.dateTime(new Date(`${day.date}T12:00:00`), {
          weekday: "short",
          day: "numeric",
        }),
        value: t("dayValue", { mm: day.precipMm, percent: day.probPct }),
      });
    }
  }
  if (fetchedAt) {
    rows.push({
      label: t("labels.updated"),
      value: format.relativeTime(fetchedAt, now),
    });
  }

  return (
    <article
      aria-label={t("title")}
      className="flex h-full flex-col gap-4 rounded-3xl bg-card p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-muted px-3 py-1.5 font-display text-lg font-medium sm:text-xl">
            {t(`sources.${source}`)}
          </span>
          <span
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-bold sm:text-base",
              STATUS_STYLES[status],
            )}
          >
            {t(`status.${status}`)}
          </span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => cycle(-1)}
            aria-label={t("previous")}
            className="flex size-10 items-center justify-center rounded-xl bg-muted transition-colors hover:bg-foreground/10"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => cycle(1)}
            aria-label={t("next")}
            className="flex size-10 items-center justify-center rounded-xl bg-muted transition-colors hover:bg-foreground/10"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </header>

      <p className="-mt-1 text-sm text-muted-foreground" aria-live="polite">
        {t(`scopes.${source}`)}
      </p>

      {summary ? (
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <dl className="space-y-2.5 self-start">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
              >
                <dt className="text-muted-foreground">{row.label}:</dt>
                <dd className="rounded-lg bg-muted px-2.5 py-1 font-semibold tabular-nums">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col items-end gap-1">
            <p className="font-display text-5xl font-light tracking-tight tabular-nums">
              {Math.round(summary.next48hMm)}
              <span className="ml-1 text-xl text-muted-foreground">mm</span>
            </p>
            <p className="text-right text-sm text-muted-foreground">
              {summary.next48hMm >= 1 ? t("in48") : t("noRain")}
            </p>
            <RainGauge mm={summary.next48hMm} className="mt-2 h-36" />
          </div>
        </div>
      ) : (
        <p className="flex-1 text-muted-foreground">{t("unavailable")}</p>
      )}

      {status === "stale" ? (
        <p className="text-xs font-semibold text-destructive">{t("stale")}</p>
      ) : null}
    </article>
  );
}
