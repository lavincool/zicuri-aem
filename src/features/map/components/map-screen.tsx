"use client";

import { CloudUpload, LoaderCircle, LocateFixed, WifiOff } from "lucide-react";
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
import { CATEGORY_COLORS, type ReportCategory } from "@/config/categories";
import { isInsidePilot, type LngLat, PILOT } from "@/config/pilot";
import { SensorSheet } from "@/features/devices/components/sensor-sheet";
import {
  type FlowMapControls,
  ReportFlow,
} from "@/features/reports/components/report-flow";
import { ReportSheet } from "@/features/reports/components/report-sheet";
import { useOutbox } from "@/features/reports/hooks/use-outbox";
import type {
  CreatedReport,
  ReportDetail,
  ReportFeature,
} from "@/features/reports/schema";
import { useOnline } from "@/hooks/use-online";
import { type ReportFilters, useReportsFeed } from "../hooks/use-reports-feed";
import { useSensorsFeed } from "../hooks/use-sensors-feed";
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

export type InitialFocus = {
  kind: "report" | "sensor";
  id: string;
  center: LngLat;
};

/** Keeps the address bar shareable (`/r/[id]`, `/s/[id]`) without a navigation. */
function setFocusUrl(path: string | null) {
  window.history.replaceState(window.history.state, "", path ?? "/");
}
const setReportUrl = (id: string | null) => setFocusUrl(id ? `/r/${id}` : null);
const setSensorUrl = (id: string | null) => setFocusUrl(id ? `/s/${id}` : null);

function localFeature(
  id: string,
  category: ReportCategory,
  [lng, lat]: LngLat,
  pending: boolean,
): ReportFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id,
      c: category,
      s: "open",
      t: Date.now(),
      v: 0,
      sev: null,
      ...(pending ? { p: 1 as const } : {}),
    },
  };
}

export function MapScreen({
  demoMode,
  initialFocus,
}: {
  demoMode: boolean;
  initialFocus?: InitialFocus;
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
    initialFocus?.kind === "report" ? initialFocus.id : null,
  );
  const [sensorId, setSensorId] = useState<string | null>(
    initialFocus?.kind === "sensor" ? initialFocus.id : null,
  );
  const [legendOpen, setLegendOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [flowStep, setFlowStep] = useState("closed");
  const flowActive = flowStep !== "closed";

  const feed = useReportsFeed(view, filters);
  const sensors = useSensorsFeed(view);
  const [pinned, setPinned] = useState<ReportFeature | null>(null);
  /** Reports created (or queued) on this device, shown before the feed catches up. */
  const [local, setLocal] = useState<ReportFeature[]>([]);

  const mapReports = useMemo(() => {
    const ids = new Set(feed.data.features.map((f) => f.properties.id));
    const extra = [...local, ...(pinned ? [pinned] : [])].filter(
      (f) => !ids.has(f.properties.id),
    );
    return extra.length
      ? { ...feed.data, features: [...feed.data.features, ...extra] }
      : feed.data;
  }, [feed.data, local, pinned]);

  // The open report always shows on the map, even when the filters would hide it.
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

  const outbox = useOutbox(
    useCallback(
      (result) => {
        if (result.sent.length > 0) {
          toast.success(t("flow.queuedSent", { count: result.sent.length }));
          setLocal((items) => [
            ...items.filter((f) => !f.properties.p),
            ...result.sent.map((created) =>
              localFeature(
                created.report.id,
                created.report.category,
                [created.report.lng, created.report.lat],
                false,
              ),
            ),
          ]);
          feed.refresh();
        }
        if (result.failed.length > 0) toast.error(t("flow.queuedFailed"));
      },
      [feed.refresh, t],
    ),
  );

  const flowMap = useMemo<FlowMapControls>(
    () => ({
      getCenter: () => mapRef.current?.getView()?.center ?? null,
      focusOn: (center, zoom) =>
        mapRef.current?.focusOn(center, { zoom, bottomPadding: 0 }),
      showAccuracy: (location) => setUserLocation(location),
    }),
    [],
  );

  const onCreated = useCallback(
    (created: CreatedReport) => {
      const { id, category, lng, lat } = created.report;
      setLocal((items) => [
        ...items,
        localFeature(id, category, [lng, lat], false),
      ]);
      mapRef.current?.focusOn([lng, lat], { zoom: 17, bottomPadding: 0 });
      window.setTimeout(
        () => mapRef.current?.dropPin([lng, lat], CATEGORY_COLORS[category]),
        650,
      );
      toast.success(t("flow.success"), {
        description:
          created.nearbyCount > 0
            ? t("flow.nearby", { count: created.nearbyCount })
            : undefined,
        action: {
          label: t("flow.viewReport"),
          onClick: () => {
            setSelectedId(id);
            setReportUrl(id);
          },
        },
        duration: 7000,
      });
      feed.refresh();
    },
    [feed.refresh, t],
  );

  const onQueued = useCallback(
    (draft: {
      clientRequestId: string;
      category: string;
      location: { lng: number; lat: number };
    }) => {
      setLocal((items) => [
        ...items,
        localFeature(
          `pending-${draft.clientRequestId}`,
          draft.category as ReportCategory,
          [draft.location.lng, draft.location.lat],
          true,
        ),
      ]);
      void outbox.refreshCount();
    },
    [outbox.refreshCount],
  );

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

  const closeSensor = useCallback(() => {
    setSensorId(null);
    setSensorUrl(null);
    const current = mapRef.current?.getView();
    if (current) {
      mapRef.current?.focusOn(current.center, {
        bottomPadding: 0,
        zoom: current.zoom,
      });
    }
  }, []);

  const closeSheet = useCallback(() => {
    setSelectedId(null);
    setPinned(null);
    setReportUrl(null);
    const current = mapRef.current?.getView();
    if (current) {
      mapRef.current?.focusOn(current.center, {
        bottomPadding: 0,
        zoom: current.zoom,
      });
    }
  }, []);

  const empty =
    mapState === "ready" &&
    feed.status === "ready" &&
    mapReports.features.length === 0;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      {mounted && resolvedTheme ? (
        <FloodMap
          key={mapKey}
          ref={mapRef}
          className="absolute inset-0"
          styleUrl={STYLE_URLS[theme]}
          theme={theme}
          initialCenter={initialFocus?.center ?? PILOT.center}
          initialZoom={initialFocus ? 16 : PILOT.zoom}
          minZoom={PILOT.minZoom}
          maxZoom={PILOT.maxZoom}
          reports={mapReports}
          selectedReportId={selectedId}
          sensors={sensors}
          selectedSensorId={sensorId}
          userLocation={userLocation}
          onViewChange={setView}
          onReportClick={(id, center) => {
            if (flowActive || id.startsWith("pending-")) return;
            setSensorId(null);
            setSelectedId(id);
            setReportUrl(id);
            mapRef.current?.focusOn(center, { bottomPadding: sheetPadding() });
          }}
          onSensorClick={(id, center) => {
            if (flowActive) return;
            setSelectedId(null);
            setPinned(null);
            setSensorId(id);
            setSensorUrl(id);
            mapRef.current?.focusOn(center, { bottomPadding: sheetPadding() });
          }}
          onLoad={() => {
            setMapState("ready");
            if (initialFocus) {
              mapRef.current?.focusOn(initialFocus.center, {
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

      {!flowActive ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
            <TopBar onOpenLegend={() => setLegendOpen(true)} />
            <FilterBar filters={filters} onChange={setFilters} />
            <div className="flex flex-col items-start gap-2 px-3">
              {demoMode ? (
                <p className="rounded-full bg-navy/85 px-3 py-1 text-xs font-semibold text-white">
                  {t("common.demoData")}
                </p>
              ) : null}
              {!online ? (
                <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white shadow-md">
                  <WifiOff className="size-4" />
                  {t("common.offline")}
                </p>
              ) : null}
              {outbox.pending > 0 ? (
                <p className="flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow">
                  <CloudUpload className="size-3.5" />
                  {t("flow.pendingBadge", { count: outbox.pending })}
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
              <p className="text-sm text-muted-foreground">
                {t("map.emptyBody")}
              </p>
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
        </>
      ) : null}

      <ReportFlow
        map={flowMap}
        viewCenter={view?.center ?? null}
        onActiveChange={(step) => {
          setFlowStep(step);
          if (step !== "closed" && selectedId) closeSheet();
          if (step !== "closed" && sensorId) closeSensor();
        }}
        onCreated={onCreated}
        onQueued={onQueued}
      />

      <LegendSheet open={legendOpen} onOpenChange={setLegendOpen} />
      <ReportSheet
        reportId={flowActive ? null : selectedId}
        onClose={closeSheet}
        onResolved={feed.refresh}
        onLoaded={pinReport}
      />
      <SensorSheet
        sensorId={flowActive ? null : sensorId}
        onClose={closeSensor}
      />
    </div>
  );
}
