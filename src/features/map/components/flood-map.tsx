"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  Map as MapLibreMap,
} from "maplibre-gl";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import type { LngLat } from "@/config/pilot";
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
  USER_SOURCE,
  type UserLocation,
  userLayers,
  userLocationData,
} from "../lib/user-layers";

export type MapView = { bbox: Bbox; zoom: number; center: LngLat };
export type { UserLocation };

export type FloodMapHandle = {
  flyTo: (center: LngLat, zoom?: number) => void;
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
  userLocation?: UserLocation | null;
  onViewChange?: (view: MapView) => void;
  onReportClick?: (id: string) => void;
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
  userLocation = null,
  onViewChange,
  onReportClick,
  onLoad,
  onError,
  ariaLabel,
  className,
  ref,
}: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({
    theme,
    reports,
    userLocation,
    selectedReportId,
    onViewChange,
    onReportClick,
    onLoad,
    onError,
  });
  latest.current = {
    theme,
    reports,
    userLocation,
    selectedReportId,
    onViewChange,
    onReportClick,
    onLoad,
    onError,
  };
  const appliedStyle = useRef(styleUrl);
  const selected = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo(center, zoom) {
      mapRef.current?.flyTo({
        center,
        zoom: zoom ?? mapRef.current.getZoom(),
        essential: true,
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
      });
      instance.on("load", () => {
        loaded = true;
        latest.current.onLoad?.();
        latest.current.onViewChange?.(readView(instance));
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
          { layers: [REPORT_LAYERS.points, REPORT_LAYERS.clusters] },
        );
        const hit = nearest(instance, features, event.point);
        if (!hit) return;
        if (hit.layer.id === REPORT_LAYERS.clusters) {
          void zoomIntoCluster(instance, hit);
        } else {
          const id = hit.properties?.id;
          if (typeof id === "string") latest.current.onReportClick?.(id);
        }
      });
      for (const layer of [REPORT_LAYERS.points, REPORT_LAYERS.clusters]) {
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
    if (map)
      selected.current = setSelection(map, selected.current, selectedReportId);
  }, [selectedReportId]);

  async function installLayers(map: MapLibreMap) {
    await ensureCategoryImages(map);
    // Read props after the await: data may have arrived while images loaded.
    const current = latest.current;
    if (!map.getSource(REPORTS_SOURCE)) {
      map.addSource(REPORTS_SOURCE, reportsSource(current.reports));
    }
    for (const layer of reportLayers(current.theme)) {
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
    selected.current = setSelection(map, null, current.selectedReportId);
  }

  return (
    <section
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn("h-full w-full", className)}
    />
  );
}

/** Highlights one report pin through feature state; returns the new selection. */
function setSelection(
  map: MapLibreMap,
  previous: string | null,
  next: string | null,
): string | null {
  if (!map.getSource(REPORTS_SOURCE)) return previous;
  if (previous) {
    map.setFeatureState(
      { source: REPORTS_SOURCE, id: previous },
      { selected: false },
    );
  }
  if (next) {
    map.setFeatureState(
      { source: REPORTS_SOURCE, id: next },
      { selected: true },
    );
  }
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
