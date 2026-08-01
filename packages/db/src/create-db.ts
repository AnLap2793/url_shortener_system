import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

export interface DbHandle {
  db: NodePgDatabase<Record<string, never>>;
  /** Closes the underlying pool; idempotent. */
  close(): Promise<void>;
}

/**
 * Single bounded-pool Drizzle factory for the API/worker composition roots.
 * Timeouts mirror the readiness-probe posture: never hang on a dead database.
 */
export function createDb(databaseUrl: string): DbHandle {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 10_000,
  });
  pool.on("error", () => {
    // Idle-client errors must never crash the process; queries surface their own errors.
  });
  let closePromise: Promise<void> | undefined;
  return {
    db: drizzle(pool),
    close: () => (closePromise ??= pool.end()),
  };
}
