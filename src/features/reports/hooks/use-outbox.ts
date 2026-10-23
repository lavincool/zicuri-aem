"use client";

import { useCallback, useEffect, useState } from "react";
import { type FlushResult, flushOutbox, outboxSize } from "../client/outbox";

/** Flushes queued reports when the app opens, comes back online or becomes visible. */
export function useOutbox(onFlushed: (result: FlushResult) => void) {
  const [pending, setPending] = useState(0);

  const refreshCount = useCallback(async () => {
    setPending(await outboxSize());
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    const result = await flushOutbox();
    await refreshCount();
    if (result.sent.length > 0 || result.failed.length > 0) onFlushed(result);
  }, [onFlushed, refreshCount]);

  useEffect(() => {
    void refreshCount().then(flush);
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush, refreshCount]);

  return { pending, flush, refreshCount };
}
