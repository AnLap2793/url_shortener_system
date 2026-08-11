import pg from "pg";
import type {
  LoginRateLimitRepository,
  LoginRateLimitRequest,
  LoginRateLimitResult,
  LoginRateLimitScope,
} from "@url-shortener/application";

interface AllowedRow {
  window_started_at: Date;
  attempts: number;
}

interface RetryRow {
  retry_after_seconds: number;
}

/** PostgreSQL-backed admission for all login scopes in one rollback-safe transaction. */
export class PgLoginRateLimitRepository implements LoginRateLimitRepository {
  readonly #pool: pg.Pool;
  #closePromise?: Promise<void>;

  constructor(databaseUrl: string) {
    this.#pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      query_timeout: 10_000,
    });
    this.#pool.on("error", () => {
      // Idle-client errors must not become uncaught process errors during teardown.
    });
  }

  async consume(requests: LoginRateLimitRequest[]): Promise<LoginRateLimitResult> {
    this.validateRequests(requests);
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const rejectedScopes: LoginRateLimitScope[] = [];
      let retryAfterSeconds = 1;
      for (const request of requests) {
        const admitted = await client.query<AllowedRow>(
          `INSERT INTO login_rate_limit AS limiter (scope, key_digest, window_started_at, attempts)
           VALUES ($1, $2, clock_timestamp(), 1)
           ON CONFLICT (scope, key_digest) DO UPDATE
           SET window_started_at = CASE
                 WHEN limiter.window_started_at <= EXCLUDED.window_started_at - make_interval(secs => $3)
                 THEN EXCLUDED.window_started_at ELSE limiter.window_started_at END,
               attempts = CASE
                 WHEN limiter.window_started_at <= EXCLUDED.window_started_at - make_interval(secs => $3)
                 THEN 1 ELSE limiter.attempts + 1 END,
               updated_at = clock_timestamp()
           WHERE limiter.window_started_at <= EXCLUDED.window_started_at - make_interval(secs => $3)
              OR limiter.attempts < $4
           RETURNING window_started_at, attempts`,
          [request.scope, request.keyDigest, request.windowSeconds, request.maximumAttempts],
        );
        if (admitted.rowCount) continue;
        rejectedScopes.push(request.scope);
        const retry = await client.query<RetryRow>(
          `SELECT greatest(1, ceil(extract(epoch FROM
             window_started_at + make_interval(secs => $3) - clock_timestamp())))::integer
             AS retry_after_seconds
           FROM login_rate_limit WHERE scope = $1 AND key_digest = $2`,
          [request.scope, request.keyDigest, request.windowSeconds],
        );
        retryAfterSeconds = Math.max(retryAfterSeconds, retry.rows[0]?.retry_after_seconds ?? 1);
      }
      if (rejectedScopes.length) {
        await client.query("ROLLBACK");
        return { allowed: false, retryAfterSeconds, rejectedScopes };
      }
      await client.query("COMMIT");
      return { allowed: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  close(): Promise<void> {
    return (this.#closePromise ??= this.#pool.end());
  }

  validateRequests(requests: LoginRateLimitRequest[]): void {
    if (!requests.length || new Set(requests.map((request) => request.scope)).size !== requests.length) {
      throw new RangeError("Login rate limit requests require unique scopes");
    }
    for (const request of requests) {
      if (!/^[a-f0-9]{64}$/.test(request.keyDigest)
        || !Number.isSafeInteger(request.windowSeconds) || request.windowSeconds < 1
        || !Number.isSafeInteger(request.maximumAttempts) || request.maximumAttempts < 1) {
        throw new RangeError("Login rate limit request is invalid");
      }
    }
  }
}
