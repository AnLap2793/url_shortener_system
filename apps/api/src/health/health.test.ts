import { describe, expect, it, vi } from "vitest";
import { HealthService } from "./health.service.js";

describe("health contract", () => {
  it("keeps liveness independent from PostgreSQL", () => {
    const probe = { isReady: vi.fn(), close: vi.fn() };
    const health = new HealthService(probe);
    expect(health.live()).toEqual({ status: "ok" });
    expect(probe.isReady).not.toHaveBeenCalled();
  });

  it("reports readiness unavailable without exposing details", async () => {
    const health = new HealthService({ isReady: async () => false, close: async () => {} });
    await expect(health.ready()).resolves.toEqual({ status: "unavailable" });
  });
});
