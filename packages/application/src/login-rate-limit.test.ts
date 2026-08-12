import { describe, expect, it } from "vitest";
import {
  ConsumeLoginRateLimit,
  createLoginRateLimitKey,
  type LoginRateLimitRepository,
} from "./login-rate-limit.js";

describe("login rate limit", () => {
  it("uses opaque domain-separated keys and delegates both scopes together", async () => {
    const calls: unknown[] = [];
    const repository: LoginRateLimitRepository = {
      consume: async (requests) => {
        calls.push(requests);
        return { allowed: true };
      },
    };
    const secret = "test-secret";
    const account = createLoginRateLimitKey("account", "marketer@example.com", secret);
    const ip = createLoginRateLimitKey("ip", "127.0.0.1", secret);

    expect(account).toMatch(/^[a-f0-9]{64}$/);
    expect(account).not.toBe(ip);
    expect(account).not.toContain("marketer@example.com");

    await new ConsumeLoginRateLimit(repository).execute([
      { scope: "account", keyDigest: account, windowSeconds: 900, maximumAttempts: 5 },
      { scope: "ip", keyDigest: ip, windowSeconds: 900, maximumAttempts: 30 },
    ]);
    expect(calls).toHaveLength(1);
  });
});
