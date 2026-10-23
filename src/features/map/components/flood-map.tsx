"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  Map as MapLibreMap,
} from "maplibre-gl";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import type { LngLat } from "@/config/pilot";
import type { DeviceFeatureCollection } from "@/features/devices/schema";
import type { ReportFeatureCollection } from "@/features/reports/schema";
import type { Bbox } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { ensureCategoryImages } from "../lib/images";
import {
  REPORT_LAYERS,
  REPORTS_SOURCE,
  reportLayers,
  reportsSource,
} from "../lib/report-layers";
import {
  RISK_LAYERS,
  RISK_SOURCE,
  type RiskCellInput,
  riskData,
  riskLayers,
} from "../lib/risk-layers";
import {
  ensureSensorImages,
  SENSOR_LAYERS,
  SENSORS_SOURCE,
  sensorLayers,
  sensorsSource,
} from "../lib/sensor-layers";
import {
  USER_SOURCE,
  type UserLocation,
  userLayers,
  userLocationData,
} from "../lib/user-layers";

export type MapView = { bbox: Bbox; zoom: number; center: LngLat };
export type { UserLocation };

export type FloodMapHandle = {
  flyTo: (center: LngLat, zoom?: number) => void;
  /** Plays the "new report" pin drop with a water ripple at a point. */
  dropPin: (center: LngLat, color: string) => void;
  /** Centers a point in the area left visible above a bottom sheet. */
  focusOn: (
    center: LngLat,
    options?: { bottomPadding?: number; zoom?: number },
  ) => void;
  getView: () => MapView | null;
};

type FloodMapProps = {
  styleUrl: string;
  theme: "light" | "dark";
  initialCenter: LngLat;
  initialZoom: number;
  minZoom?: number;
  maxZoom?: number;
  reports: ReportFeatureCollection;
  selectedReportId?: string | null;
  sensors?: DeviceFeatureCollection;
  selectedSensorId?: string | null;
  riskCells?: RiskCellInput[];
  selectedRiskCell?: string | null;
  userLocation?: UserLocation | null;
  onViewChange?: (view: MapView) => void;
  onReportClick?: (id: string, center: LngLat) => void;
  onSensorClick?: (id: string, center: LngLat) => void;
  onRiskCellClick?: (h3r8: string) => void;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  ariaLabel: string;
  className?: string;
  ref?: Ref<FloodMapHandle>;
};

/** Pixels around a tap that count as hitting a pin (one-thumb friendly). */
const HIT_TOLERANCE = 14;

/**
 * The only component that talks to MapLibre. Everything else uses this props/handle API,
 * so the map provider can be swapped without touching features.
 */
export function FloodMap({
  styleUrl,
  theme,
  initialCenter,
  initialZoom,
  minZoom,
  maxZoom,
  reports,
  selectedReportId = null,
  sensors = EMPTY_SENSORS,
  selectedSensorId = null,
  riskCells,
  selectedRiskCell = null,
  userLocation = null,
  onViewChange,
  onReportClick,
  onSensorClick,
  onRiskCellClick,
  onLoad,
  onError,
  ariaLabel,
  className,
  ref,
}: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const props = {
    theme,
    reports,
    sensors,
    userLocation,
    selectedReportId,
    selectedSensorId,
    riskCells,
    selectedRiskCell,
    onViewChange,
    onReportClick,
    onSensorClick,
    onRiskCellClick,
    onLoad,
    onError,
  };
  const latest = useRef(props);
  latest.current = props;
  const appliedStyle = useRef(styleUrl);
  const selected = useRef<string | null>(null);
  const selectedSensor = useRef<string | null>(null);
  const selectedRisk = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo(center, zoom) {
      mapRef.current?.flyTo({
        center,
        zoom: zoom ?? mapRef.current.getZoom(),
        essential: true,
      });
    },
    dropPin(center, color) {
      const map = mapRef.current;
      const lib = libRef.current;
      if (!map || !lib) return;
      const element = document.createElement("div");
      element.className = "pointer-events-none relative size-10";
      element.innerHTML = `<span class="absolute inset-0 rounded-full border-4 animate-pin-ripple" style="border-color:${color}"></span><span class="absolute inset-1 rounded-full border-4 border-white shadow-lg animate-pin-drop" style="background:${color}"></span>`;
      const marker = new lib.Marker({ element }).setLngLat(center).addTo(map);
      window.setTimeout(() => marker.remove(), 1600);
    },
    focusOn(center, options) {
      mapRef.current?.easeTo({
        center,
        zoom: options?.zoom ?? Math.max(mapRef.current.getZoom(), 15),
        padding: {
          top: 0,
          left: 0,
          right: 0,
          bottom: options?.bottomPadding ?? 0,
        },
        duration: 600,
      });
    },
    getView() {
      const map = mapRef.current;
      return map ? readView(map) : null;
    },
  }));

  // Create the map once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial view and style are read once on mount; later changes go through the effects below.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let loaded = false;

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      libRef.current = maplibregl;
      maplibregl.setWorkerUrl(
        `/map/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`,
      );

      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: initialCenter,
        zoom: initialZoom,
        minZoom,
        maxZoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      mapRef.current = map;

      const instance = map;
      instance.on("style.load", () => {
        void installLayers(instance);
        // Show the map as soon as the style is ready; tiles fade in as they arrive
        // instead of keeping a skeleton up until every tile has loaded.
        if (!loaded) {
          loaded = true;
          latest.current.onLoad?.();
          latest.current.onViewChange?.(readView(instance));
        }
      });
      for (const event of ["moveend", "resize"] as const) {
        instance.on(event, () => {
          latest.current.onViewChange?.(readView(instance));
        });
      }
      instance.on("error", (event) => {
        // Single missing tiles are expected offline; only a failed style is fatal.
        if (!loaded) latest.current.onError?.(new Error(event.error.message));
      });
      instance.on("click", (event) => {
        const { x, y } = event.point;
        const features = instance.queryRenderedFeatures(
          [
            [x - HIT_TOLERANCE, y - HIT_TOLERANCE],
            [x + HIT_TOLERANCE, y + HIT_TOLERANCE],
          ],
          {
            layers: [
              SENSOR_LAYERS.icons,
              REPORT_LAYERS.points,
              REPORT_LAYERS.clusters,
            ],
          },
        );
        const hit = nearest(instance, features, event.point);
        if (!hit) {
          if (!instance.getLayer(RISK_LAYERS.fill)) return;
          const [cell] = instance.queryRenderedFeatures(event.point, {
            layers: [RISK_LAYERS.fill],
          });
          const id = cell?.properties?.id;
          if (typeof id === "string") latest.current.onRiskCellClick?.(id);
          return;
        }
        if (hit.layer.id === SENSOR_LAYERS.icons) {
          const id = hit.properties?.id;
          if (typeof id === "string" && hit.geometry.type === "Point") {
            latest.current.onSensorClick?.(
              id,
              hit.geometry.coordinates as [number, number],
            );
          }
        } else if (hit.layer.id === REPORT_LAYERS.clusters) {
          void zoomIntoCluster(instance, hit);
        } else {
          const id = hit.properties?.id;
          if (typeof id === "string" && hit.geometry.type === "Point") {
            latest.current.onReportClick?.(
              id,
              hit.geometry.coordinates as [number, number],
            );
          }
        }
      });
      for (const layer of [
        REPORT_LAYERS.points,
        REPORT_LAYERS.clusters,
        SENSOR_LAYERS.icons,
      ]) {
        instance.on("mouseenter", layer, () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", layer, () => {
          instance.getCanvas().style.cursor = "";
        });
      }
    })().catch((error: unknown) => {
      latest.current.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap the basemap when the theme changes; layers are re-added on style.load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyle.current === styleUrl) return;
    appliedStyle.current = styleUrl;
    map.setStyle(styleUrl, { diff: false });
  }, [styleUrl]);

  useEffect(() => {
    const source = mapRef.current?.getSource(REPORTS_SOURCE) as
      | GeoJSONSource
      | undefined;
    source?.setData(reports);
  }, [reports]);

  useEffect(() => {
    if (!riskCells) return;
    const source = mapRef.current?.getSource(RISK_SOURCE) as
      | GeoJSONSource
      | undefined;
    source?.setData(riskData(riskCells));
  }, [riskCells]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      selectedRisk.current = setSelection(
        map,
        RISK_SOURCE,
        selectedRisk.current,
        selectedRiskCell,
      );
    }
  }, [selectedRiskCell]);

  useEffect(() => {
    const source = mapRef.current?.getSource(SENSORS_SOURCE) as
      | GeoJSONSource
      | undefined;
    source?.setData(sensors);
  }, [sensors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource(USER_SOURCE)) return;
    (map.getSource(USER_SOURCE) as GeoJSONSource).setData(
      userLocationData(userLocation),
    );
    const [accuracyLayer] = userLayers(userLocation);
    if (accuracyLayer?.type === "circle" && map.getLayer(accuracyLayer.id)) {
      map.setPaintProperty(
        accuracyLayer.id,
        "circle-radius",
        accuracyLayer.paint?.["circle-radius"],
      );
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      selected.current = setSelection(
        map,
        REPORTS_SOURCE,
        selected.current,
        selectedReportId,
      );
    }
  }, [selectedReportId]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      selectedSensor.current = setSelection(
        map,
        SENSORS_SOURCE,
        selectedSensor.current,
        selectedSensorId,
      );
    }
  }, [selectedSensorId]);

  async function installLayers(map: MapLibreMap) {
    await Promise.all([ensureCategoryImages(map), ensureSensorImages(map)]);
    // Read props after the await: data may have arrived while images loaded.
    const current = latest.current;
    // Risk hexagons sit under every pin.
    if (current.riskCells && !map.getSource(RISK_SOURCE)) {
      map.addSource(RISK_SOURCE, {
        type: "geojson",
        data: riskData(current.riskCells),
        promoteId: "id",
      });
      for (const layer of riskLayers()) {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
      }
    }
    if (!map.getSource(REPORTS_SOURCE)) {
      map.addSource(REPORTS_SOURCE, reportsSource(current.reports));
    }
    for (const layer of reportLayers(current.theme)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    if (!map.getSource(SENSORS_SOURCE)) {
      map.addSource(SENSORS_SOURCE, sensorsSource(current.sensors));
    }
    for (const layer of sensorLayers(current.theme)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    if (!map.getSource(USER_SOURCE)) {
      map.addSource(USER_SOURCE, {
        type: "geojson",
        data: userLocationData(current.userLocation),
      });
    }
    for (const layer of userLayers(current.userLocation)) {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    }
    selected.current = setSelection(
      map,
      REPORTS_SOURCE,
      null,
      current.selectedReportId,
    );
    selectedSensor.current = setSelection(
      map,
      SENSORS_SOURCE,
      null,
      current.selectedSensorId,
    );
    selectedRisk.current = setSelection(
      map,
      RISK_SOURCE,
      null,
      current.selectedRiskCell,
    );
  }

  return (
    <section
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn("h-full w-full", className)}
    />
  );
}

const EMPTY_SENSORS: DeviceFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Highlights one feature through feature state; returns the new selection. */
function setSelection(
  map: MapLibreMap,
  source: string,
  previous: string | null,
  next: string | null,
): string | null {
  if (!map.getSource(source)) return previous;
  if (previous) {
    map.setFeatureState({ source, id: previous }, { selected: false });
  }
  if (next) map.setFeatureState({ source, id: next }, { selected: true });
  return next;
}

function readView(map: MapLibreMap): MapView {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    bbox: [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ],
    zoom: map.getZoom(),
    center: [center.lng, center.lat],
  };
}

function nearest(
  map: MapLibreMap,
  features: MapGeoJSONFeature[],
  point: { x: number; y: number },
): MapGeoJSONFeature | undefined {
  let best: MapGeoJSONFeature | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    if (feature.geometry.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const projected = map.project([lng, lat]);
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (distance < bestDistance) {
      best = feature;
      bestDistance = distance;
    }
  }
  return best;
}

async function zoomIntoCluster(map: MapLibreMap, feature: MapGeoJSONFeature) {
  const source = map.getSource(REPORTS_SOURCE) as GeoJSONSource | undefined;
  const clusterId = feature.properties?.cluster_id;
  if (!source || typeof clusterId !== "number") return;
  const zoom = await source.getClusterExpansionZoom(clusterId);
  if (feature.geometry.type !== "Point") return;
  map.easeTo({
    center: feature.geometry.coordinates as [number, number],
    zoom: zoom + 0.25,
  });
}
