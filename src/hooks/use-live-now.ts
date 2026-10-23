"use client";

import { useEffect, useState } from "react";

/**
 * Current time for relative labels ("hace 3 min"), refreshed on an interval.
 * `initial` (the server render time) keeps hydration consistent; the client clock
 * takes over right after mount. Only use it in components rendered at request
 * time or on the client, never in a prerendered static shell.
 */
export function useLiveNow(intervalMs = 60_000, initial?: number): Date {
  const [now, setNow] = useState(() => new Date(initial ?? Date.now()));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
