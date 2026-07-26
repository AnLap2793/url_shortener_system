import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const validDatabaseUrl = "postgres://user:pass@localhost:5432/db";
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
    expect(loadConfig({ DATABASE_URL: "postgresql://localhost/db" }).databaseUrl).toBe("postgresql://localhost/db");
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
    const config = loadConfig({ DATABASE_URL: validDatabaseUrl, WEB_DIST_DIR: root });
    expect(config.webDistDir).toBeDefined();
    expect(isAbsolute(config.webDistDir!)).toBe(true);
  });

  it("keeps static hosting disabled when WEB_DIST_DIR is unset", () => {
    expect(loadConfig({ DATABASE_URL: validDatabaseUrl }).webDistDir).toBeUndefined();
  });

  it("fails fast for WEB_DIST_DIR without index.html and never reveals the value", () => {
    const root = mkdtempSync(join(tmpdir(), "config-sentinel-dist-"));
    tempRoots.push(root);
    const attempt = () => loadConfig({ DATABASE_URL: validDatabaseUrl, WEB_DIST_DIR: join(root, "sentinel-missing") });
    expect(attempt).toThrow("WEB_DIST_DIR must point to a directory containing index.html");
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain("sentinel-missing");
    }
  });
});
