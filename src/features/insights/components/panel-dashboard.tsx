"use client";

import {
  CloudRain,
  Eye,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FloodMapHandle } from "@/features/map/components/flood-map";
import { useLiveNow } from "@/hooks/use-live-now";
import { refreshForecastAction, runScenarioAction } from "../server/actions";
import type { DrainItem, PanelData } from "../server/panel-data";
import { DrainList } from "./drain-list";
import { PanelStats } from "./panel-stats";
import { RiskMapCard } from "./risk-map-card";

const DRAIN_ZOOM = 14.5;
/** Room left under a focused pin for the zone card floating over the map (phones, wider). */
const CARD_PADDING_PX = { narrow: 340, wide: 220 };

export function PanelDashboard({
  data,
  demoMode,
  readOnly,
}: {
  data: PanelData;
  demoMode: boolean;
  /** Demo viewers can look around but not change shared state. */
  readOnly: boolean;
}) {
  const t = useTranslations("panel");
  const format = useFormatter();
  const now = useLiveNow(60_000, data.renderedAt);
  const [pending, startTransition] = useTransition();
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedDrainId, setSelectedDrainId] = useState<string | null>(null);
  const mapRef = useRef<FloodMapHandle>(null);
  const mapSection = useRef<HTMLDivElement>(null);

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

  const pickDrain = (drain: DrainItem) => {
    setSelectedDrainId(drain.id);
    setSelectedCell(drain.cell?.h3r8 ?? null);
  };
  const focusDrain = (drain: DrainItem) => {
    pickDrain(drain);
    mapRef.current?.focusOn([drain.lng, drain.lat], {
      zoom: DRAIN_ZOOM,
      bottomPadding: window.matchMedia("(max-width: 639px)").matches
        ? CARD_PADDING_PX.narrow
        : CARD_PADDING_PX.wide,
    });
  };
  const showOnMap = (drain: DrainItem) => {
    focusDrain(drain);
    // Stacked layout: the map sits below the list, so bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      mapSection.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };
  const selectCell = (h3r8: string) => {
    setSelectedCell(h3r8);
    const drain = data.drains.find((d) => d.id === selectedDrainId);
    if (drain?.cell?.h3r8 !== h3r8) setSelectedDrainId(null);
  };

  const baseline = data.cells.every((c) => c.baseline);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">
            {data.computedAt
              ? t("updated", {
                  time: format.relativeTime(new Date(data.computedAt), now),
                })
              : t("notComputed")}
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-muted-foreground">{t("subtitle")}</p>
        </div>
        {readOnly ? (
          <p className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-xs">
            <Eye className="size-4" />
            {t("readOnly")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {demoMode ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={data.scenario ? refresh : scenario}
                className="h-11 rounded-full border-transparent bg-card px-4 font-semibold shadow-xs dark:bg-card"
              >
                {data.scenario ? (
                  <CloudRain className="size-4" />
                ) : (
                  <FlaskConical className="size-4" />
                )}
                {data.scenario ? t("scenario.real") : t("scenario.run")}
              </Button>
            ) : null}
            <Button
              disabled={pending}
              onClick={refresh}
              className="h-11 rounded-full bg-foreground px-5 font-semibold text-background hover:bg-foreground/85"
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {pending ? t("refreshing") : t("refresh")}
            </Button>
          </div>
        )}
      </header>

      {data.scenario ? (
        <p className="flex items-start gap-2.5 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground">
          <FlaskConical className="mt-0.5 size-5 shrink-0" />
          {t("scenario.banner")}
        </p>
      ) : null}

      <PanelStats data={data} now={now} />

      <div className="grid gap-4 lg:h-[46rem] lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <DrainList
          drains={data.drains}
          baseline={baseline}
          selectedId={selectedDrainId}
          now={now}
          onSelect={(drain) =>
            drain ? focusDrain(drain) : setSelectedDrainId(null)
          }
          onShowOnMap={showOnMap}
        />
        <div ref={mapSection} className="h-[34rem] scroll-mt-4 lg:h-full">
          <RiskMapCard
            className="h-full"
            cells={data.cells}
            drains={data.drains}
            selectedCell={selectedCell}
            selectedDrainId={selectedDrainId}
            onSelectCell={selectCell}
            onSelectDrain={(id) => {
              const drain = data.drains.find((d) => d.id === id);
              if (drain) pickDrain(drain);
            }}
            onCloseCell={() => setSelectedCell(null)}
            mapRef={mapRef}
          />
        </div>
      </div>
    </div>
  );
}
