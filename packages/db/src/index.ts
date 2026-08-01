import { Pool } from "pg";
import type { ReadinessProbe } from "@url-shortener/application";

export type ReadinessFailureReporter = (category: "connection" | "query" | "pool") => void;

export class PgReadinessProbe implements ReadinessProbe {
  readonly #pool: Pool;
  readonly #reportFailure: ReadinessFailureReporter;
  #inFlight?: Promise<boolean>;
  #closePromise?: Promise<void>;

  constructor(connectionString: string, timeoutMs = 1_000, reportFailure: ReadinessFailureReporter = () => {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
      throw new RangeError("Readiness timeout must be an integer between 1 and 30000 milliseconds");
    }
    this.#reportFailure = reportFailure;
    this.#pool = new Pool({
      connectionString,
      connectionTimeoutMillis: timeoutMs,
      statement_timeout: timeoutMs,
      query_timeout: timeoutMs,
      max: 1,
    });
    this.#pool.on("error", () => this.#reportFailure("pool"));
  }

  isReady(): Promise<boolean> {
    this.#inFlight ??= this.#run().finally(() => { this.#inFlight = undefined; });
    return this.#inFlight;
  }

  async #run(): Promise<boolean> {
    try {
      await this.#pool.query("SELECT 1");
      return true;
    } catch (error) {
      this.#reportFailure(error instanceof Error && /timeout/i.test(error.message) ? "query" : "connection");
      return false;
    }
  }

  close(): Promise<void> {
    return this.#closePromise ??= this.#pool.end();
  }
}

export { createDb, type DbHandle } from "./create-db.js";
export { runMigrations } from "./migrate.js";
export * as authSchema from "./schema/auth-schema.js";
