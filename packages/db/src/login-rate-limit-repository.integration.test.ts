import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import { PgLoginRateLimitRepository } from "./login-rate-limit-repository.js";

const integrationUrl = process.env.INTEGRATION_DATABASE_URL;

async function withDatabase(run: (url: string) => Promise<void>): Promise<void> {
  const admin = new pg.Client({ connectionString: integrationUrl });
  await admin.connect();
  const name = `login_limit_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
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

const request = (scope: "account" | "ip", suffix: string, maximumAttempts = 3) => ({
  scope,
  keyDigest: `${suffix}`.padEnd(64, "a"),
  windowSeconds: 60,
  maximumAttempts,
});

describe.skipIf(!integrationUrl)("PostgreSQL login rate limit", () => {
  it("atomically admits quotas for account and IP together", () =>
    withDatabase(async (url) => {
      const first = new PgLoginRateLimitRepository(url);
      const second = new PgLoginRateLimitRepository(url);
      const requests = [request("account", "b"), request("ip", "c")];
      try {
        const results = await Promise.all(Array.from({ length: 8 }, () => first.consume(requests)));
        expect(results.filter((result) => result.allowed)).toHaveLength(3);
        for (const rejected of results.filter((result) => !result.allowed)) {
          expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
          expect(rejected.rejectedScopes).toContain("account");
        }
        expect((await second.consume(requests)).allowed).toBe(false);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    }), 30_000);

  it("uses one lock order when concurrent callers provide reversed scopes", () =>
    withDatabase(async (url) => {
      const first = new PgLoginRateLimitRepository(url);
      const second = new PgLoginRateLimitRepository(url);
      const account = request("account", "f", 2);
      const ip = request("ip", "9", 2);
      try {
        const results = await Promise.all([
          first.consume([account, ip]),
          second.consume([ip, account]),
        ]);
        expect(results.every(({ allowed }) => allowed)).toBe(true);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    }), 30_000);

  it("rolls back admitted scopes when another scope is throttled and resets expired windows", () =>
    withDatabase(async (url) => {
      const repository = new PgLoginRateLimitRepository(url);
      const account = request("account", "d", 5);
      const ip = request("ip", "e", 1);
      const inspector = new pg.Client({ connectionString: url });
      await inspector.connect();
      try {
        expect((await repository.consume([account, ip])).allowed).toBe(true);
        expect((await repository.consume([account, ip])).allowed).toBe(false);
        const count = await inspector.query(
          "SELECT attempts FROM login_rate_limit WHERE scope = 'account' AND key_digest = $1",
          [account.keyDigest],
        );
        expect(count.rows[0]?.attempts).toBe(1);
        await inspector.query(
          "UPDATE login_rate_limit SET window_started_at = clock_timestamp() - interval '61 seconds' WHERE scope = 'ip' AND key_digest = $1",
          [ip.keyDigest],
        );
        expect((await repository.consume([account, ip])).allowed).toBe(true);
      } finally {
        await inspector.end();
        await repository.close();
      }
    }), 30_000);
});
