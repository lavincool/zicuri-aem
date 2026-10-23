"use client";

import { LocateFixed, Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type RefObject, useMemo, useState, useSyncExternalStore } from "react";
import { PILOT } from "@/config/pilot";
import {
  FloodMap,
  type FloodMapHandle,
  type MapView,
} from "@/features/map/components/flood-map";
import { useSensorsFeed } from "@/features/map/hooks/use-sensors-feed";
import { RISK_COLORS } from "@/features/map/lib/risk-layers";
import type { ReportFeatureCollection } from "@/features/reports/schema";
import { cn } from "@/lib/utils";
import {
  RISK_LEVELS,
  RISK_MODEL_VERSION,
  type RiskFactor,
} from "../risk/model";
import type { DrainItem, RiskCell } from "../server/panel-data";
import { LevelPill } from "./level-pill";
import { reasonText } from "./reasons";

export const PANEL_MAP_ZOOM = 12.2;
const noopSubscribe = () => () => {};
const glass =
  "bg-card/85 shadow-[0_8px_30px_-12px_rgb(11_31_51/0.3)] ring-1 ring-foreground/5 backdrop-blur-xl";

/** Hex risk map with drain pins, floating controls and the selected zone's breakdown. */
export function RiskMapCard({
  cells,
  drains,
  selectedCell,
  selectedDrainId,
  onSelectCell,
  onSelectDrain,
  onCloseCell,
  mapRef,
  className,
}: {
  cells: RiskCell[];
  drains: DrainItem[];
  selectedCell: string | null;
  selectedDrainId: string | null;
  onSelectCell: (h3r8: string) => void;
  onSelectDrain: (id: string) => void;
  onCloseCell: () => void;
  mapRef: RefObject<FloodMapHandle | null>;
  className?: string;
}) {
  const t = useTranslations("panel");
  const cell = cells.find((c) => c.h3r8 === selectedCell) ?? null;

  const zoomBy = (delta: number) => {
    const view = mapRef.current?.getView();
    if (view) mapRef.current?.flyTo(view.center, view.zoom + delta);
  };

  return (
    <section
      aria-labelledby="risk-map-title"
      className={cn(
        "relative isolate overflow-hidden rounded-[2rem] bg-muted ring-1 ring-foreground/5",
        className,
      )}
    >
      <RiskMap
        cells={cells}
        drains={drains}
        selectedCell={selectedCell}
        selectedDrainId={selectedDrainId}
        onSelectCell={onSelectCell}
        onSelectDrain={onSelectDrain}
        mapRef={mapRef}
      />

      <div
        className={cn(
          "absolute top-3 left-3 z-10 max-w-[calc(100%-4.5rem)] space-y-1.5 rounded-2xl px-3.5 py-2.5",
          glass,
        )}
      >
        <h2 id="risk-map-title" className="font-sans text-sm font-bold">
          {t("map.title")}
        </h2>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {RISK_LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: RISK_COLORS[level] }}
              />
              {t(`levels.${level}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => mapRef.current?.flyTo(PILOT.center, PANEL_MAP_ZOOM)}
          aria-label={t("map.recenter")}
          title={t("map.recenter")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full transition-colors hover:bg-card",
            glass,
          )}
        >
          <LocateFixed className="size-5" />
        </button>
        <div className={cn("flex flex-col rounded-full", glass)}>
          <button
            type="button"
            onClick={() => zoomBy(1)}
            aria-label={t("map.zoomIn")}
            className="flex size-11 items-center justify-center rounded-t-full transition-colors hover:bg-card"
          >
            <Plus className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            aria-label={t("map.zoomOut")}
            className="flex size-11 items-center justify-center rounded-b-full transition-colors hover:bg-card"
          >
            <Minus className="size-5" />
          </button>
        </div>
      </div>

      {cell ? (
        <CellCard cell={cell} onClose={onCloseCell} />
      ) : (
        <p
          className={cn(
            "absolute inset-x-3 bottom-12 z-10 rounded-2xl px-4 py-3 text-sm sm:bottom-10",
            glass,
          )}
        >
          {t("map.hint")}
        </p>
      )}
    </section>
  );
}

function RiskMap({
  cells,
  drains,
  selectedCell,
  selectedDrainId,
  onSelectCell,
  onSelectDrain,
  mapRef,
}: {
  cells: RiskCell[];
  drains: DrainItem[];
  selectedCell: string | null;
  selectedDrainId: string | null;
  onSelectCell: (h3r8: string) => void;
  onSelectDrain: (id: string) => void;
  mapRef: RefObject<FloodMapHandle | null>;
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
  const sensors = useSensorsFeed(view, { scope: "panel" });
  const riskCells = useMemo(
    () => cells.map(({ h3r8, level, score }) => ({ h3r8, level, score })),
    [cells],
  );
  const reports = useMemo(
    (): ReportFeatureCollection => ({
      type: "FeatureCollection",
      truncated: false,
      features: drains.map((drain) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [drain.lng, drain.lat] },
        properties: {
          id: drain.id,
          c: drain.category,
          s: "open",
          t: new Date(drain.createdAt).getTime(),
          v: drain.stillThereCount,
          sev: drain.severity,
        },
      })),
    }),
    [drains],
  );
  if (!mounted || !resolvedTheme) return null;
  return (
    <FloodMap
      ref={mapRef}
      className="absolute inset-0"
      styleUrl={`/map/styles/cauce-${theme}.json`}
      theme={theme}
      initialCenter={PILOT.center}
      initialZoom={PANEL_MAP_ZOOM}
      minZoom={PILOT.minZoom}
      maxZoom={PILOT.maxZoom}
      reports={reports}
      selectedReportId={selectedDrainId}
      sensors={sensors}
      riskCells={riskCells}
      selectedRiskCell={selectedCell}
      onReportClick={onSelectDrain}
      onRiskCellClick={onSelectCell}
      onViewChange={setView}
      ariaLabel={t("ariaLabel")}
    />
  );
}

function CellCard({ cell, onClose }: { cell: RiskCell; onClose: () => void }) {
  const t = useTranslations("panel");
  return (
    <aside
      aria-labelledby="risk-cell-title"
      className={cn(
        "absolute inset-x-3 bottom-12 z-10 max-h-[55%] overflow-y-auto rounded-3xl p-4 sm:bottom-10 sm:max-h-[62%] sm:p-5",
        glass,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3
            id="risk-cell-title"
            className="truncate text-xl font-semibold sm:text-2xl"
          >
            {cell.colonia
              ? t("cell.title", { colonia: cell.colonia })
              : t("cell.unnamed")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("cell.score", { score: cell.score })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LevelPill level={cell.level} baseline={cell.baseline} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cell.close")}
            className="flex size-9 items-center justify-center rounded-full bg-muted transition-colors hover:bg-foreground/10"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>
      <p className="mt-3 text-sm font-bold">{t("cell.factors")}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
        {cell.factors.map((factor) => (
          <FactorStat key={factor.key} factor={factor} />
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("cell.model", { version: RISK_MODEL_VERSION })}
      </p>
    </aside>
  );
}

function FactorStat({ factor }: { factor: RiskFactor }) {
  const t = useTranslations("panel");
  const reason = reasonText(t, factor);
  return (
    <div className="min-w-0 space-y-1">
      <dt className="truncate text-sm text-muted-foreground">
        {t(`cell.factorNames.${factor.key}`)}
      </dt>
      <dd className="space-y-1.5">
        <p className="font-semibold tabular-nums">
          +{factor.contribution}
          <span className="font-normal text-muted-foreground">
            {" "}
            / {factor.weight}
          </span>
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-water"
            style={{
              width: `${(factor.contribution / factor.weight) * 100}%`,
            }}
          />
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {reason ?? t("cell.noValue")}
        </p>
      </dd>
    </div>
  );
}
