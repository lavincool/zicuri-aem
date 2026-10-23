"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { type LngLat, MAP_ZOOM, MEXICO_VIEW } from "@/config/service-area";
import type { DeviceFeatureCollection } from "@/features/devices/schema";
import { FloodMap } from "@/features/map/components/flood-map";

const noopSubscribe = () => () => {};
const EMPTY_REPORTS = {
  type: "FeatureCollection" as const,
  truncated: false,
  features: [],
};

/** The organization's sensors (private ones included); a tap opens the detail page. */
export function FleetMap({ sensors }: { sensors: DeviceFeatureCollection }) {
  const t = useTranslations("operator.overview.map");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  // The map is client-only; match the server render during hydration.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!mounted || !resolvedTheme) return null;
  return (
    <FloodMap
      className="absolute inset-0"
      styleUrl={`/map/styles/cauce-${theme}.json`}
      theme={theme}
      {...fleetView(sensors)}
      minZoom={MAP_ZOOM.min}
      maxZoom={MAP_ZOOM.max}
      reports={EMPTY_REPORTS}
      sensors={sensors}
      onSensorClick={(id) => router.push(`/operador/sensores/${id}`)}
      ariaLabel={t("ariaLabel")}
    />
  );
}

function fleetView(sensors: DeviceFeatureCollection) {
  const points = sensors.features.map((f) => f.geometry.coordinates);
  if (points.length === 0) {
    return {
      initialCenter: MEXICO_VIEW.center,
      initialZoom: MEXICO_VIEW.zoom,
    };
  }
  const [lng, lat] = points.reduce(
    ([x, y], [px, py]) => [x + px, y + py],
    [0, 0],
  );
  return {
    initialCenter: [lng / points.length, lat / points.length] as LngLat,
    initialZoom: 12.2,
  };
}
