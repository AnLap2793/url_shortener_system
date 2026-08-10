import { describe, expect, it, vi } from "vitest";
import type {
  ClaimedVerificationEmail,
  VerificationEmailQueueRepository,
  VerificationEmailTransport,
} from "@url-shortener/application";
import { VerificationEmailDeliveryLoop } from "./verification-email-delivery-loop.js";

function delivery(attempt = 1): ClaimedVerificationEmail {
  return {
    id: "delivery-1",
    logicalKey: "operation-1",
    recipient: "marketer@example.com",
    verificationUrl: "https://example.com/verify-email?token=secret",
    attempt,
    leaseToken: "lease-1",
    leaseUntil: new Date("2026-08-09T00:01:00Z"),
  };
}

function repository(claimed: ClaimedVerificationEmail[] = [delivery()]) {
  return {
    claim: vi.fn().mockResolvedValue(claimed),
    complete: vi.fn().mockResolvedValue(true),
    retry: vi.fn().mockResolvedValue(true),
    dead: vi.fn().mockResolvedValue(true),
  } as unknown as VerificationEmailQueueRepository;
}

const now = () => new Date("2026-08-09T00:00:00Z");

describe("verification email delivery loop", () => {
  it("completes a successful delivery with the opaque delivery ID", async () => {
    const queue = repository();
    const transport: VerificationEmailTransport = { deliver: vi.fn().mockResolvedValue({ status: "sent" }) };
    const loop = new VerificationEmailDeliveryLoop(queue, transport, { now });

    expect(await loop.runOnce()).toBe(1);
    expect(transport.deliver).toHaveBeenCalledWith(expect.objectContaining({ id: "delivery-1" }));
    expect(queue.complete).toHaveBeenCalledWith("delivery-1", "lease-1");
  });

  it.each([
    [1, 30],
    [2, 120],
  ])("retries attempt %s after %s seconds", async (attempt, delaySeconds) => {
    const queue = repository([delivery(attempt)]);
    const transport: VerificationEmailTransport = {
      deliver: vi.fn().mockResolvedValue({ status: "failed", category: "network", retryable: true }),
    };
    const loop = new VerificationEmailDeliveryLoop(queue, transport, { now });

    await loop.runOnce();
    expect(queue.retry).toHaveBeenCalledWith(
      "delivery-1",
      "lease-1",
      new Date(now().getTime() + delaySeconds * 1_000),
      "network",
    );
  });

  it("bounds provider Retry-After to the current retry window", async () => {
    const queue = repository();
    const transport: VerificationEmailTransport = {
      deliver: vi.fn().mockResolvedValue({
        status: "failed",
        category: "rate-limited",
        retryable: true,
        retryAfterSeconds: 600,
      }),
    };
    const loop = new VerificationEmailDeliveryLoop(queue, transport, { now });

    await loop.runOnce();
    expect(queue.retry).toHaveBeenCalledWith(
      "delivery-1",
      "lease-1",
      new Date(now().getTime() + 30_000),
      "rate-limited",
    );
  });

  it("does not call the provider after the attempt budget is exhausted", async () => {
    const queue = repository([delivery(4)]);
    const transport: VerificationEmailTransport = { deliver: vi.fn() };
    const loop = new VerificationEmailDeliveryLoop(queue, transport, { now });

    await loop.runOnce();
    expect(transport.deliver).not.toHaveBeenCalled();
    expect(queue.dead).toHaveBeenCalledWith("delivery-1", "lease-1", "attempts-exhausted");
  });

  it.each([
    [{ status: "failed", category: "provider-rejected", retryable: false }, 1],
    [{ status: "failed", category: "provider-unavailable", retryable: true }, 3],
  ] as const)("marks terminal failures dead", async (result, attempt) => {
    const queue = repository([delivery(attempt)]);
    const transport: VerificationEmailTransport = { deliver: vi.fn().mockResolvedValue(result) };
    const loop = new VerificationEmailDeliveryLoop(queue, transport, { now });

    await loop.runOnce();
    expect(queue.dead).toHaveBeenCalledWith("delivery-1", "lease-1", result.category);
    expect(queue.retry).not.toHaveBeenCalled();
  });

  it("stops claiming after abort and closes the repository", async () => {
    const queue = repository([]);
    const transport: VerificationEmailTransport = { deliver: vi.fn() };
    const abortController = new AbortController();
    abortController.abort();
    const loop = new VerificationEmailDeliveryLoop(queue, transport, { signal: abortController.signal });

    await loop.run();
    expect(queue.claim).not.toHaveBeenCalled();
  });
});
