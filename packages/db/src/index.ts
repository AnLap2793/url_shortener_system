import { Pool } from "pg";
import type { ReadinessProbe } from "@url-shortener/application";

export class PgReadinessProbe implements ReadinessProbe {
  readonly #pool: Pool;

  constructor(connectionString: string, timeoutMs = 1_000) {
    this.#pool = new Pool({
      connectionString,
      connectionTimeoutMillis: timeoutMs,
      statement_timeout: timeoutMs,
      max: 1,
    });
  }

  async isReady(): Promise<boolean> {
    try {
      await this.#pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}
