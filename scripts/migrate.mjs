/**
 * Applies the SQL migrations in ./drizzle to the configured database.
 * Usage: npm run db:migrate
 * Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from the environment (or
 * .env.local); falls back to a local file database when unset.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvLocal() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({ url, authToken });
const db = drizzle(client);
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

await migrate(db, { migrationsFolder });
console.log(`Migrations applied to ${url.startsWith("file:") ? url : "Turso database"}.`);
