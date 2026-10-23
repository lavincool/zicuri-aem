"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportCategory } from "@/config/categories";
import type {
  ReportFeatureCollection,
  SinceOption,
  StatusFilter,
} from "@/features/reports/schema";
import { snapBbox } from "@/lib/geo";
import type { MapView } from "../components/flood-map";

export type ReportFilters = {
  categories: ReportCategory[];
  status: StatusFilter;
  since: SinceOption;
};

export const EMPTY_COLLECTION: ReportFeatureCollection = {
  type: "FeatureCollection",
  truncated: false,
  features: [],
};

const REFRESH_MS = 15_000;
const DEBOUNCE_MS = 250;

function feedUrl(view: MapView, filters: ReportFilters): string {
  const params = new URLSearchParams({
    bbox: snapBbox(view.bbox, view.zoom).join(","),
    status: filters.status,
    since: filters.since,
  });
  if (filters.categories.length > 0) {
    params.set("categories", [...filters.categories].sort().join(","));
  }
  return `/api/reports?${params}`;
}

/** Loads reports for the visible area and keeps them fresh while the tab is visible. */
export function useReportsFeed(view: MapView | null, filters: ReportFilters) {
  const [data, setData] = useState<ReportFeatureCollection>(EMPTY_COLLECTION);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [fetching, setFetching] = useState(false);
  const url = view ? feedUrl(view, filters) : null;
  const reloadToken = useRef(0);
  const [reloadCount, setReloadCount] = useState(0);

  const refresh = useCallback(() => {
    reloadToken.current += 1;
    setReloadCount(reloadToken.current);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadCount is an intentional trigger for manual refreshes.
  useEffect(() => {
    if (!url) return;
    let controller: AbortController | null = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      setFetching(true);
      setStatus((current) => (current === "ready" ? current : "loading"));
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setData((await response.json()) as ReportFeatureCollection);
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      } finally {
        setFetching(false);
      }
    };

    const debounce = setTimeout(load, DEBOUNCE_MS);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      controller?.abort();
    };
  }, [url, reloadCount]);

  return { data, status, fetching, refresh };
}
