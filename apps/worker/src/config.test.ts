import { describe, expect, it } from "vitest";
import { loadWorkerConfig } from "./config.js";

const databaseUrl = "postgresql://user:pass@localhost:5432/db";

describe("worker configuration", () => {
  it("accepts capture outside production without provider secrets", () => {
    expect(loadWorkerConfig({ DATABASE_URL: databaseUrl, EMAIL_DELIVERY_MODE: "capture" })).toEqual({
      databaseUrl,
      emailDeliveryMode: "capture",
    });
  });

  it("requires an explicit supported delivery mode", () => {
    expect(() => loadWorkerConfig({ DATABASE_URL: databaseUrl })).toThrow(
      "EMAIL_DELIVERY_MODE must be capture or resend",
    );
    expect(() =>
      loadWorkerConfig({ DATABASE_URL: databaseUrl, EMAIL_DELIVERY_MODE: "smtp" }),
    ).toThrow("EMAIL_DELIVERY_MODE must be capture or resend");
  });

  it("rejects capture in production", () => {
    expect(() =>
      loadWorkerConfig({
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        EMAIL_DELIVERY_MODE: "capture",
      }),
    ).toThrow("EMAIL_DELIVERY_MODE capture is not allowed in production");
  });

  it("requires Resend settings without exposing their values", () => {
    expect(() =>
      loadWorkerConfig({ DATABASE_URL: databaseUrl, EMAIL_DELIVERY_MODE: "resend" }),
    ).toThrow("RESEND_API_KEY and EMAIL_FROM are required for resend delivery");

    const attempt = () =>
      loadWorkerConfig({
        DATABASE_URL: databaseUrl,
        EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "sentinel-provider-key",
        EMAIL_FROM: "sentinel-invalid-sender",
      });
    expect(attempt).toThrow("EMAIL_FROM must be a valid email address");
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain("sentinel-provider-key");
      expect(String(error)).not.toContain("sentinel-invalid-sender");
    }
  });

  it("returns Resend configuration only to the worker", () => {
    expect(
      loadWorkerConfig({
        DATABASE_URL: databaseUrl,
        EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "provider-key",
        EMAIL_FROM: "Marketer <mail@example.com>",
      }),
    ).toEqual({
      databaseUrl,
      emailDeliveryMode: "resend",
      resendApiKey: "provider-key",
      emailFrom: "Marketer <mail@example.com>",
    });
  });
});
