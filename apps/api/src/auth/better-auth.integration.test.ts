import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import pg from "pg";
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

// Real-PostgreSQL auth bootstrap gate (AD-9/AD-19): mandatory in CI via the
// service container, skipped locally without an integration database.
describe.skipIf(!integrationUrl)("Better Auth bootstrap integration", () => {
  let baseUrl: string;
  let close: (() => Promise<void>) | undefined;
  let admin: pg.Client;
  let ephemeralName: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: integrationUrl });
    await admin.connect();
    ephemeralName = `auth_test_${randomUUID().slice(0, 8)}`;
    await admin.query(`CREATE DATABASE ${ephemeralName}`);
    const ephemeralUrl = new URL(integrationUrl!);
    ephemeralUrl.pathname = `/${ephemeralName}`;
    await runMigrations(ephemeralUrl.toString());

    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const config: ApiConfig = {
      databaseUrl: ephemeralUrl.toString(),
      port,
      betterAuthSecret: "integration-secret-0123456789abcdef-xyz",
      publicOrigin: baseUrl,
    };
    // Boot through the REAL composition root: any body-parser reordering must
    // fail this suite (AC3 ordering regression).
    const app = await bootstrap(config);
    await app.listen(port, "127.0.0.1");
    close = () => app.close();
  }, 60_000);

  afterAll(async () => {
    await close?.();
    await admin.query(`DROP DATABASE IF EXISTS ${ephemeralName} WITH (FORCE)`);
    await admin.end();
  });

  const sameOriginHeaders = () => ({
    "content-type": "application/json",
    origin: baseUrl,
    "sec-fetch-site": "same-origin",
  });

  it("completes a JSON sign-up without hanging, issues a session cookie, and resolves the same actor", async () => {
    const email = `marketer-${randomUUID().slice(0, 8)}@example.com`;
    const signUp = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: sameOriginHeaders(),
      body: JSON.stringify({ email, password: "correct-horse-battery-staple-1", name: "Marketer" }),
      signal: AbortSignal.timeout(5_000),
    });
    expect(signUp.status).toBe(200);
    const setCookie = signUp.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("better-auth.session_token");
    expect(setCookie.toLowerCase()).toContain("httponly");
    const body = (await signUp.json()) as { user?: { id?: string } };
    expect(typeof body.user?.id).toBe("string");

    const sessionCookie = setCookie.split(";")[0]!;
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie: sessionCookie } });
    expect(me.status).toBe(200);
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(await me.json()).toEqual({ actorId: body.user!.id });
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
    // GET requests are never blocked by the origin check.
    const ok = await fetch(`${baseUrl}/api/auth/get-session`, { signal: AbortSignal.timeout(5_000) });
    expect(ok.status).toBe(200);
  }, 30_000);
});
