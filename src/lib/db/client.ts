import "server-only";
import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  cauceDb?: { client: Client; db: Database };
};

/** Lazily created database handle; the same code serves file:local.db and libsql:// URLs. */
export function db(): Database {
  if (!globalForDb.cauceDb) {
    const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = env();
    const client = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN,
    });
    globalForDb.cauceDb = { client, db: drizzle(client, { schema }) };
  }
  return globalForDb.cauceDb.db;
}

export { schema };
