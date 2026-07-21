import { describe, expect, it } from "vitest";
import { PgReadinessProbe } from "./index.js";

describe("PostgreSQL readiness probe", () => {
  it.each([0, -1, Number.NaN, 30_001])("rejects invalid timeout %s", (timeout) => {
    expect(() => new PgReadinessProbe("postgres://localhost/test", timeout)).toThrow(RangeError);
  });

  it("returns unavailable within a bounded time", async () => {
    const probe = new PgReadinessProbe("postgres://invalid:secret@127.0.0.1:1/test", 100);
    const started = performance.now();
    await expect(probe.isReady()).resolves.toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
    await probe.close();
  });

  it("shares one in-flight probe across concurrent callers", async () => {
    const probe = new PgReadinessProbe("postgres://invalid:secret@127.0.0.1:1/test", 100);
    const first = probe.isReady();
    const second = probe.isReady();
    expect(first).toBe(second);
    await expect(Promise.all([first, second])).resolves.toEqual([false, false]);
    await probe.close();
  });

  it("closes idempotently", async () => {
    const probe = new PgReadinessProbe("postgres://invalid:secret@127.0.0.1:1/test", 100);
    const first = probe.close();
    expect(probe.close()).toBe(first);
    await first;
  });

  it.runIf(Boolean(process.env.INTEGRATION_DATABASE_URL))("connects to real PostgreSQL when configured", async () => {
    const probe = new PgReadinessProbe(process.env.INTEGRATION_DATABASE_URL!, 1_000);
    await expect(probe.isReady()).resolves.toBe(true);
    await probe.close();
  });
});
