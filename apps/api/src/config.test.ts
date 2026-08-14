import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const validDatabaseUrl = "postgres://user:pass@localhost:5432/db";
const validSecret = "test-secret-0123456789abcdef-0123456789";
const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("API configuration", () => {
  it("fails fast when required configuration is missing", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL must be a valid PostgreSQL URL",
    );
  });

  it("fails fast for incomplete or malformed URLs without revealing values", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://" }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL URL");
    expect(() =>
      loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db?port=abc" }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL URL");
    expect(() =>
      loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db?host=elsewhere" }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL URL");
    expect(() =>
      loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db?query_timeout=0" }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL URL");
    expect(loadConfig({ DATABASE_URL: "postgresql://localhost/db", BETTER_AUTH_SECRET: validSecret }).databaseUrl).toBe("postgresql://localhost/db");
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "sentinel-malformed",
      }),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL URL");
    try {
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "sentinel-malformed",
      });
    } catch (error) {
      expect(String(error)).not.toContain("sentinel-malformed");
    }
  });

  it("resolves an absolute web dist directory when index.html exists", () => {
    const root = mkdtempSync(join(tmpdir(), "config-web-dist-"));
    tempRoots.push(root);
    writeFileSync(join(root, "index.html"), "<!doctype html>");
    const config = loadConfig({ DATABASE_URL: validDatabaseUrl, BETTER_AUTH_SECRET: validSecret, WEB_DIST_DIR: root });
    expect(config.webDistDir).toBeDefined();
    expect(isAbsolute(config.webDistDir!)).toBe(true);
  });

  it("keeps static hosting disabled when WEB_DIST_DIR is unset", () => {
    expect(loadConfig({ DATABASE_URL: validDatabaseUrl, BETTER_AUTH_SECRET: validSecret }).webDistDir).toBeUndefined();
  });

  it("requires a strong BETTER_AUTH_SECRET without revealing the value", () => {
    const missing = () => loadConfig({ DATABASE_URL: validDatabaseUrl });
    expect(missing).toThrow("BETTER_AUTH_SECRET must be set to at least 32 characters");
    const short = () =>
      loadConfig({ DATABASE_URL: validDatabaseUrl, BETTER_AUTH_SECRET: "sentinel-short" });
    expect(short).toThrow("BETTER_AUTH_SECRET must be set to at least 32 characters");
    try {
      short();
    } catch (error) {
      expect(String(error)).not.toContain("sentinel-short");
    }
    const config = loadConfig({
      DATABASE_URL: validDatabaseUrl,
      BETTER_AUTH_SECRET: "sentinel-long-enough-secret-0123456789abcdef",
    });
    expect(config.betterAuthSecret).toHaveLength(44);
  });

  it("validates PUBLIC_ORIGIN and defaults to the loopback origin", () => {
    const base = { DATABASE_URL: validDatabaseUrl, BETTER_AUTH_SECRET: "x".repeat(32) };
    expect(loadConfig({ ...base, PORT: "4173" }).publicOrigin).toBe("http://127.0.0.1:4173");
    expect(loadConfig(base).trustedProxyHops).toBe(0);
    expect(loadConfig({ ...base, PUBLIC_ORIGIN: "https://links.example.com" }).publicOrigin).toBe(
      "https://links.example.com",
    );
    expect(() => loadConfig({ ...base, NODE_ENV: "production", PUBLIC_ORIGIN: "http://links.example.com" }))
      .toThrow("PUBLIC_ORIGIN must use https in production");
    expect(() => loadConfig({ ...base, NODE_ENV: "production", PUBLIC_ORIGIN: "https://links.example.com" }))
      .toThrow("TRUSTED_PROXY_HOPS must be 1 in production");
    expect(loadConfig({
      ...base,
      NODE_ENV: "production",
      PUBLIC_ORIGIN: "https://links.example.com",
      TRUSTED_PROXY_HOPS: "1",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    }).trustedProxyHops).toBe(1);
    for (const value of ["-1", "1.5", "6", "invalid"]) {
      expect(() => loadConfig({ ...base, TRUSTED_PROXY_HOPS: value }))
        .toThrow("TRUSTED_PROXY_HOPS must be an integer from 0 to 5");
    }
    for (const invalid of ["not-a-url", "ftp://x.example", "https://x.example/path", "https://x.example/"]) {
      expect(() => loadConfig({ ...base, PUBLIC_ORIGIN: invalid }), invalid).toThrow(
        "PUBLIC_ORIGIN must be an absolute http(s) origin without a path",
      );
    }
  });

  it("validates the paired Google OAuth configuration without revealing the secret", () => {
    const base = { DATABASE_URL: validDatabaseUrl, BETTER_AUTH_SECRET: validSecret };
    expect(loadConfig(base).googleClientId).toBeUndefined();
    expect(loadConfig(base).googleCallbackUrl).toBeUndefined();

    for (const environment of [
      { ...base, GOOGLE_CLIENT_ID: "google-client-id" },
      { ...base, GOOGLE_CLIENT_SECRET: "sentinel-google-secret" },
      { ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "sentinel-google-secret" },
      { ...base, GOOGLE_CLIENT_ID: "google-client-id", GOOGLE_CLIENT_SECRET: "" },
    ]) {
      const attempt = () => loadConfig(environment);
      expect(attempt).toThrow("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set");
      try {
        attempt();
      } catch (error) {
        expect(String(error)).not.toContain("sentinel-google-secret");
      }
    }

    expect(() => loadConfig({ ...base, NODE_ENV: "production", PUBLIC_ORIGIN: "https://links.example.com", TRUSTED_PROXY_HOPS: "1" }))
      .toThrow("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set");

    const config = loadConfig({
      ...base,
      PUBLIC_ORIGIN: "https://links.example.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "sentinel-google-secret",
    });
    expect(config.googleClientId).toBe("google-client-id");
    expect(config.googleClientSecret).toBe("sentinel-google-secret");
    expect(config.googleCallbackUrl).toBe("https://links.example.com/api/auth/callback/google");
  });

  it("does not read worker-only email provider secrets", () => {
    const config = loadConfig({
      DATABASE_URL: validDatabaseUrl,
      BETTER_AUTH_SECRET: validSecret,
      EMAIL_DELIVERY_MODE: "resend",
      RESEND_API_KEY: "sentinel-provider-key",
      EMAIL_FROM: "sender@example.com",
    });
    expect(config).not.toHaveProperty("emailDeliveryMode");
    expect(config).not.toHaveProperty("resendApiKey");
    expect(config).not.toHaveProperty("emailFrom");
  });

  it("fails fast for WEB_DIST_DIR without index.html and never reveals the value", () => {
    const root = mkdtempSync(join(tmpdir(), "config-sentinel-dist-"));
    tempRoots.push(root);
    const attempt = () => loadConfig({ DATABASE_URL: validDatabaseUrl, BETTER_AUTH_SECRET: validSecret, WEB_DIST_DIR: join(root, "sentinel-missing") });
    expect(attempt).toThrow("WEB_DIST_DIR must point to a directory containing index.html");
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain("sentinel-missing");
    }
  });
});
