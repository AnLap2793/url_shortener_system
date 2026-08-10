import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import { PgVerificationEmailQueueRepository } from "./verification-email-repository.js";

const integrationUrl = process.env.INTEGRATION_DATABASE_URL;

async function withDatabase(run: (url: string) => Promise<void>): Promise<void> {
  const admin = new pg.Client({ connectionString: integrationUrl });
  await admin.connect();
  const name = `email_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await admin.query(`CREATE DATABASE ${name}`);
  try {
    const url = new URL(integrationUrl!);
    url.pathname = `/${name}`;
    await runMigrations(url.toString());
    await run(url.toString());
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
}

const delivery = (logicalKey: string) => ({
  id: randomUUID(),
  logicalKey,
  recipient: "marketer@example.com",
  verificationUrl: "https://links.example.com/verify-email?token=opaque",
});

describe.skipIf(!integrationUrl)("PostgreSQL verification email queue", () => {
  it("migrates tables and atomically admits one cooldown winner", () =>
    withDatabase(async (url) => {
      const repository = new PgVerificationEmailQueueRepository(url);
      try {
        const results = await Promise.all(
          Array.from({ length: 8 }, () => repository.consumeCooldown("digest", 60)),
        );
        const winner = results.find((result) => result.allowed)!;
        expect(results.filter((result) => result.allowed)).toHaveLength(1);
        expect(winner.reservationToken).toMatch(/^[0-9a-f-]{36}$/);
        for (const loser of results.filter((result) => !result.allowed)) {
          expect(loser.retryAfterSeconds).toBeGreaterThan(0);
          expect(loser.retryAfterSeconds).toBeLessThanOrEqual(60);
        }
        expect(await repository.releaseCooldown("digest", "stale-token")).toBe(false);
        expect(await repository.releaseCooldown("digest", winner.reservationToken!)).toBe(true);
        expect((await repository.consumeCooldown("digest", 60)).allowed).toBe(true);
      } finally {
        await repository.close();
      }
    }), 30_000);

  it("deduplicates logical deliveries and claims disjoint batches", () =>
    withDatabase(async (url) => {
      const first = new PgVerificationEmailQueueRepository(url);
      const second = new PgVerificationEmailQueueRepository(url);
      try {
        const same = delivery("same-operation");
        expect((await first.enqueue(same)).created).toBe(true);
        const duplicate = await first.enqueue({ ...same, id: randomUUID() });
        expect(duplicate).toEqual({ id: same.id, created: false });
        await first.enqueue(delivery("operation-two"));

        const [left, right] = await Promise.all([first.claim(1, 30), second.claim(1, 30)]);
        expect(left).toHaveLength(1);
        expect(right).toHaveLength(1);
        expect(left[0]?.id).not.toBe(right[0]?.id);
        expect(left[0]?.leaseToken).not.toBe(right[0]?.leaseToken);
        expect(left[0]?.attempt).toBe(1);
        expect(right[0]?.attempt).toBe(1);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    }), 30_000);

  it("does not reclaim a delivery after three provider attempts", () =>
    withDatabase(async (url) => {
      const repository = new PgVerificationEmailQueueRepository(url);
      const inspector = new pg.Client({ connectionString: url });
      await inspector.connect();
      try {
        const queued = await repository.enqueue(delivery("attempt-budget"));
        await inspector.query(
          `UPDATE verification_email_delivery
           SET state = 'leased', attempts = 3, lease_token = 'expired',
               lease_until = clock_timestamp() - interval '1 second'
           WHERE id = $1`,
          [queued.id],
        );
        expect(await repository.claim(1, 30)).toEqual([]);
      } finally {
        await inspector.end();
        await repository.close();
      }
    }), 30_000);

  it("reclaims expired leases, fences stale workers and redacts terminal URLs", () =>
    withDatabase(async (url) => {
      const repository = new PgVerificationEmailQueueRepository(url);
      const inspector = new pg.Client({ connectionString: url });
      await inspector.connect();
      try {
        const queued = await repository.enqueue(delivery("reclaim-operation"));
        const stale = (await repository.claim(1, 1))[0]!;
        await inspector.query(
          `UPDATE verification_email_delivery SET lease_until = clock_timestamp() - interval '1 second' WHERE id = $1`,
          [queued.id],
        );
        const current = (await repository.claim(1, 30))[0]!;
        expect(current.id).toBe(stale.id);
        expect(current.leaseToken).not.toBe(stale.leaseToken);
        expect(current.attempt).toBe(2);
        expect(await repository.complete(stale.id, stale.leaseToken)).toBe(false);
        expect(await repository.complete(current.id, current.leaseToken)).toBe(true);
        const sent = await inspector.query(
          `SELECT state, verification_url, recipient FROM verification_email_delivery WHERE id = $1`,
          [current.id],
        );
        expect(sent.rows[0]).toMatchObject({ state: "sent", verification_url: null, recipient: null });

        await repository.enqueue(delivery("dead-operation"));
        const dead = (await repository.claim(1, 30))[0]!;
        expect(await repository.dead(dead.id, dead.leaseToken, "provider-rejected")).toBe(true);
        const deadRow = await inspector.query(
          `SELECT state, verification_url, recipient, error_category FROM verification_email_delivery WHERE id = $1`,
          [dead.id],
        );
        expect(deadRow.rows[0]).toMatchObject({
          state: "dead",
          verification_url: null,
          recipient: null,
          error_category: "provider-rejected",
        });
      } finally {
        await inspector.end();
        await repository.close();
      }
    }), 30_000);
});
