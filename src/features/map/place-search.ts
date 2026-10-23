import type { LngLat } from "@/config/service-area";

/** public/data/places-mx.json, built by scripts/build-places.ts from GeoNames. */
export type PlaceIndex = {
  v: 1;
  states: [name: string, lng: number, lat: number][];
  places: [
    name: string,
    state: number,
    lng: number,
    lat: number,
    population: number,
  ][];
};

export type PlaceResult = {
  id: string;
  name: string;
  /** The state a town belongs to; null for a state. */
  state: string | null;
  center: LngLat;
  zoom: number;
};

type Entry = PlaceResult & {
  nameWords: string[];
  words: string[];
  rank: number;
};

/** States rank like a town of this size: above small towns, below big cities. */
const STATE_RANK = 100_000;
const ALIASES: Record<string, string> = {
  "Ciudad de México": "cdmx df",
};

export function normalizePlace(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function zoomFor(population: number): number {
  if (population >= 1_000_000) return 10.5;
  if (population >= 200_000) return 11.5;
  if (population >= 20_000) return 12.5;
  return 13.5;
}

/** Normalizes the index once so each keystroke only compares strings. */
export function preparePlaces(index: PlaceIndex): Entry[] {
  const entry = (result: PlaceResult, context: string, rank: number): Entry => {
    const nameWords =
      `${normalizePlace(result.name)} ${ALIASES[result.name] ?? ""}`
        .trim()
        .split(" ");
    return {
      ...result,
      nameWords,
      words: [...nameWords, ...normalizePlace(context).split(" ")],
      rank,
    };
  };
  return [
    ...index.places.map(([name, state, lng, lat, population], i) => {
      const stateName = index.states[state]?.[0] ?? null;
      return entry(
        {
          id: `p${i}`,
          name,
          state: stateName,
          center: [lng, lat] as LngLat,
          zoom: zoomFor(population),
        },
        stateName ?? "",
        population,
      );
    }),
    ...index.states.map(([name, lng, lat], i) =>
      entry(
        {
          id: `s${i}`,
          name,
          state: null,
          center: [lng, lat] as LngLat,
          zoom: 6.5,
        },
        "",
        STATE_RANK,
      ),
    ),
  ];
}

/**
 * Accent-insensitive search: every typed word must start a word of the place or its
 * state. Places matched by name alone rank first, then larger towns.
 */
export function searchPlaces(
  entries: Entry[],
  query: string,
  limit = 8,
): PlaceResult[] {
  const q = normalizePlace(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const scored: { entry: Entry; score: number }[] = [];
  for (const entry of entries) {
    if (!tokens.every((t) => entry.words.some((w) => w.startsWith(t)))) {
      continue;
    }
    const byName = tokens.every((t) =>
      entry.nameWords.some((w) => w.startsWith(t)),
    );
    const score = byName ? 0 : 1;
    scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || b.entry.rank - a.entry.rank)
    .slice(0, limit)
    .map(
      ({ entry: { nameWords: _n, words: _w, rank: _r, ...result } }) => result,
    );
}
