import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { join } from "node:path";
import * as schema from "./schema";

export type DB = LibSQLDatabase<typeof schema>;

let client: Client | null = null;
let dbInstance: DB | null = null;
let initPromise: Promise<DB> | null = null;

/**
 * Finds the database URL from the environment. The canonical name is
 * TURSO_DATABASE_URL, but hosting integrations (e.g. Vercel's Turso/Storage
 * integration with a custom prefix) create the variables under different
 * names — so accept any plausible name that holds a libsql/http(s) URL.
 */
function findDbUrl(): string | undefined {
  const exact = process.env.TURSO_DATABASE_URL;
  if (exact) return exact;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (!/^(libsql|https?|wss?):\/\//.test(value)) continue;
    if (/TURSO.*URL|DATABASE_URL|STORAGE.*URL|.*_DB_URL/.test(key)) return value;
    if (value.includes("turso.io")) return value;
  }
  return undefined;
}

/** Finds the database auth token under any plausible variable name. */
function findDbToken(): string | undefined {
  const exact = process.env.TURSO_AUTH_TOKEN;
  if (exact) return exact;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/TURSO.*TOKEN|DATABASE.*TOKEN|STORAGE.*TOKEN|.*_DB_TOKEN/.test(key)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Returns the shared Drizzle client. The first call applies the SQL
 * migrations in ./drizzle (so a fresh Turso database works with no manual
 * step) and seeds the default records.
 *
 * Connection: a Turso (libSQL) URL from the environment when present,
 * otherwise a local SQLite file for development. On serverless hosts the
 * project directory is read-only, so the local fallback lives in /tmp.
 */
export function getDb(): Promise<DB> {
  if (!initPromise) {
    initPromise = (async () => {
      const url =
        findDbUrl() ||
        (process.env.VERCEL ? "file:/tmp/local.db" : "file:./local.db");
      const authToken = findDbToken();
      client = createClient({ url, authToken });
      dbInstance = drizzle(client, { schema });
      await migrate(dbInstance, {
        migrationsFolder: join(process.cwd(), "drizzle"),
      });
      const { ensureSeed } = await import("@/server/helpers");
      await ensureSeed(dbInstance);
      return dbInstance;
    })();
  }
  return initPromise;
}
