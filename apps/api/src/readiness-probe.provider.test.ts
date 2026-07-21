import { describe, expect, it, vi } from "vitest";
import { ReadinessProbeLifecycle } from "./readiness-probe.provider.js";

describe("readiness lifecycle", () => {
  it("closes the probe during shutdown", async () => {
    const probe = { isReady: async () => true, close: vi.fn(async () => {}) };
    await new ReadinessProbeLifecycle(probe).onApplicationShutdown();
    expect(probe.close).toHaveBeenCalledOnce();
  });
});
