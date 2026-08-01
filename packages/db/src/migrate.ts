import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createDb } from "./create-db.js";

const defaultMigrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const migrationLockId = 1_431_520_596;

/** Applies the single forward-only Drizzle chain under a process-safe DB lock. */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string = defaultMigrationsFolder,
): Promise<void> {
  const lock = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });
  await lock.connect();
  const handle = createDb(databaseUrl);
  try {
    await lock.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    await migrate(handle.db, { migrationsFolder });
  } finally {
    await Promise.all([handle.close(), lock.end()]);
  }
}
