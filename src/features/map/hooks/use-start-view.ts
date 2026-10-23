"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import {
  CITY_ZOOM,
  isInsideServiceArea,
  type LngLat,
  MEXICO_VIEW,
} from "@/config/service-area";
import { readFlag, writeFlag } from "@/features/onboarding/storage";

export type StartView = { center: LngLat; zoom: number };

const VIEW_KEY = "cauce:map-view";
/** The map waits this long for the IP lookup before opening on all of Mexico. */
const LOOKUP_TIMEOUT_MS = 1500;

const lngLat = z.tuple([z.number(), z.number()]);
const savedViewSchema = z.object({ center: lngLat, zoom: z.number() });
const approxResponseSchema = z.object({ center: lngLat.nullable() });

function readSavedView(): StartView | null {
  try {
    const parsed = savedViewSchema.safeParse(
      JSON.parse(readFlag(VIEW_KEY) ?? "null"),
    );
    if (!parsed.success) return null;
    const [lng, lat] = parsed.data.center;
    return isInsideServiceArea(lng, lat) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveView(view: StartView): void {
  const [lng, lat] = view.center;
  writeFlag(
    VIEW_KEY,
    JSON.stringify({
      center: [Number(lng.toFixed(5)), Number(lat.toFixed(5))],
      zoom: Number(view.zoom.toFixed(2)),
    }),
  );
}

async function fetchApproxCenter(signal: AbortSignal): Promise<LngLat | null> {
  try {
    const response = await fetch("/api/geo", { signal });
    if (!response.ok) return null;
    const parsed = approxResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.center : null;
  } catch {
    return null;
  }
}

/**
 * Where the map opens: a deep link's pin, else the last view on this device, else
 * the visitor's approximate city (from their IP), else all of Mexico.
 * Null while the IP lookup runs.
 */
export function useStartView(focus: LngLat | null): StartView | null {
  const [view, setView] = useState<StartView | null>(() =>
    focus ? { center: focus, zoom: 16 } : null,
  );

  useEffect(() => {
    if (focus) return;
    const saved = readSavedView();
    if (saved) {
      setView(saved);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      LOOKUP_TIMEOUT_MS,
    );
    void fetchApproxCenter(controller.signal).then((center) => {
      window.clearTimeout(timer);
      if (cancelled) return;
      setView(center ? { center, zoom: CITY_ZOOM } : MEXICO_VIEW);
    });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [focus]);

  return view;
}
