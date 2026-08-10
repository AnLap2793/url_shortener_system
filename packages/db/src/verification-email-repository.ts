import pg from "pg";
import type {
  ClaimedVerificationEmail,
  VerificationEmailEnqueueInput,
  VerificationEmailQueueRepository,
} from "@url-shortener/application";

export class PgVerificationEmailQueueRepository implements VerificationEmailQueueRepository {
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
  }

  async consumeCooldown(keyDigest: string, cooldownSeconds: number) {
    const result = await this.#pool.query<{ reservation_token: string }>(
      `INSERT INTO verification_email_cooldown (key_digest, next_allowed_at, reservation_token)
       VALUES ($1, clock_timestamp() + make_interval(secs => $2), gen_random_uuid()::text)
       ON CONFLICT (key_digest) DO UPDATE
       SET next_allowed_at = clock_timestamp() + make_interval(secs => $2),
           reservation_token = gen_random_uuid()::text,
           updated_at = clock_timestamp()
       WHERE verification_email_cooldown.next_allowed_at <= clock_timestamp()
       RETURNING reservation_token`,
      [keyDigest, cooldownSeconds],
    );
    if (result.rowCount) {
      return { allowed: true, reservationToken: result.rows[0]!.reservation_token };
    }
    const remaining = await this.#pool.query<{
      retry_after_seconds: number;
      reservation_token: string;
    }>(
      `SELECT greatest(1, ceil(extract(epoch FROM next_allowed_at - clock_timestamp())))::integer AS retry_after_seconds,
              reservation_token
       FROM verification_email_cooldown WHERE key_digest = $1`,
      [keyDigest],
    );
    return {
      allowed: false,
      retryAfterSeconds: remaining.rows[0]?.retry_after_seconds ?? 1,
      reservationToken: remaining.rows[0]?.reservation_token,
    };
  }

  async releaseCooldown(keyDigest: string, reservationToken: string): Promise<boolean> {
    const result = await this.#pool.query(
      `DELETE FROM verification_email_cooldown
       WHERE key_digest = $1 AND reservation_token = $2`,
      [keyDigest, reservationToken],
    );
    return result.rowCount === 1;
  }

  async enqueue(input: VerificationEmailEnqueueInput) {
    const result = await this.#pool.query<{ id: string; created: boolean }>(
      `INSERT INTO verification_email_delivery (id, recipient, verification_url, logical_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (logical_key) DO UPDATE SET logical_key = excluded.logical_key
       RETURNING id, (xmax = 0) AS created`,
      [input.id, input.recipient, input.verificationUrl, input.logicalKey],
    );
    return result.rows[0]!;
  }

  async hasDelivery(logicalKey: string): Promise<boolean> {
    const result = await this.#pool.query(
      `SELECT 1 FROM verification_email_delivery WHERE logical_key = $1`,
      [logicalKey],
    );
    return Boolean(result.rowCount);
  }

  async claim(batchSize: number, leaseSeconds: number): Promise<ClaimedVerificationEmail[]> {
    const result = await this.#pool.query<{
      id: string;
      recipient: string;
      verification_url: string;
      logical_key: string;
      attempts: number;
      lease_token: string;
      lease_until: Date;
    }>(
      `WITH candidates AS (
         SELECT id FROM verification_email_delivery
         WHERE attempts < 3
           AND (
             (state = 'pending' AND available_at <= clock_timestamp())
             OR (state = 'leased' AND lease_until <= clock_timestamp())
           )
         ORDER BY available_at, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE verification_email_delivery AS delivery
       SET state = 'leased', attempts = attempts + 1, lease_token = gen_random_uuid()::text,
           lease_until = clock_timestamp() + make_interval(secs => $2), updated_at = clock_timestamp()
       FROM candidates WHERE delivery.id = candidates.id
       RETURNING delivery.id, delivery.recipient, delivery.verification_url, delivery.logical_key,
                 delivery.attempts, delivery.lease_token, delivery.lease_until`,
      [batchSize, leaseSeconds],
    );
    return result.rows.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      verificationUrl: row.verification_url,
      logicalKey: row.logical_key,
      attempt: row.attempts,
      leaseToken: row.lease_token,
      leaseUntil: row.lease_until,
    }));
  }

  complete(id: string, leaseToken: string) {
    return this.#transition(id, leaseToken, "sent", null);
  }

  async retry(id: string, leaseToken: string, availableAt: Date, category: string): Promise<boolean> {
    const result = await this.#pool.query(
      `UPDATE verification_email_delivery
       SET state = 'pending', available_at = $3, lease_token = NULL, lease_until = NULL,
           error_category = $4, updated_at = clock_timestamp()
       WHERE id = $1 AND state = 'leased' AND lease_token = $2`,
      [id, leaseToken, availableAt, category],
    );
    return result.rowCount === 1;
  }

  dead(id: string, leaseToken: string, category: string) {
    return this.#transition(id, leaseToken, "dead", category);
  }

  async #transition(id: string, leaseToken: string, state: "sent" | "dead", category: string | null) {
    const result = await this.#pool.query(
      `UPDATE verification_email_delivery
       SET state = $3, recipient = NULL, verification_url = NULL, lease_token = NULL,
           lease_until = NULL, error_category = $4, updated_at = clock_timestamp()
       WHERE id = $1 AND state = 'leased' AND lease_token = $2`,
      [id, leaseToken, state, category],
    );
    return result.rowCount === 1;
  }

  close(): Promise<void> {
    return (this.#closePromise ??= this.#pool.end());
  }
}
