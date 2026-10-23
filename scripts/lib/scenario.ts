/** Pure scenario generation; database writes and prompts live in seed-scenario.ts. */
import {
  isTransientCategory,
  normalizeSeverity,
  type ReportCategory,
  type SeverityDetail,
} from "@/config/categories";
import type { DemoCity } from "@/config/demo-photos";
import { SIGNAL_WINDOW_MS, TRANSIENT_TTL_MS } from "@/features/reports/rules";
import type {
  NewReport,
  reportSignals,
  reportStatusEvents,
} from "@/lib/db/schema";
import { offsetMeters } from "@/lib/geo";
import { h3Cells } from "@/lib/h3";
import { prefixedId, reportId } from "@/lib/ids";
import { matchingPhoto, type PhotoSet } from "./photos";
import { createRandom } from "./random";
import type { ScenarioCity, ScenarioPlace } from "./scenario-cities";
import { scenarioNote } from "./scenario-notes";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SCENARIOS = {
  storm: "Tormenta en curso: llueve desde hace 3 h y el agua sigue subiendo",
  aftermath:
    "Después de la tormenta: quedan encharcamientos, drenaje, tapas y basura",
  prevention:
    "Antes de la lluvia: dos semanas de coladeras tapadas y registros abiertos",
  season:
    "Temporada: 60 días con dos tormentas, para ver historia y tendencias",
} as const;
export type Scenario = keyof typeof SCENARIOS;
export const clientPrefix = (city: DemoCity) => `scenario:${city}:`;

type Draft = {
  city: ScenarioCity;
  place: ScenarioPlace;
  category: ReportCategory;
  createdAt: number;
  waterDepthCm: number | null;
  severityDetail: SeverityDetail | null;
  /** Times someone tapped "Sigue ahí". */
  confirmations: number[];
  /** When neighbors confirmed it was fixed (two "Ya se arregló"). */
  resolvedAt: number | null;
  /** Restricts the photo to these files (other-category scenes). */
  photos?: readonly string[];
};

type SignalRow = typeof reportSignals.$inferInsert;
type EventRow = typeof reportStatusEvents.$inferInsert;

export function createScenarioGenerator(
  seed: number,
  now: number,
  places: Record<DemoCity, ScenarioPlace[]>,
) {
  const rng = createRandom(seed);
  const { random, between, int, chance, pick, weighted, hex } = rng;

  function placeFor(
    city: ScenarioCity,
    kind: ScenarioPlace["kind"],
    hot = false,
  ): ScenarioPlace {
    const points = places[city.id].filter((p) => p.kind === kind);
    if (!points.length) {
      throw new Error(
        `Faltan ubicaciones de tipo ${kind} en ${city.id}. Ejecuta bun run data:scenario-places.`,
      );
    }
    const weightOf = (p: ScenarioPlace) => {
      const w = city.areas.find((a) => a.name === p.area)?.weight ?? 1;
      return hot ? w * w : w;
    };
    return weighted(points.map((p) => [p, weightOf(p)] as const));
  }

  function hotness(city: ScenarioCity, place: ScenarioPlace): number {
    const w = city.areas.find((a) => a.name === place.area)?.weight ?? 1;
    return Math.min(w / 3, 1);
  }

  /** Water depth for a moment of the storm: 0 = first drops, 1 = peak in a low spot. */
  function depth(intensity: number): number | null {
    if (chance(0.1)) return null;
    const i = Math.max(0, Math.min(1, intensity));
    return weighted([
      [5, 5 - 4 * i],
      [15, 4 - i],
      [45, 0.5 + 3.5 * i],
      [80, 2.5 * i * i],
    ] as const);
  }

  function detail(
    category: ReportCategory,
    severe: number,
  ): SeverityDetail | null {
    if (chance(0.12)) return null;
    if (category === "blocked_drain")
      return chance(severe) ? "full" : "partial";
    if (category === "broken_cover")
      return chance(severe) ? "missing" : "damaged";
    return null;
  }

  /** Moves a timestamp into local waking hours (7:00–22:00). */
  function daytime(city: ScenarioCity, at: number): number {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: city.timeZone,
      }).format(at),
    );
    if (hour >= 7 && hour < 22) return at;
    const shift =
      hour < 7 ? 7 - hour + between(0, 3) : -(hour - 21) - between(0, 2);
    return Math.min(at + shift * HOUR, now - 10 * MINUTE);
  }

  function confirmations(from: number, until: number, count: number) {
    if (until <= from) return [];
    return Array.from({ length: count }, () => between(from, until)).sort(
      (a, b) => a - b,
    );
  }

  function draft(
    city: ScenarioCity,
    category: ReportCategory,
    createdAt: number,
    opts: {
      hot?: boolean;
      intensity?: number;
      severe?: number;
      confirmUntil?: number;
      maxConfirmations?: number;
      /** The last confirmation lands at `confirmUntil` (water that will not drain). */
      keepAlive?: boolean;
      /** Older drains and covers may have been cleaned already. */
      resolvable?: boolean;
      photos?: readonly string[];
    } = {},
  ): Draft {
    const kind = category === "overflowing_canal" ? "water" : "street";
    const place = placeFor(city, kind, opts.hot);
    const transient = isTransientCategory(category);
    const intensity =
      (opts.intensity ?? 0.3) * (0.55 + 0.45 * hotness(city, place));
    const ageDays = (now - createdAt) / DAY;
    // Crews get to more of them the longer they wait (15 % + 3 %/day, at most 60 %).
    const resolvedAt =
      opts.resolvable &&
      !transient &&
      ageDays > 2 &&
      chance(Math.min(0.15 + ageDays * 0.03, 0.6))
        ? daytime(
            city,
            createdAt + between(1, Math.min(ageDays - 0.5, 12)) * DAY,
          )
        : null;
    const until = Math.min(
      resolvedAt ??
        opts.confirmUntil ??
        createdAt + (transient ? 6 * HOUR : 6 * DAY),
      now - 2 * MINUTE,
      transient && !opts.keepAlive ? createdAt + 18 * HOUR : Infinity,
    );
    const max =
      opts.maxConfirmations ?? (transient ? 2 + Math.round(intensity * 5) : 4);
    const seen = confirmations(createdAt + 10 * MINUTE, until, int(0, max));
    if (opts.keepAlive && until > createdAt) {
      seen.push(until);
      // A signal cannot revive an already expired report. Keep a continuous history.
      let previous = createdAt;
      const continuous: number[] = [];
      for (const at of seen) {
        while (transient && at - previous >= TRANSIENT_TTL_MS) {
          previous += 18 * HOUR;
          continuous.push(previous);
        }
        continuous.push(at);
        previous = at;
      }
      seen.splice(0, seen.length, ...continuous);
    }
    return {
      city,
      place,
      category,
      createdAt,
      waterDepthCm: transient ? depth(intensity) : null,
      severityDetail: transient ? null : detail(category, opts.severe ?? 0.55),
      confirmations: seen,
      resolvedAt,
      photos: opts.photos,
    };
  }

  // ── Scenario building blocks ──

  /** A storm from `start` to `end`. `lingering` = share of water reports confirmed until `confirmUntil`. */
  function storm(
    city: ScenarioCity,
    start: number,
    end: number,
    scale: number,
    lingering = 0,
    confirmUntil = end,
  ): Draft[] {
    const out: Draft[] = [];
    const at = (u: number) => start + (end - start) * Math.sqrt(u);
    const water = Math.round(38 * scale);
    for (let i = 0; i < water; i++) {
      const createdAt = at(random());
      const progress = (createdAt - start) / (end - start);
      const category = weighted([
        ["flooded_street", 62],
        ["sewage_backflow", 16],
        ["overflowing_canal", city.id === "zacatecas" ? 10 : 14],
      ] as const);
      const linger = chance(lingering);
      out.push(
        draft(city, category, createdAt, {
          hot: chance(0.6),
          intensity: 0.25 + 0.75 * progress,
          confirmUntil: linger ? confirmUntil : end + 3 * HOUR,
          maxConfirmations: linger ? 7 : undefined,
          keepAlive: linger,
        }),
      );
    }
    for (let i = 0; i < Math.round(9 * scale); i++) {
      out.push(
        draft(city, "blocked_drain", at(random()), {
          hot: true,
          severe: 0.8,
          confirmUntil: end + DAY,
          resolvable: true,
        }),
      );
    }
    for (let i = 0; i < Math.round(3 * scale); i++) {
      out.push(
        draft(city, "broken_cover", at(random()), {
          severe: 0.7,
          resolvable: true,
        }),
      );
    }
    const scenes =
      city.id === "zacatecas"
        ? ["granizo-en-autos", "arbol-caido", "bache-con-agua"]
        : ["arbol-en-calle-inundada", "arbol-caido", "bache-con-agua"];
    for (let i = 0; i < Math.round(4 * scale); i++) {
      out.push(draft(city, "other", at(random()), { photos: scenes }));
    }
    return out;
  }

  /** The hours after a storm: what the water left behind. */
  function aftermath(
    city: ScenarioCity,
    from: number,
    to: number,
    scale: number,
  ): Draft[] {
    const out: Draft[] = [];
    const at = () => daytime(city, between(from, to));
    const mix = [
      ["blocked_drain", 10],
      ["broken_cover", 6],
      ["sewage_backflow", 5],
      ["other", 7],
    ] as const;
    const scenes =
      city.id === "zacatecas"
        ? [
            "calle-deslavada",
            "bache-con-agua",
            "arbol-caido",
            "charco-estancado",
          ]
        : [
            "basura-tras-inundacion",
            "bache-con-agua",
            "arbol-caido",
            "charco-estancado",
          ];
    for (let i = 0; i < Math.round(28 * scale); i++) {
      const category = weighted(mix);
      out.push(
        draft(city, category, at(), {
          hot: chance(0.5),
          intensity: 0.2,
          severe: 0.7,
          confirmUntil: Math.min(to + DAY, now - between(0.2, 3) * HOUR),
          resolvable: true,
          photos: category === "other" ? scenes : undefined,
        }),
      );
    }
    return out;
  }

  /** Everyday upkeep between storms: clogged drains, open manholes, trash in channels. */
  function upkeep(
    city: ScenarioCity,
    from: number,
    to: number,
    scale: number,
  ): Draft[] {
    const out: Draft[] = [];
    for (let i = 0; i < Math.round(36 * scale); i++) {
      const createdAt = daytime(city, between(from, to));
      const category = weighted([
        ["blocked_drain", 48],
        ["broken_cover", 18],
        ["overflowing_canal", 7],
        ["sewage_backflow", 9],
        ["other", 10],
      ] as const);
      out.push(
        draft(city, category, createdAt, {
          intensity: 0.05,
          severe: 0.5,
          confirmUntil: to,
          resolvable: true,
          photos:
            category === "other"
              ? ["charco-estancado", "bache-con-agua", "arbol-caido"]
              : undefined,
        }),
      );
    }
    return out;
  }

  function scenario(id: Scenario, city: ScenarioCity, scale: number): Draft[] {
    switch (id) {
      case "storm":
        return [
          ...upkeep(city, now - 12 * DAY, now - 4 * HOUR, 0.6 * scale),
          ...storm(city, now - 3 * HOUR, now, scale),
        ];
      case "aftermath":
        return [
          ...upkeep(city, now - 12 * DAY, now - 45 * HOUR, 0.6 * scale),
          // Water reports expire 24 h after the last "Sigue ahí", so only low spots stay open.
          ...storm(
            city,
            now - 44 * HOUR,
            now - 34 * HOUR,
            scale,
            0.25,
            now - between(1, 4) * HOUR,
          ),
          ...aftermath(city, now - 33 * HOUR, now - 15 * MINUTE, scale),
        ];
      case "prevention":
        return upkeep(city, now - 14 * DAY, now - 30 * MINUTE, 1.3 * scale);
      case "season": {
        const first = now - 38 * DAY;
        const second = now - 11 * DAY;
        return [
          ...upkeep(city, now - 60 * DAY, now - 30 * MINUTE, 1.6 * scale),
          ...storm(city, first - 9 * HOUR, first, 0.8 * scale),
          ...aftermath(city, first, first + 2 * DAY, 0.4 * scale),
          ...storm(city, second - 7 * HOUR, second, 0.7 * scale),
          ...aftermath(city, second, second + 2 * DAY, 0.4 * scale),
        ];
      }
    }
  }

  /** One report for live mode, shaped like the scenario's present moment. */
  function liveDraft(id: Scenario, city: ScenarioCity, elapsed: number): Draft {
    const at = now + elapsed;
    if (id === "storm" || id === "season") {
      const category = weighted([
        ["flooded_street", 60],
        ["sewage_backflow", 12],
        ["overflowing_canal", 10],
        ["blocked_drain", 12],
        ["other", 6],
      ] as const);
      // The rain keeps getting worse while you present.
      return draft(city, category, now + elapsed, {
        hot: chance(0.7),
        intensity: Math.min(0.75 + elapsed / (20 * MINUTE), 1),
        severe: 0.8,
        photos:
          category === "other"
            ? city.id === "zacatecas"
              ? ["granizo-en-autos", "arbol-caido"]
              : ["arbol-en-calle-inundada", "arbol-caido"]
            : undefined,
      });
    }
    const category = weighted(
      id === "aftermath"
        ? ([
            ["blocked_drain", 10],
            ["broken_cover", 6],
            ["sewage_backflow", 5],
            ["other", 7],
          ] as const)
        : ([
            ["blocked_drain", 48],
            ["broken_cover", 18],
            ["overflowing_canal", 7],
            ["sewage_backflow", 9],
            ["other", 10],
          ] as const),
    );
    return draft(city, category, at, {
      intensity: 0.2,
      severe: 0.7,
      photos:
        category === "other"
          ? id === "aftermath"
            ? [
                city.id === "zacatecas"
                  ? "calle-deslavada"
                  : "basura-tras-inundacion",
                "bache-con-agua",
                "arbol-caido",
                "charco-estancado",
              ]
            : ["charco-estancado", "bache-con-agua", "arbol-caido"]
          : undefined,
    });
  }

  function build(d: Draft, photos: PhotoSet) {
    const id = reportId();
    const transient = isTransientCategory(d.category);
    const scene = photos[d.category].filter((p) =>
      d.photos?.some((slug) => p.key.endsWith(`/${slug}.webp`)),
    );
    const photo = matchingPhoto(
      scene.length ? scene : photos[d.category],
      d,
      pick,
    );
    const waterDepthCm =
      d.waterDepthCm === null ? null : (photo.waterDepthCm ?? d.waterDepthCm);
    const severityDetail =
      d.severityDetail === null
        ? null
        : (photo.severityDetail ?? d.severityDetail);
    const slug =
      photo.key
        .split("/")
        .at(-1)
        ?.replace(/\.\w+$/, "") ?? "";
    const last = d.confirmations.at(-1) ?? null;
    const expiresAt = transient
      ? (last ?? d.createdAt) + TRANSIENT_TTL_MS
      : null;
    const status = d.resolvedAt
      ? "resolved"
      : expiresAt && expiresAt <= now
        ? "expired"
        : "open";
    const statusChangedAt =
      status === "resolved"
        ? (d.resolvedAt as number)
        : status === "expired"
          ? (expiresAt as number)
          : d.createdAt;
    const recentConfirmations = d.resolvedAt
      ? d.confirmations.filter(
          (at) => at >= (d.resolvedAt as number) - SIGNAL_WINDOW_MS,
        ).length
      : 0;
    const fixed = d.resolvedAt ? Math.max(2, recentConfirmations + 1) : 0;
    const source = weighted([
      ["gps", 85],
      ["exif", 5],
      ["manual", 10],
    ] as const);
    const point =
      source === "manual"
        ? { lat: d.place.lat, lng: d.place.lng }
        : offsetMeters(
            d.place.lat,
            d.place.lng,
            between(-6, 6),
            between(-6, 6),
          );
    const area = d.city.areas.find((a) => a.name === d.place.area);
    const reporterHash = hex(16);

    const row: NewReport = {
      id,
      category: d.category,
      severity: normalizeSeverity({
        severityDetail,
        waterDepthCm,
      }),
      severityDetail,
      waterDepthCm,
      note: scenarioNote(
        {
          city: d.city.id,
          category: d.category,
          waterDepthCm,
          severityDetail,
          photo: slug,
          street: d.place.address,
          colonia: d.place.colonia,
          waterway: d.place.waterway,
          local: area?.notes?.[d.category] ?? [],
        },
        random,
      ),
      status,
      lat: point.lat,
      lng: point.lng,
      accuracyM:
        source === "manual"
          ? null
          : Math.round(between(4, source === "exif" ? 40 : 25)),
      locationSource: source,
      ...h3Cells(point.lat, point.lng),
      address: d.place.address,
      colonia: d.place.colonia,
      municipality: d.place.municipality,
      state: d.place.state,
      photoFullKey: photo.key,
      photoThumbKey: photo.thumbKey,
      photoWidth: photo.width,
      photoHeight: photo.height,
      photoColor: photo.color,
      stillThereCount: d.confirmations.length,
      fixedCount: fixed,
      flagCount: 0,
      lastConfirmedAt: last ? new Date(last) : null,
      statusChangedAt: new Date(statusChangedAt),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      resolvedAt: d.resolvedAt ? new Date(d.resolvedAt) : null,
      reporterHash,
      clientRequestId: `${clientPrefix(d.city.id)}${crypto.randomUUID()}`,
      source: "seed",
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(Math.max(d.createdAt, statusChangedAt, last ?? 0)),
    };

    const signals: SignalRow[] = [
      ...d.confirmations.map((t) => ({ kind: "still_there" as const, at: t })),
      ...Array.from({ length: fixed }, (_, i) => ({
        kind: "fixed" as const,
        at:
          (d.resolvedAt as number) -
          ((fixed - 1 - i) / (fixed - 1)) *
            Math.min(3 * HOUR, (d.resolvedAt as number) - d.createdAt),
      })),
    ].map(({ kind, at }) => ({
      id: prefixedId("sig"),
      reportId: id,
      browserHash: hex(16),
      kind,
      createdAt: new Date(at),
      updatedAt: new Date(at),
    }));

    const events: EventRow[] = [
      {
        id: prefixedId("evt"),
        reportId: id,
        fromStatus: null,
        toStatus: "open",
        reason: "created",
        actor: reporterHash,
        createdAt: new Date(d.createdAt),
      },
    ];
    if (status !== "open") {
      events.push({
        id: prefixedId("evt"),
        reportId: id,
        fromStatus: "open",
        toStatus: status,
        reason: status === "resolved" ? "signals" : "expired",
        actor: "system",
        createdAt: new Date(statusChangedAt),
      });
    }
    return { row, signals, events };
  }

  return { rng, scenario, liveDraft, build };
}
