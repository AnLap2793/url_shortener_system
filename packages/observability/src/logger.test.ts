import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./index.js";

describe("structured logger", () => {
  it("writes valid JSON with correlation ID and redacts sensitive fields", () => {
    const write = vi.fn();
    const logger = createLogger(write);
    logger.info("health probe failed", {
      correlationId: "request-1",
      password: "sentinel-password",
      databaseUrl: "postgres://sentinel-dsn",
      cookie: "sentinel-cookie",
      forwardedFor: "203.0.113.1",
      referer: "https://example.test/private?token=sentinel",
      userAgent: "sentinel-agent",
      error: { password: "sentinel-nested-password" },
    });
    const line = write.mock.calls[0]?.[0];
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).toContain('"correlationId":"request-1"');
    for (const sentinel of ["sentinel-password", "sentinel-nested-password", "sentinel-dsn", "sentinel-cookie", "203.0.113.1", "sentinel-agent", "token=sentinel"]) {
      expect(line).not.toContain(sentinel);
    }
  });
});
