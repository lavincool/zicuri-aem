"use client";

import { useEffect, useState } from "react";
import type { DeviceFeatureCollection } from "@/features/devices/schema";
import { snapBbox } from "@/lib/geo";
import type { MapView } from "../components/flood-map";

const EMPTY: DeviceFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
/** Sensors change faster than reports, so they refresh more often. */
const REFRESH_MS = 5_000;

/** `scope: "panel"` includes private sensors when the authorities panel session is valid. */
export function useSensorsFeed(
  view: MapView | null,
  { scope }: { scope?: "panel" } = {},
) {
  const [data, setData] = useState<DeviceFeatureCollection>(EMPTY);
  const url = view
    ? `/api/devices?bbox=${snapBbox(view.bbox, Math.min(view.zoom, 12)).join(",")}${scope ? `&scope=${scope}` : ""}`
    : null;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok)
          setData((await response.json()) as DeviceFeatureCollection);
      } catch {
        // Keep the last known sensors while offline.
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
  }, [url]);

  return data;
}
