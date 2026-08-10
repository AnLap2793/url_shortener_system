import { describe, expect, it } from "vitest";
import {
  ConsumeVerificationEmailCooldown,
  EnqueueVerificationEmail,
  createVerificationEmailCooldownKey,
  type VerificationEmailQueueRepository,
} from "./verification-email-queue.js";

function repository(overrides: Partial<VerificationEmailQueueRepository> = {}): VerificationEmailQueueRepository {
  return {
    consumeCooldown: async () => ({ allowed: true }),
    releaseCooldown: async () => false,
    enqueue: async (input) => ({ id: input.id, created: true }),
    hasDelivery: async () => false,
    claim: async () => [],
    complete: async () => false,
    retry: async () => false,
    dead: async () => false,
    ...overrides,
  };
}

describe("verification email queue use cases", () => {
  it("normalizes email into a domain-separated keyed digest", () => {
    const first = createVerificationEmailCooldownKey(" Marketer@Example.COM ", "x".repeat(32));
    const second = createVerificationEmailCooldownKey("marketer@example.com", "x".repeat(32));
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("marketer");
    expect(createVerificationEmailCooldownKey("marketer@example.com", "y".repeat(32))).not.toBe(first);
  });

  it("delegates atomic cooldown consumption and fenced release", async () => {
    const consumeCooldown = async (keyDigest: string, cooldownSeconds: number) => {
      expect(keyDigest).toBe("digest");
      expect(cooldownSeconds).toBe(60);
      return { allowed: false as const, retryAfterSeconds: 17 };
    };
    const releaseCooldown = async (keyDigest: string, reservationToken: string) => {
      expect(keyDigest).toBe("digest");
      expect(reservationToken).toBe("reservation-token");
      return true;
    };
    const useCase = new ConsumeVerificationEmailCooldown(repository({ consumeCooldown, releaseCooldown }));
    await expect(useCase.execute("digest", 60)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 17,
    });
    await expect(useCase.release("digest", "reservation-token")).resolves.toBe(true);
  });

  it("enqueues an opaque delivery without deriving identity from its URL", async () => {
    const enqueue = async (input: Parameters<VerificationEmailQueueRepository["enqueue"]>[0]) => {
      expect(input.logicalKey).toBe("operation-id");
      expect(input.id).toBe("delivery-id");
      return { id: input.id, created: true };
    };
    const useCase = new EnqueueVerificationEmail(repository({ enqueue }));
    await expect(
      useCase.execute({
        id: "delivery-id",
        logicalKey: "operation-id",
        recipient: "marketer@example.com",
        verificationUrl: "https://links.example.com/verify-email?token=secret",
      }),
    ).resolves.toEqual({ id: "delivery-id", created: true });
  });
});
