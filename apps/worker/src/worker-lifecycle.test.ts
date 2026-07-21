import { describe, expect, it, vi } from "vitest";
import { WorkerLifecycle } from "./worker-lifecycle.js";

describe("worker lifecycle", () => {
  it("aborts and invokes registered cleanup", async () => {
    const lifecycle = new WorkerLifecycle();
    const cleanup = vi.fn();
    lifecycle.register(cleanup);
    await lifecycle.stop(100);
    expect(lifecycle.signal.aborted).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("bounds cleanup duration", async () => {
    const lifecycle = new WorkerLifecycle();
    lifecycle.register(() => new Promise(() => {}));
    const started = performance.now();
    await lifecycle.stop(25);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
