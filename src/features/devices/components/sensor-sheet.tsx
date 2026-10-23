"use client";

import { BatteryMedium, Clock, Signal, WifiOff } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DetailSheet } from "@/components/detail-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVEL_COLORS } from "@/config/devices";
import { useLiveNow } from "@/hooks/use-live-now";
import { cn } from "@/lib/utils";
import { signalQuality } from "../rules";
import {
  type DeviceDetail,
  READING_RANGES,
  type ReadingRange,
  type ReadingSeries,
} from "../schema";
import { LevelChart } from "./level-chart";

const SNAP_POINTS = [0.62, 0.94];
const REFRESH_MS = 5_000;

type State =
  | { kind: "loading" }
  | { kind: "ready"; device: DeviceDetail; series: ReadingSeries | null }
  | { kind: "not_found" }
  | { kind: "error" };

export function SensorSheet({
  sensorId,
  onClose,
}: {
  sensorId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [range, setRange] = useState<ReadingRange | null>(null);
  const [snapPoint, setSnapPoint] = useState<number | string | null>(
    SNAP_POINTS[0] ?? null,
  );

  useEffect(() => {
    if (!sensorId) return;
    setState({ kind: "loading" });
    setRange(null);
    setSnapPoint(SNAP_POINTS[0] ?? null);
  }, [sensorId]);

  // Poll detail + series while open, so a rising level is visible live.
  useEffect(() => {
    if (!sensorId) return;
    let controller = new AbortController();
    const load = async () => {
      controller.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/devices/${sensorId}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          setState({ kind: "not_found" });
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const device = (await response.json()) as DeviceDetail;
        // Alerts start on the 1-hour view, where a fast rise is visible.
        const chosen =
          range ??
          (device.level === "warning" || device.level === "critical"
            ? "1h"
            : "24h");
        const seriesResponse = await fetch(
          `/api/devices/${sensorId}/readings?range=${chosen}`,
          { signal: controller.signal },
        );
        const series = seriesResponse.ok
          ? ((await seriesResponse.json()) as ReadingSeries)
          : null;
        setRange(chosen);
        setState({ kind: "ready", device, series });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setState((current) =>
            current.kind === "ready" ? current : { kind: "error" },
          );
        }
      }
    };
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [sensorId, range]);

  return (
    <DetailSheet
      open={sensorId !== null}
      onClose={onClose}
      title={t("sensors.sheetTitle")}
      snapPoints={SNAP_POINTS}
      snapPoint={snapPoint}
      onSnapPointChange={setSnapPoint}
    >
      <div className="space-y-4">
        {state.kind === "loading" ? (
          <div className="space-y-3 py-2" aria-hidden="true">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-16 w-1/2" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : null}
        {state.kind === "not_found" ? (
          <p className="py-10 text-center text-lg font-semibold">
            {t("sensors.notFound")}
          </p>
        ) : null}
        {state.kind === "error" ? (
          <p className="py-10 text-center text-lg font-semibold">
            {t("sensors.loadError")}
          </p>
        ) : null}
        {state.kind === "ready" ? (
          <SensorBody
            device={state.device}
            series={state.series}
            range={range}
            onRangeChange={setRange}
          />
        ) : null}
      </div>
    </DetailSheet>
  );
}

/** Rendered only with data, so the live clock never runs during prerendering. */
function SensorBody({
  device,
  series,
  range,
  onRangeChange,
}: {
  device: DeviceDetail;
  series: ReadingSeries | null;
  range: ReadingRange | null;
  onRangeChange: (range: ReadingRange) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const now = useLiveNow(15_000);
  return (
    <>
      <header className="space-y-1">
        <p className="text-sm font-semibold text-muted-foreground">
          {t(`sensors.sites.${device.siteType}`)}
        </p>
        <h2 className="font-display text-2xl leading-tight font-extrabold">
          {device.name}
        </h2>
      </header>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {t("sensors.current")}
          </p>
          <p className="font-display text-5xl font-extrabold tabular-nums">
            {device.lastLevelCm !== null
              ? `${device.lastLevelCm.toFixed(1)} cm`
              : "—"}
          </p>
        </div>
        <span
          className="rounded-full px-3.5 py-1.5 text-sm font-extrabold text-white"
          style={{ backgroundColor: LEVEL_COLORS[device.level] }}
        >
          {t(`sensors.levels.${device.level}`)}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("sensors.thresholds", {
          warning: device.warningCm,
          critical: device.criticalCm,
        })}
      </p>

      {device.level === "offline" ? (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold">
          <WifiOff className="mt-0.5 size-4 shrink-0" />
          {device.lastSeenAt
            ? t("sensors.offlineNote", {
                time: format.relativeTime(new Date(device.lastSeenAt), now),
              })
            : t("sensors.neverReported")}
        </p>
      ) : null}

      <div
        role="radiogroup"
        aria-label={t("sensors.sheetTitle")}
        className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1"
      >
        {READING_RANGES.map((option) => (
          <Button
            key={option}
            role="radio"
            aria-checked={range === option}
            variant="ghost"
            onClick={() => onRangeChange(option)}
            className={cn(
              "h-10 rounded-full font-bold",
              range === option && "bg-card shadow-sm hover:bg-card",
            )}
          >
            {t(`sensors.ranges.${option}`)}
          </Button>
        ))}
      </div>

      {series ? <LevelChart series={series} now={now.getTime()} /> : null}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {device.lastSeenAt ? (
          <li className="inline-flex items-center gap-1.5">
            <Clock className="size-4" />
            {t("sensors.updatedAgo", {
              time: format.relativeTime(new Date(device.lastSeenAt), now),
            })}
          </li>
        ) : null}
        {device.lastBatteryPct !== null ? (
          <li className="inline-flex items-center gap-1.5">
            <BatteryMedium className="size-4" />
            {t("sensors.battery", {
              percent: device.lastBatteryPct,
            })}
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
        <li>
          {t("sensors.interval", {
            minutes: Math.round(device.reportingIntervalS / 60),
          })}
        </li>
      </ul>
    </>
  );
}
