/**
 * Verifies the configuration without printing any secret: env schema, database,
 * migrations, and (with STORAGE_DRIVER=r2) a full presign → PUT → public GET →
 * delete round-trip plus the bucket's CORS rule for the app origin.
 *
 * Usage: bun run check:env [-- --origin https://your-app.vercel.app]
 */
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

const { values } = parseArgs({ options: { origin: { type: "string" } } });

let failures = 0;
const ok = (message: string) => console.log(`  \x1b[32m✓\x1b[0m ${message}`);
const fail = (message: string) => {
  failures += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${message}`);
};
const info = (message: string) => console.log(`  · ${message}`);

console.log("\nEnvironment");
let config: ReturnType<typeof env>;
try {
  config = env();
  ok("Environment variables are valid");
} catch (error) {
  fail((error as Error).message);
  process.exit(1);
}
const dbKind = config.TURSO_DATABASE_URL.startsWith("file:")
  ? "local SQLite file"
  : "remote Turso database";
info(`Database: ${dbKind}`);
info(`Photo storage: ${config.STORAGE_DRIVER}`);
info(`Reverse geocoding: ${config.GEOCODER_CONTACT_EMAIL ? "on" : "off"}`);
info(
  `Authorities panel: ${config.PANEL_PASSWORD ? "on" : "off (set PANEL_PASSWORD)"}`,
);
info(
  `Forecast cron secret: ${config.CRON_SECRET ? "set" : "missing (set CRON_SECRET)"}`,
);
info(
  `Operator sign-in email: ${config.EMAIL_DRIVER} (magic links are printed to the server log)`,
);
info(
  `AI suggestions: ${config.AI_SUGGESTIONS_ENABLED && config.OPENAI_API_KEY ? `on (${config.OPENAI_MODEL})` : "off"}`,
);

console.log("\nDatabase");
try {
  await db().run(sql`select 1`);
  ok("Connected");
  const [row] = await db().all<{ total: number }>(
    sql`select count(*) as total from reports`,
  );
  ok(`Migrations applied (${row?.total ?? 0} reports)`);
} catch (error) {
  fail(`Database check failed: ${(error as Error).message}`);
  info("Run `bun run db:migrate` against this database.");
}

console.log("\nPhoto storage");
if (config.STORAGE_DRIVER !== "r2") {
  info("Local driver: files go to ./.uploads (development only).");
} else {
  const origin = values.origin ?? config.NEXT_PUBLIC_APP_URL;
  const key = `healthchecks/${crypto.randomUUID()}.jpg`;
  try {
    const { url, headers } = await storage().presignPut(key, "image/jpeg", 120);
    ok("Presigned a PUT URL");

    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const allowed = preflight.headers.get("access-control-allow-origin");
    if (allowed === origin || allowed === "*") {
      ok(`CORS allows browser uploads from ${origin}`);
    } else {
      fail(
        `CORS does not allow ${origin} (see README → "R2 CORS rule"; got ${allowed ?? "no header"})`,
      );
    }

    const put = await fetch(url, {
      method: "PUT",
      headers,
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });
    if (put.ok) ok("Uploaded a test object");
    else fail(`Upload failed with HTTP ${put.status}`);

    const head = await storage().head(key);
    if (head) ok("Object is visible to the server (HeadObject)");
    else fail("Uploaded object not found with HeadObject");

    const publicUrl = `${config.R2_PUBLIC_BASE_URL?.replace(/\/$/, "")}/${key}`;
    const pub = await fetch(publicUrl);
    if (pub.ok) ok("Public URL serves the object");
    else
      fail(`Public URL returned HTTP ${pub.status} (check R2_PUBLIC_BASE_URL)`);

    await storage().delete(key);
    ok("Deleted the test object");
  } catch (error) {
    fail(`R2 check failed: ${(error as Error).message}`);
  }
}

console.log(
  failures === 0
    ? "\n\x1b[32mAll checks passed.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
