/**
 * Demo scenarios for Matamoros and Zacatecas–Guadalupe: reports on real streets and drains
 * (data/scenario-places.json), with openly licensed photos that match each problem and notes
 * written the way residents type them. It asks what to seed, or takes flags.
 *
 * Usage:
 *   bun run seed:scenario                                   # interactive
 *   bun run seed:scenario -- --city zacatecas --scenario storm --density normal --live 20 --yes
 *   bun run seed:scenario -- --clear --yes                  # remove every scenario report
 *
 * Scenarios:
 *   storm       It has rained for ~3 h and the water keeps rising (warnings from the days before)
 *   aftermath   The storm was the night before last: water drained except in low spots; sewage, covers, debris
 *   prevention  Before the rain: two weeks of clogged drains and open manholes, some already cleaned
 *   season      60 days with two storms, for history and trends
 *
 * --live N keeps adding reports and confirmations every ~N seconds (Ctrl+C stops), so pins appear
 * on the map while you present. Rows use source = 'seed' and a "scenario:<city>:" client request
 * id: a new run replaces only scenario reports, and `bun run seed` data stays unless you clear it.
 */
import { parseArgs } from "node:util";
import { and, eq, gt, inArray, isNull, like, notLike, or } from "drizzle-orm";
import { isTransientCategory, type ReportCategory } from "@/config/categories";
import type { DemoCity } from "@/config/demo-photos";
import { recordSignal } from "@/features/reports/server/commands";
import { type Database, db } from "@/lib/db/client";
import {
  type NewReport,
  reportFlags,
  reportSignals,
  reportStatusEvents,
  reports,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import placesFile from "../data/scenario-places.json";
import { writeIllustrations } from "./lib/illustrations";
import { type PhotoSet, photosFor } from "./lib/photos";
import {
  clientPrefix,
  createScenarioGenerator,
  SCENARIOS,
  type Scenario,
} from "./lib/scenario";
import {
  SCENARIO_CITIES,
  type ScenarioCity,
  type ScenarioPlace,
} from "./lib/scenario-cities";

const CITIES = ["matamoros", "zacatecas"] as const satisfies DemoCity[];
const DENSITIES = { light: 0.5, normal: 1, heavy: 2 } as const;
type Density = keyof typeof DENSITIES;
/** Zacatecas is smaller and drier; it gets fewer reports for the same scenario. */
const CITY_SCALE: Record<DemoCity, number> = { matamoros: 1, zacatecas: 0.8 };

const PLACES = placesFile.cities as Record<DemoCity, ScenarioPlace[]>;

// ── Options ──────────────────────────────────────────────────────────

const { values: flags } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    city: { type: "string" },
    scenario: { type: "string" },
    density: { type: "string" },
    live: { type: "string" },
    "clear-base": { type: "boolean" },
    "keep-base": { type: "boolean" },
    clear: { type: "boolean" },
    yes: { type: "boolean", short: "y" },
    help: { type: "boolean", short: "h" },
  },
});

const interactive = process.stdin.isTTY && !flags.yes;

function ask<T extends string>(
  question: string,
  options: readonly (readonly [T, string])[],
  fallback: T,
): T {
  if (!interactive) return fallback;
  console.log(`\n${question}`);
  for (const [i, [, label]] of options.entries()) {
    console.log(`  ${i + 1}) ${label}`);
  }
  const index = options.findIndex(([value]) => value === fallback);
  while (true) {
    const answer = prompt(">", String(index + 1));
    if (answer === null) process.exit(0);
    const value = answer.trim();
    if (!value) return fallback;
    const byNumber = options[Number(value) - 1];
    const byName = options.find(([name]) => name === value);
    const selected = (byNumber ?? byName)?.[0];
    if (selected) return selected;
    console.log("Elige el número o el nombre de una opción.");
  }
}

function confirm(question: string, fallback: boolean): boolean {
  if (!interactive) return fallback;
  const response = prompt(`\n${question} ${fallback ? "[S/n]" : "[s/N]"}`);
  if (response === null) process.exit(0);
  const answer = response.trim().toLowerCase();
  if (!answer) return fallback;
  return answer.startsWith("y") || answer.startsWith("s");
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
): T | undefined {
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  console.error(
    `${name} desconocido: "${value}". Opciones: ${allowed.join(", ")}`,
  );
  process.exit(1);
}

// ── Database ─────────────────────────────────────────────────────────

type Writer = Pick<Database, "insert" | "delete" | "select">;

async function chunked<T>(
  rows: T[],
  size: number,
  fn: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function removeReports(ids: string[], database: Writer) {
  // Child rows first: SQLite foreign keys may be off.
  await chunked(ids, 500, async (chunk) => {
    await database
      .delete(reportSignals)
      .where(inArray(reportSignals.reportId, chunk));
    await database
      .delete(reportFlags)
      .where(inArray(reportFlags.reportId, chunk));
    await database
      .delete(reportStatusEvents)
      .where(inArray(reportStatusEvents.reportId, chunk));
    await database.delete(reports).where(inArray(reports.id, chunk));
  });
}

async function seededIds(
  city: DemoCity | null,
  base: boolean,
  database: Writer = db(),
) {
  const rows = await database
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.source, "seed"),
        base
          ? notLike(reports.clientRequestId, "scenario:%")
          : like(
              reports.clientRequestId,
              `${city ? clientPrefix(city) : "scenario:"}%`,
            ),
      ),
    );
  return rows.map((r) => r.id);
}

type Built = ReturnType<ReturnType<typeof createScenarioGenerator>["build"]>;

async function insert(built: Built[], database: Writer) {
  await chunked(
    built.map((b) => b.row),
    100,
    (rows) => database.insert(reports).values(rows),
  );
  await chunked(
    built.flatMap((b) => b.signals),
    200,
    (rows) => database.insert(reportSignals).values(rows),
  );
  await chunked(
    built.flatMap((b) => b.events),
    200,
    (rows) => database.insert(reportStatusEvents).values(rows),
  );
}

// ── Output ───────────────────────────────────────────────────────────

const LABELS: Record<ReportCategory, string> = {
  flooded_street: "Calle inundada",
  blocked_drain: "Alcantarilla tapada",
  broken_cover: "Tapa rota o faltante",
  sewage_backflow: "Brota el drenaje",
  overflowing_canal: "Canal o arroyo desbordado",
  other: "Otro problema",
};

function describe(row: NewReport): string {
  const severity = row.waterDepthCm
    ? ` (${row.waterDepthCm} cm)`
    : row.severityDetail
      ? ` (${row.severityDetail})`
      : "";
  const where = [row.address, row.colonia ?? row.municipality]
    .filter(Boolean)
    .join(", ");
  return `${LABELS[row.category]}${severity} · ${where}`;
}

function summary(city: ScenarioCity, built: Built[]) {
  const by = (key: (b: Built) => string) =>
    Object.entries(
      built.reduce<Record<string, number>>((acc, b) => {
        acc[key(b)] = (acc[key(b)] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${n} ${k}`)
      .join(", ");
  console.log(`\n${city.label}: ${built.length} reportes`);
  console.log(`  por tipo:   ${by((b) => LABELS[b.row.category])}`);
  const statuses: Record<string, string> = {
    open: "abiertos",
    resolved: "resueltos",
    expired: "vencidos",
  };
  console.log(
    `  por estado: ${by((b) => statuses[b.row.status ?? "open"] ?? "abiertos")}`,
  );
  const worst = built
    .filter((b) => b.row.status === "open")
    .sort(
      (a, b) =>
        (b.row.severity ?? 0) - (a.row.severity ?? 0) ||
        (b.row.stillThereCount ?? 0) - (a.row.stillThereCount ?? 0),
    )[0];
  if (worst) {
    console.log(`  abre este: ${describe(worst.row)}`);
    console.log(`              ${env().NEXT_PUBLIC_APP_URL}/r/${worst.row.id}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function live(
  scenario: Scenario,
  cities: ScenarioCity[],
  everySeconds: number,
) {
  const start = Date.now();
  const gen = createScenarioGenerator(start, start, PLACES);
  const { between, chance, pick, hex } = gen.rng;
  const photos = Object.fromEntries(
    cities.map((c) => [c.id, photosFor(c.id)]),
  ) as Record<DemoCity, PhotoSet>;
  let added = 0;
  let signals = 0;
  let stopped = false;
  const stopController = new AbortController();
  const stop = () => {
    stopped = true;
    stopController.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(
    `\nEn vivo: un reporte o voto cada ~${everySeconds} s. El mapa se actualiza cada 15 s. Ctrl+C para detener.`,
  );
  while (!stopped) {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        stopController.signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, between(0.6, 1.4) * everySeconds * 1000);
      stopController.signal.addEventListener("abort", done, { once: true });
    });
    if (stopped) break;
    const city = pick(cities);
    const time = new Date().toLocaleTimeString("es-MX", {
      timeZone: city.timeZone,
    });
    // Neighbors confirm what is already on the map about a third of the time.
    if (chance(0.35)) {
      const open = await db()
        .select({
          id: reports.id,
          category: reports.category,
          address: reports.address,
          colonia: reports.colonia,
        })
        .from(reports)
        .where(
          and(
            eq(reports.status, "open"),
            eq(reports.source, "seed"),
            or(isNull(reports.expiresAt), gt(reports.expiresAt, new Date())),
            like(reports.clientRequestId, `${clientPrefix(city.id)}%`),
          ),
        );
      const target = open.length ? pick(open) : null;
      if (target) {
        // Crews clean drains in calmer scenarios; during a storm people confirm the water.
        const kind =
          scenario !== "storm" &&
          !isTransientCategory(target.category) &&
          chance(0.4)
            ? "fixed"
            : "still_there";
        try {
          const result = await recordSignal({
            reportId: target.id,
            browserHash: hex(16),
            kind,
          });
          signals++;
          const what =
            kind === "fixed"
              ? result.statusChanged
                ? "resuelto"
                : `ya se arregló (${result.fixedCount} votos)`
              : "sigue ahí";
          console.log(
            `${time}  ${city.id}  ✓ ${what}: ${LABELS[target.category]} · ${[target.address, target.colonia].filter(Boolean).join(", ")}`,
          );
        } catch (error) {
          if (
            !(error instanceof DomainError) ||
            error.code !== "REPORT_NOT_OPEN"
          )
            throw error;
        }
        continue;
      }
    }
    const built = gen.build(
      gen.liveDraft(scenario, city, Date.now() - start),
      photos[city.id],
    );
    await db().transaction((tx) => insert([built], tx));
    added++;
    console.log(
      `${time}  ${city.id}  + ${describe(built.row)}${built.row.note ? ` — “${built.row.note}”` : ""}`,
    );
  }
  console.log(
    `\nModo en vivo detenido: ${added} reportes y ${signals} votos agregados.`,
  );
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}

async function main() {
  if (flags.help) {
    console.log(`Cauce · seed de escenarios

bun run seed:scenario                         Asistente interactivo
bun run seed:scenario --city both --scenario storm --density normal --live 20 --yes

--city         matamoros | zacatecas | both (predeterminado: matamoros)
--scenario     storm | aftermath | prevention | season (predeterminado: storm)
--density      light | normal | heavy (predeterminado: normal)
--live N       Intervalo en segundos; 0 desactiva el modo en vivo
--clear        Borra escenarios; --city limita el borrado a esa ciudad
--clear-base   Retira también los reportes de la seed histórica de Matamoros
--keep-base    Conserva la seed histórica sin preguntar (predeterminado)
--yes, -y      Usa opciones predeterminadas y omite las preguntas
--help, -h     Muestra esta ayuda

Cada ejecución reemplaza únicamente los escenarios de las ciudades elegidas.
Las fotos son ilustrativas y las ubicaciones provienen de OpenStreetMap.
Usa TURSO_DATABASE_URL=file:local.db para una demostración local.`);
    return;
  }
  if (flags["clear-base"] && flags["keep-base"]) {
    throw new Error("Elige --clear-base o --keep-base, no ambos.");
  }
  const requestedCity = oneOf(
    flags.city,
    [...CITIES, "both"] as const,
    "Ciudad",
  );
  const requestedScenario = oneOf(
    flags.scenario,
    Object.keys(SCENARIOS) as Scenario[],
    "Escenario",
  );
  const requestedDensity = oneOf(
    flags.density,
    Object.keys(DENSITIES) as Density[],
    "Densidad",
  );
  const validateInterval = (value: number) => {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      (value > 0 && value < 1) ||
      value > 86_400
    ) {
      throw new Error(
        "--live debe ser 0 o un intervalo entre 1 y 86400 segundos.",
      );
    }
    return value;
  };
  if (flags.live !== undefined) validateInterval(Number(flags.live));
  const database = env().TURSO_DATABASE_URL;
  console.log("Cauce · escenarios de demostración");
  console.log(`Base de datos: ${database.replace(/\?.*$/, "")}`);

  if (flags.clear) {
    const city = requestedCity === "both" ? null : (requestedCity ?? null);
    const ids = await seededIds(city, false);
    if (!confirm(`¿Borrar ${ids.length} reportes de escenarios?`, true)) return;
    await db().transaction((tx) => removeReports(ids, tx));
    console.log(`Se borraron ${ids.length} reportes de escenarios.`);
    return;
  }

  const cityChoice =
    requestedCity ??
    ask(
      "¿Qué ciudad?",
      [
        ["matamoros", SCENARIO_CITIES.matamoros.label],
        ["zacatecas", SCENARIO_CITIES.zacatecas.label],
        ["both", "Ambas ciudades"],
      ] as const,
      "matamoros",
    );
  const scenario =
    requestedScenario ??
    ask(
      "¿Qué escenario?",
      (Object.entries(SCENARIOS) as [Scenario, string][]).map(
        ([id, label]) => [id, `${id.padEnd(11)} ${label}`] as const,
      ),
      "storm",
    );
  const density =
    requestedDensity ??
    ask(
      "¿Cuántos reportes?",
      [
        ["light", "Pocos: la mitad de reportes"],
        ["normal", "Normal: una demostración con actividad"],
        ["heavy", "Muchos: el doble, para ver agrupaciones y la lista"],
      ] as const,
      "normal",
    );
  const ids = cityChoice === "both" ? [...CITIES] : [cityChoice];
  const cities = ids.map((id) => SCENARIO_CITIES[id]);

  let clearBase = Boolean(flags["clear-base"]);
  const baseIds = ids.includes("matamoros") ? await seededIds(null, true) : [];
  if (baseIds.length && !flags["clear-base"] && !flags["keep-base"]) {
    clearBase = !confirm(
      `Matamoros tiene ${baseIds.length} reportes de \`bun run seed\`. ¿Conservarlos en el mapa?`,
      true,
    );
  }

  let liveSeconds = Number(flags.live ?? 0);
  if (flags.live === undefined && interactive) {
    const answer = prompt(
      "\n¿Agregar reportes y votos en vivo? Segundos entre eventos (0 = desactivado):",
      "0",
    );
    if (answer === null) return;
    liveSeconds = Number(answer);
  }
  validateInterval(liveSeconds);

  console.log(
    `\n→ ${scenario} · ${density} · ${cities.map((c) => c.label).join(" + ")}${clearBase ? " · retirando la seed histórica de Matamoros" : ""}${liveSeconds ? ` · en vivo cada ~${liveSeconds} s` : ""}`,
  );
  if (!confirm("¿Crear estos datos?", true)) return;

  await writeIllustrations();
  const now = Date.now();
  const batches: { city: ScenarioCity; built: Built[] }[] = [];
  for (const city of cities) {
    // Same city and scenario → the same reports on every run (times move with "now").
    const gen = createScenarioGenerator(
      [...`${city.id}:${scenario}`].reduce(
        (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
        7,
      ),
      now,
      PLACES,
    );
    const photos = photosFor(city.id);
    const built = gen
      .scenario(scenario, city, DENSITIES[density] * CITY_SCALE[city.id])
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((d) => gen.build(d, photos));
    batches.push({ city, built });
  }
  await db().transaction(async (tx) => {
    for (const { city, built } of batches) {
      await removeReports(await seededIds(city.id, false, tx), tx);
      await insert(built, tx);
    }
    if (clearBase) await removeReports(baseIds, tx);
  });
  for (const { city, built } of batches) summary(city, built);
  if (clearBase) {
    console.log(
      `\nSe retiraron ${baseIds.length} reportes de la seed histórica (\`bun run seed\` los restaura).`,
    );
  }

  if (liveSeconds > 0) await live(scenario, cities, liveSeconds);
}

await main();
process.exit(0);
