"use client";

import { LoaderCircle, LocateFixed, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isInsidePilot, type LngLat, PILOT } from "@/config/pilot";
import { ReportSheet } from "@/features/reports/components/report-sheet";
import type { ReportDetail, ReportFeature } from "@/features/reports/schema";
import { useOnline } from "@/hooks/use-online";
import { type ReportFilters, useReportsFeed } from "../hooks/use-reports-feed";
import { FilterBar } from "./filter-bar";
import {
  FloodMap,
  type FloodMapHandle,
  type MapView,
  type UserLocation,
} from "./flood-map";
import { LegendSheet } from "./legend-sheet";
import { TopBar } from "./top-bar";

const STYLE_URLS = {
  light:
    process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "/map/styles/cauce-light.json",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "/map/styles/cauce-dark.json",
};

const DEFAULT_FILTERS: ReportFilters = {
  categories: [],
  status: "open",
  since: "30d",
};

const noopSubscribe = () => () => {};

/** Keeps a focused pin visible above the report sheet's first snap point. */
const sheetPadding = () => Math.round(window.innerHeight * 0.6);

export type InitialReport = { id: string; center: LngLat };

/** Keeps the address bar shareable (`/r/[id]`) without a navigation. */
function setReportUrl(id: string | null) {
  window.history.replaceState(window.history.state, "", id ? `/r/${id}` : "/");
}

export function MapScreen({
  demoMode,
  initialReport,
}: {
  demoMode: boolean;
  initialReport?: InitialReport;
}) {
  const t = useTranslations();
  const online = useOnline();
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  const mapRef = useRef<FloodMapHandle>(null);
  const [mapKey, setMapKey] = useState(0);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [view, setView] = useState<MapView | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialReport?.id ?? null,
  );
  const [legendOpen, setLegendOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);

  const feed = useReportsFeed(view, filters);
  const [pinned, setPinned] = useState<ReportFeature | null>(null);

  // The open report always shows on the map, even when the filters would hide it.
  const mapReports = useMemo(() => {
    if (
      !pinned ||
      feed.data.features.some((f) => f.properties.id === pinned.properties.id)
    ) {
      return feed.data;
    }
    return { ...feed.data, features: [...feed.data.features, pinned] };
  }, [feed.data, pinned]);

  const pinReport = useCallback((report: ReportDetail) => {
    setPinned({
      type: "Feature",
      geometry: { type: "Point", coordinates: [report.lng, report.lat] },
      properties: {
        id: report.id,
        c: report.category,
        s: report.status,
        t: new Date(report.createdAt).getTime(),
        v: report.stillThereCount,
        sev: report.severity,
      },
    });
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast.error(t("map.locationUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        if (!isInsidePilot(lng, lat)) {
          toast.info(t("map.outsidePilot"));
          return;
        }
        setUserLocation({ lat, lng, accuracyM: accuracy });
        mapRef.current?.flyTo([lng, lat], 16);
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? t("map.locationDenied")
            : t("map.locationUnavailable"),
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, [t]);

  const empty =
    mapState === "ready" &&
    feed.status === "ready" &&
    feed.data.features.length === 0;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      {mounted && resolvedTheme ? (
        <FloodMap
          key={mapKey}
          ref={mapRef}
          className="absolute inset-0"
          styleUrl={STYLE_URLS[theme]}
          theme={theme}
          initialCenter={initialReport?.center ?? PILOT.center}
          initialZoom={initialReport ? 16 : PILOT.zoom}
          minZoom={PILOT.minZoom}
          maxZoom={PILOT.maxZoom}
          reports={mapReports}
          selectedReportId={selectedId}
          userLocation={userLocation}
          onViewChange={setView}
          onReportClick={(id, center) => {
            setSelectedId(id);
            setReportUrl(id);
            mapRef.current?.focusOn(center, { bottomPadding: sheetPadding() });
          }}
          onLoad={() => {
            setMapState("ready");
            if (initialReport) {
              mapRef.current?.focusOn(initialReport.center, {
                bottomPadding: sheetPadding(),
                zoom: 16,
              });
            }
          }}
          onError={() => setMapState("error")}
          ariaLabel={t("map.ariaLabel")}
        />
      ) : null}

      {mapState === "loading" ? (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted">
          <p className="rounded-full bg-card px-4 py-2 text-sm font-semibold shadow">
            {t("map.loading")}
          </p>
        </div>
      ) : null}

      {mapState === "error" ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <p className="max-w-xs text-lg font-semibold">{t("map.error")}</p>
          <Button
            size="lg"
            className="h-12 rounded-full px-6 font-bold"
            onClick={() => {
              setMapState("loading");
              setMapKey((key) => key + 1);
            }}
          >
            {t("common.retry")}
          </Button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
        <TopBar onOpenLegend={() => setLegendOpen(true)} />
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="flex flex-col items-center gap-2 px-3">
          {!online ? (
            <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white shadow-md">
              <WifiOff className="size-4" />
              {t("common.offline")}
            </p>
          ) : null}
          {feed.fetching && mapState === "ready" ? (
            <p
              aria-live="polite"
              className="flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow"
            >
              <LoaderCircle className="size-3.5 animate-spin" />
              {t("map.updating")}
            </p>
          ) : null}
          {feed.data.truncated ? (
            <p className="rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow">
              {t("map.truncated")}
            </p>
          ) : null}
        </div>
      </div>

      {empty ? (
        <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+7rem)] z-10 mx-auto max-w-sm rounded-2xl bg-card p-4 text-center shadow-lg ring-1 ring-foreground/10">
          <p className="font-display text-lg font-bold">
            {t("map.emptyTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t("map.emptyBody")}</p>
        </div>
      ) : null}

      <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={locate}
          disabled={locating}
          aria-label={locating ? t("map.locating") : t("map.nearMe")}
          className="size-14 rounded-full bg-card text-foreground shadow-lg ring-1 ring-foreground/10 hover:bg-card"
        >
          {locating ? (
            <LoaderCircle className="size-6 animate-spin" />
          ) : (
            <LocateFixed className="size-6" />
          )}
        </Button>
      </div>

      {demoMode ? (
        <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 z-10 rounded-full bg-navy/85 px-3 py-1 text-xs font-semibold text-white">
          {t("common.demoData")}
        </p>
      ) : null}

      <LegendSheet open={legendOpen} onOpenChange={setLegendOpen} />
      <ReportSheet
        reportId={selectedId}
        onClose={() => {
          setSelectedId(null);
          setPinned(null);
          setReportUrl(null);
          const view = mapRef.current?.getView();
          if (view) {
            mapRef.current?.focusOn(view.center, {
              bottomPadding: 0,
              zoom: view.zoom,
            });
          }
        }}
        onResolved={feed.refresh}
        onLoaded={pinReport}
      />
    </div>
  );
}
