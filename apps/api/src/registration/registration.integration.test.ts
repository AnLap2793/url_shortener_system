import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import pg from "pg";
import { createVerificationEmailCooldownKey } from "@url-shortener/application";
import { runMigrations } from "@url-shortener/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../bootstrap.js";
import type { ApiConfig } from "../config.js";

const integrationUrl = process.env.INTEGRATION_DATABASE_URL;

async function reservePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

describe.skipIf(!integrationUrl)("registration facade", () => {
  let baseUrl: string;
  let databaseUrl: string;
  let close: () => Promise<void>;
  let admin: pg.Client;
  let ephemeralName: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: integrationUrl });
    await admin.connect();
    ephemeralName = `reg_test_${randomUUID().slice(0, 8)}`;
    await admin.query(`CREATE DATABASE ${ephemeralName}`);
    const url = new URL(integrationUrl!);
    url.pathname = `/${ephemeralName}`;
    databaseUrl = url.toString();
    await runMigrations(databaseUrl);
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const config: ApiConfig = {
      databaseUrl,
      port,
      publicOrigin: baseUrl,
      betterAuthSecret: "integration-secret-0123456789abcdef-xyz",
    };
    const app = await bootstrap(config);
    await app.listen(port, "127.0.0.1");
    close = () => app.close();
  }, 60_000);

  afterAll(async () => {
    await close?.();
    await admin.query(`DROP DATABASE IF EXISTS ${ephemeralName} WITH (FORCE)`);
    await admin.end();
  });

  const headers = () => ({
    "content-type": "application/json",
    origin: baseUrl,
    "sec-fetch-site": "same-origin",
  });

  async function post(path: string, body: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  }

  async function postRaw(path: string, body: string) {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: headers(),
      body,
      signal: AbortSignal.timeout(5_000),
    });
  }

  async function expireCooldown(email: string): Promise<void> {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const digest = createVerificationEmailCooldownKey(
        email,
        "integration-secret-0123456789abcdef-xyz",
      );
      await client.query(
        `UPDATE verification_email_cooldown SET next_allowed_at = clock_timestamp() - interval '1 second'
         WHERE key_digest = $1`,
        [digest],
      );
    } finally {
      await client.end();
    }
  }

  it("returns the same generic response for new and existing signup without a cookie", async () => {
    const email = `marketer-${randomUUID().slice(0, 8)}@example.com`;
    const first = await post("/api/registration/sign-up", {
      email,
      password: "correct-horse-battery-staple",
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(first.headers.get("set-cookie")).toBeNull();
    const body = await first.json();
    expect(body).toEqual({ status: "verification-pending" });

    const throttled = await post("/api/registration/sign-up", {
      email,
      password: "correct-horse-battery-staple",
    });
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toMatch(/^\d+$/);

    await expireCooldown(email);
    const existing = await post("/api/registration/sign-up", {
      email,
      password: "correct-horse-battery-staple",
    });
    expect(existing.status).toBe(200);
    expect(await existing.json()).toEqual({ status: "verification-pending" });

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const users = await client.query(`SELECT email_verified FROM "user" WHERE email = $1`, [email]);
      expect(users.rows).toEqual([{ email_verified: false }]);
      const deliveries = await client.query(
        `SELECT count(*)::integer AS count FROM verification_email_delivery WHERE recipient = $1`,
        [email],
      );
      expect(deliveries.rows[0]?.count).toBe(2);
    } finally {
      await client.end();
    }
  }, 30_000);

  it("uses RFC 9457 validation and cooldown responses", async () => {
    const invalid = await post("/api/registration/sign-up", { email: "bad", password: "short" });
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(invalid.headers.get("cache-control")).toBe("no-store");
    expect(await invalid.json()).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      instance: "/api/registration/sign-up",
    });

    for (const email of ["ü@example.com", '"x y"@example.com']) {
      const mismatch = await post("/api/registration/sign-up", {
        email,
        password: "correct-horse-battery-staple",
      });
      expect(mismatch.status).toBe(400);
      expect(await mismatch.json()).toMatchObject({ code: "VALIDATION_FAILED" });
    }

    const malformed = await postRaw("/api/registration/sign-up", "{");
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(malformed.headers.get("cache-control")).toBe("no-store");
    const malformedProblem = await malformed.json();
    expect(malformedProblem).toMatchObject({
      code: "INVALID_JSON",
      instance: "/api/registration/sign-up",
    });
    expect(JSON.stringify(malformedProblem)).not.toContain("Unexpected");

    const oversized = await postRaw(
      "/api/registration/sign-up",
      JSON.stringify({ email: "large@example.com", password: "x".repeat(110_000) }),
    );
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    expect(oversized.headers.get("cache-control")).toBe("no-store");
    expect(await oversized.json()).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      instance: "/api/registration/sign-up",
    });

    const absent = `absent-${randomUUID().slice(0, 8)}@example.com`;
    const accepted = await post("/api/registration/resend-verification", { email: absent });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ status: "verification-pending" });
    const throttled = await post("/api/registration/resend-verification", { email: absent });
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await throttled.json()).toMatchObject({ status: 429, code: "VERIFICATION_COOLDOWN" });
  });

  it("verifies a valid token, rejects invalid tokens, and never creates a session", async () => {
    const email = `verify-${randomUUID().slice(0, 8)}@example.com`;
    expect((await post("/api/registration/sign-up", {
      email,
      password: "correct-horse-battery-staple",
    })).status).toBe(200);
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const delivery = await client.query(
        `SELECT verification_url FROM verification_email_delivery WHERE recipient = $1`,
        [email],
      );
      const token = new URL(delivery.rows[0]!.verification_url).searchParams.get("token")!;
      const verified = await post("/api/registration/verify-email", { token });
      expect(verified.status).toBe(200);
      expect(verified.headers.get("set-cookie")).toBeNull();
      expect(await verified.json()).toEqual({ status: "verified" });
      expect((await post("/api/registration/verify-email", { token })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/me`)).status).toBe(401);

      const invalid = await post("/api/registration/verify-email", { token: "malformed" });
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toMatchObject({ code: "INVALID_VERIFICATION" });
    } finally {
      await client.end();
    }
  }, 30_000);
});
