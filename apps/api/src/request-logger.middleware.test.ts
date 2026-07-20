import { describe, expect, it, vi } from "vitest";
import { RequestLoggerMiddleware } from "./request-logger.middleware.js";

describe("request logger", () => {
  it("adds correlation ID and does not log query values", () => {
    const setHeader = vi.fn();
    let finish = () => {};
    const write = vi.spyOn(console, "log").mockImplementation(() => {});
    const middleware = new RequestLoggerMiddleware();
    middleware.use(
      { method: "GET", url: "/health/ready?token=sentinel-query" },
      {
        statusCode: 503,
        setHeader,
        once: (_, listener) => {
          finish = listener;
        },
      },
      vi.fn(),
    );
    finish();
    expect(setHeader).toHaveBeenCalledWith(
      "X-Correlation-Id",
      expect.any(String),
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"path":"/health/ready"'),
    );
    expect(write.mock.calls[0]?.[0]).not.toContain("sentinel-query");
    write.mockRestore();
  });
});
