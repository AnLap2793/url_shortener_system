import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

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
});
