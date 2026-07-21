import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./index.js";

describe("structured logger", () => {
  it("writes valid JSON with correlation ID and redacts sensitive fields", () => {
    const write = vi.fn();
    const logger = createLogger(write);
    logger.info("health probe failed token=sentinel-message", {
      correlationId: "request-1",
      password: "sentinel-password",
      databaseUrl: "postgres://sentinel-dsn",
      cookie: "sentinel-cookie",
      forwardedFor: "203.0.113.1",
      referer: "https://example.test/private?token=sentinel",
      userAgent: "sentinel-agent",
      error: { password: "sentinel-nested-password" },
      description: "benign description",
      url: "postgres://user:sentinel-url-password@localhost/db",
      count: 12n,
      occurredAt: new Date("2026-07-20T00:00:00Z"),
      level: "forged",
      message: "forged",
    });
    const line = write.mock.calls[0]?.[0];
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).toContain('"correlationId":"request-1"');
    for (const sentinel of ["sentinel-password", "sentinel-nested-password", "sentinel-dsn", "sentinel-cookie", "203.0.113.1", "sentinel-agent", "token=sentinel", "sentinel-message", "sentinel-url-password"]) {
      expect(line).not.toContain(sentinel);
    }
    expect(line).toContain('"description":"benign description"');
    expect(line).toContain('"count":"12"');
    expect(line).toContain('"level":"info"');
    expect(line).toContain('"message":"health probe failed token=[REDACTED]"');
  });

  it("handles circular values and throwing getters", () => {
    const write = vi.fn();
    const value: Record<string, unknown> = {};
    value.self = value;
    Object.defineProperty(value, "danger", { enumerable: true, get: () => { throw new Error("boom"); } });
    expect(() => createLogger(write).info("safe", { correlationId: "request-2", value })).not.toThrow();
    expect(write.mock.calls[0]?.[0]).toContain("[CIRCULAR]");
    expect(write.mock.calls[0]?.[0]).toContain("[ACCESSOR]");
  });
});
