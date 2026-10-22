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
 * Returns the shared Drizzle client. The first call applies the SQL
 * migrations in ./drizzle (so a fresh Turso database or a fresh local
 * file works with no manual step) and seeds the default records.
 *
 * Connection: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN when set, otherwise a
 * local SQLite file (./local.db) for development.
 */
export function getDb(): Promise<DB> {
  if (!initPromise) {
    initPromise = (async () => {
      const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
      const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
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
