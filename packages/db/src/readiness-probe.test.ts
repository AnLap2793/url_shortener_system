import { describe, expect, it } from "vitest";
import { PgReadinessProbe } from "./index.js";

describe("PostgreSQL readiness probe", () => {
  it("returns unavailable within a bounded time", async () => {
    const probe = new PgReadinessProbe("postgres://invalid:secret@127.0.0.1:1/test", 100);
    const started = performance.now();
    await expect(probe.isReady()).resolves.toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
    await probe.close();
  });

  it.runIf(Boolean(process.env.INTEGRATION_DATABASE_URL))("connects to real PostgreSQL when configured", async () => {
    const probe = new PgReadinessProbe(process.env.INTEGRATION_DATABASE_URL!, 1_000);
    await expect(probe.isReady()).resolves.toBe(true);
    await probe.close();
  });
});
