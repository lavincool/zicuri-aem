"use client";

import { useEffect } from "react";

/** Registers the service worker in production only (it would fight HMR in dev). */
export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Offline support is an enhancement; the app works without it.
      });
  }, []);
  return null;
}
