import { describe, expect, it, vi } from "vitest";
import { LoginRateLimitLifecycle } from "./login-rate-limit-lifecycle.provider.js";

describe("LoginRateLimitLifecycle", () => {
  it("waits for the limiter pool to close", async () => {
    let finish!: () => void;
    const close = vi.fn(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    const shutdown = new LoginRateLimitLifecycle({ close }).onApplicationShutdown();

    await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    let completed = false;
    void shutdown.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    finish();
    await expect(shutdown).resolves.toBeUndefined();
  });
});
