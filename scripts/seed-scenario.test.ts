import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { reports } from "@/lib/db/schema";
import placesFile from "../data/scenario-places.json";
import { photosFor } from "./lib/photos";
import { createScenarioGenerator } from "./lib/scenario";
import { SCENARIO_CITIES, type ScenarioPlace } from "./lib/scenario-cities";

test("CLI replaces and clears only selected demo reports, and rolls back failed replacements", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cauce-scenario-test-"));
  const url = `file:${path.join(dir, "test.db")}`;
  const client = createClient({ url });
  const database = drizzle(client);
  const run = async (...args: string[]) => {
    const child = Bun.spawn(
      [process.execPath, "run", "seed:scenario", ...args, "--yes"],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: {
          ...process.env,
          TURSO_DATABASE_URL: url,
          TURSO_AUTH_TOKEN: "",
          SESSION_SECRET: "scenario-test-secret-only",
          STORAGE_DRIVER: "local",
          TURNSTILE_SECRET: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [output, errors, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { code, output: output + errors };
  };
  const rows = async () =>
    (
      await client.execute(
        "SELECT id, client_request_id FROM reports ORDER BY id",
      )
    ).rows;
  try {
    await migrate(database, {
      migrationsFolder: path.resolve(import.meta.dir, "../drizzle"),
    });
    const gen = createScenarioGenerator(
      42,
      Date.now(),
      placesFile.cities as Record<"matamoros" | "zacatecas", ScenarioPlace[]>,
    );
    const draft = gen
      .scenario("prevention", SCENARIO_CITIES.matamoros, 1)
      .find((d) => d.category === "blocked_drain");
    if (!draft) throw new Error("Missing fixture");
    const fixture = gen.build(draft, photosFor("matamoros")).row;
    await database.insert(reports).values([
      {
        ...fixture,
        id: "rpt_real_keep",
        clientRequestId: "real-report",
        source: "web",
      },
      {
        ...fixture,
        id: "rpt_base_keep",
        clientRequestId: "historical-seed",
        source: "seed",
      },
    ]);
    const initial = await run("--city", "both", "--scenario", "storm");
    expect(initial.code, initial.output).toBe(0);
    const first = await rows();
    const zacatecas = first.filter((r) =>
      String(r.client_request_id).startsWith("scenario:zacatecas:"),
    );
    expect(zacatecas.length).toBeGreaterThan(20);
    expect(first.some((r) => r.id === "rpt_real_keep")).toBe(true);
    expect(first.some((r) => r.id === "rpt_base_keep")).toBe(true);

    const replace = await run(
      "--city",
      "matamoros",
      "--scenario",
      "prevention",
    );
    expect(replace.code, replace.output).toBe(0);
    expect(
      (await rows()).filter((r) =>
        String(r.client_request_id).startsWith("scenario:zacatecas:"),
      ),
    ).toEqual(zacatecas);
    const beforeFailure = await rows();
    await client.execute(
      "CREATE TRIGGER reject_scenario BEFORE INSERT ON reports WHEN NEW.client_request_id LIKE 'scenario:zacatecas:%' BEGIN SELECT RAISE(ABORT, 'test insertion failure'); END",
    );
    const failed = await run("--city", "both", "--scenario", "aftermath");
    expect(failed.code).not.toBe(0);
    expect(await rows()).toEqual(beforeFailure);
    await client.execute("DROP TRIGGER reject_scenario");

    for (const args of [
      ["--live", "NaN"],
      ["--live", "-10"],
      ["--city", "unknown"],
      ["--clear-base", "--keep-base"],
    ]) {
      expect((await run(...args)).code).not.toBe(0);
      expect(await rows()).toEqual(beforeFailure);
    }
    const clearCity = await run("--clear", "--city", "matamoros");
    expect(clearCity.code, clearCity.output).toBe(0);
    expect(
      (await rows()).filter((r) =>
        String(r.client_request_id).startsWith("scenario:matamoros:"),
      ),
    ).toHaveLength(0);
    expect(
      (await rows()).filter((r) =>
        String(r.client_request_id).startsWith("scenario:zacatecas:"),
      ),
    ).toEqual(zacatecas);

    const clearBase = await run(
      "--city",
      "matamoros",
      "--scenario",
      "prevention",
      "--clear-base",
    );
    expect(clearBase.code, clearBase.output).toBe(0);
    expect((await rows()).some((r) => r.id === "rpt_base_keep")).toBe(false);
    const clear = await run("--clear");
    expect(clear.code, clear.output).toBe(0);
    expect((await rows()).map((r) => r.id)).toEqual(["rpt_real_keep"]);
    for (const table of [
      "report_signals",
      "report_status_events",
      "report_flags",
    ]) {
      expect(
        (await client.execute(`SELECT count(*) AS total FROM ${table}`)).rows[0]
          ?.total,
      ).toBe(0);
    }
  } finally {
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
}, 30_000);
