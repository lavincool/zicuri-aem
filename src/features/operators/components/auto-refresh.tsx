"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server data while the tab is visible, so a rising level shows up. */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
