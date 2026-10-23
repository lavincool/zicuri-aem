"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { type LngLat, PILOT } from "@/config/pilot";
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
      initialCenter={fleetCenter(sensors)}
      initialZoom={12.2}
      minZoom={PILOT.minZoom}
      maxZoom={PILOT.maxZoom}
      reports={EMPTY_REPORTS}
      sensors={sensors}
      onSensorClick={(id) => router.push(`/operador/sensores/${id}`)}
      ariaLabel={t("ariaLabel")}
    />
  );
}

function fleetCenter(sensors: DeviceFeatureCollection): LngLat {
  const points = sensors.features.map((f) => f.geometry.coordinates);
  if (points.length === 0) return PILOT.center;
  const [lng, lat] = points.reduce(
    ([x, y], [px, py]) => [x + px, y + py],
    [0, 0],
  );
  return [lng / points.length, lat / points.length];
}
