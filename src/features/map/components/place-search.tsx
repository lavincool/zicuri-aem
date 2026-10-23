"use client";

import { LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type PlaceIndex,
  type PlaceResult,
  preparePlaces,
  searchPlaces,
} from "../place-search";

type Entries = ReturnType<typeof preparePlaces>;

let places: Promise<Entries> | null = null;

/** The index (~75 KB gzipped) loads the first time someone opens the search. */
function loadPlaces(): Promise<Entries> {
  places ??= fetch("/data/places-mx.json")
    .then((response) => {
      if (!response.ok) throw new Error(`places returned ${response.status}`);
      return response.json() as Promise<PlaceIndex>;
    })
    .then(preparePlaces)
    .catch((error: unknown) => {
      places = null;
      throw error;
    });
  return places;
}

export function PlaceSearch({
  open,
  onOpenChange,
  onSelect,
  onLocate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (place: PlaceResult) => void;
  onLocate: () => void;
}) {
  const t = useTranslations("search");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entries | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    loadPlaces().then(setEntries, () => setFailed(true));
  }, []);

  useEffect(() => {
    if (open && !entries) load();
  }, [open, entries, load]);

  const results = useMemo(
    () => (entries ? searchPlaces(entries, query) : []),
    [entries, query],
  );

  const choose = (place: PlaceResult) => {
    onSelect(place);
    onOpenChange(false);
    setQuery("");
  };

  const secondary = (place: PlaceResult) =>
    place.state === null
      ? t("state")
      : place.state === place.name
        ? t("city")
        : place.state;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[max(env(safe-area-inset-top),0.75rem)] max-w-[calc(100%-1.5rem)] translate-y-0 gap-3 rounded-3xl p-3 sm:max-w-md data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("hint")}</DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const first = results[0];
            if (first) choose(first);
          }}
          className="flex items-center gap-2 rounded-full bg-muted px-4 ring-1 ring-foreground/10 focus-within:ring-2 focus-within:ring-ring"
        >
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("title")}
            aria-controls={listId}
            className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </form>

        <div
          id={listId}
          aria-live="polite"
          className="max-h-[60dvh] overflow-y-auto"
        >
          {failed ? (
            <div className="space-y-2 p-3 text-sm">
              <p>{t("failed")}</p>
              <button
                type="button"
                onClick={load}
                className="font-semibold underline underline-offset-4"
              >
                {t("retry")}
              </button>
            </div>
          ) : !query.trim() ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onLocate();
                  onOpenChange(false);
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left font-semibold hover:bg-muted"
              >
                <LocateFixed className="size-5 shrink-0 text-foreground" />
                {t("useLocation")}
              </button>
              <p className="px-3 pb-1 text-sm text-muted-foreground">
                {t("hint")}
              </p>
            </div>
          ) : !entries ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("loading")}
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => choose(place)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <MapPin className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {place.name}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {secondary(place)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
