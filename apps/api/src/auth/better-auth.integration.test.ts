import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import pg from "pg";
import { runMigrations } from "@url-shortener/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../bootstrap.js";
import type { ApiConfig } from "../config.js";
import { createAuth, type AuthHandle } from "./better-auth-instance.js";

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

// Real-PostgreSQL auth bootstrap gate (AD-9/AD-19): mandatory in CI via the
// service container, skipped locally without an integration database.
describe.skipIf(!integrationUrl)("Better Auth bootstrap integration", () => {
  let baseUrl: string;
  let close: (() => Promise<void>) | undefined;
  let authHandle: AuthHandle;
  let admin: pg.Client;
  let ephemeralName: string;
  let databaseUrl: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: integrationUrl });
    await admin.connect();
    ephemeralName = `auth_test_${randomUUID().slice(0, 8)}`;
    await admin.query(`CREATE DATABASE ${ephemeralName}`);
    const ephemeralUrl = new URL(integrationUrl!);
    ephemeralUrl.pathname = `/${ephemeralName}`;
    databaseUrl = ephemeralUrl.toString();
    await runMigrations(databaseUrl);

    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const config: ApiConfig = {
      databaseUrl,
      port,
      betterAuthSecret: "integration-secret-0123456789abcdef-xyz",
      publicOrigin: baseUrl,
      trustedProxyHops: 0,
    };
    // Boot through the REAL composition root: any body-parser reordering must
    // fail this suite (AC3 ordering regression).
    authHandle = createAuth(config);
    const app = await bootstrap(config, authHandle);
    await app.listen(port, "127.0.0.1");
    close = () => app.close();
  }, 60_000);

  afterAll(async () => {
    await close?.();
    await authHandle.closeDb();
    await admin.query(`DROP DATABASE IF EXISTS ${ephemeralName} WITH (FORCE)`);
    await admin.end();
  });

  const sameOriginHeaders = () => ({
    "content-type": "application/json",
    origin: baseUrl,
    "sec-fetch-site": "same-origin",
  });

  it("keeps raw registration lifecycle endpoints unreachable", async () => {
    for (const path of [
      "sign-up/email",
      "send-verification-email",
      "verify-email",
      "sign-in/email",
      "sign-out",
      "get-session",
    ]) {
      const response = await fetch(`${baseUrl}/api/auth/${path}`, {
        method: ["verify-email", "get-session"].includes(path) ? "GET" : "POST",
        headers: ["verify-email", "get-session"].includes(path) ? undefined : sameOriginHeaders(),
        body: ["verify-email", "get-session"].includes(path) ? undefined : JSON.stringify({}),
      });
      expect(response.status, path).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("creates an unverified account in-process without a session and enqueues the SPA URL", async () => {
    const email = `marketer-${randomUUID().slice(0, 8)}@example.com`;
    const operation = await authHandle.withVerificationOperation(randomUUID(), async () => {
      const signUp = await authHandle.auth.api.signUpEmail({
        body: { email, password: "correct-horse-battery-staple-1", name: "Marketer" },
      });
      await authHandle.auth.api.sendVerificationEmail({ body: { email } });
      return signUp;
    });
    expect(operation.value.token).toBeNull();

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const user = await client.query(`SELECT email_verified FROM "user" WHERE email = $1`, [email]);
      expect(user.rows[0]?.email_verified).toBe(false);
      const delivery = await client.query(
        `SELECT verification_url FROM verification_email_delivery WHERE recipient = $1`,
        [email],
      );
      expect(delivery.rows[0]?.verification_url).toMatch(
        new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/verify-email\\?token=`),
      );
      expect(delivery.rows[0]?.verification_url).not.toContain("/api/auth/verify-email");
    } finally {
      await client.end();
    }
    expect((await fetch(`${baseUrl}/api/me`)).status).toBe(401);
  }, 30_000);

  it("rejects /api/me without a session", async () => {
    const me = await fetch(`${baseUrl}/api/me`);
    expect(me.status).toBe(401);
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(me.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    const problem = await me.json();
    expect(problem).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });

  it("enforces the AD-18 CSRF matrix on unsafe auth requests", async () => {
    const body = JSON.stringify({
      email: `csrf-${randomUUID().slice(0, 8)}@example.com`,
      password: "correct-horse-battery-staple-1",
      name: "Marketer",
    });
    const cases: Array<Record<string, string>> = [
      { "content-type": "application/json" },
      { "content-type": "application/json", origin: baseUrl },
      { "content-type": "application/json", origin: "https://evil.example", "sec-fetch-site": "same-origin" },
      { "content-type": "application/json", origin: baseUrl, "sec-fetch-site": "cross-site" },
    ];
    for (const headers of cases) {
      const rejected = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(5_000),
      });
      expect(rejected.status, JSON.stringify(headers)).toBe(403);
      expect((await rejected.json()).code).toBe("CSRF_REJECTED");
    }
    // GET requests are never blocked by the origin check. OAuth callbacks remain public.
    const ok = await fetch(`${baseUrl}/api/auth/callback/google`, { signal: AbortSignal.timeout(5_000) });
    expect(ok.status).not.toBe(403);
  }, 30_000);
});
