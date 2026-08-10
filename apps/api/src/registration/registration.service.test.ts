import { ServiceUnavailableException } from "@nestjs/common";
import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import type { VerificationEmailQueueRepository } from "@url-shortener/application";
import type { ApiConfig } from "../config.js";
import type { AuthHandle } from "../auth/better-auth-instance.js";
import {
  InvalidVerificationError,
  RegistrationService,
  VerificationCooldownError,
} from "./registration.service.js";

const config = {
  betterAuthSecret: "x".repeat(32),
} as ApiConfig;

function queue(overrides: Partial<VerificationEmailQueueRepository> = {}): VerificationEmailQueueRepository {
  return {
    consumeCooldown: async () => ({ allowed: true, reservationToken: "reservation-token" }),
    releaseCooldown: async () => true,
    enqueue: async (input) => ({ id: input.id, created: true }),
    hasDelivery: async () => false,
    claim: async () => [],
    complete: async () => false,
    retry: async () => false,
    dead: async () => false,
    ...overrides,
  };
}

function handle(overrides: Partial<AuthHandle["auth"]["api"]> = {}, operation?: AuthHandle["withVerificationOperation"]): AuthHandle {
  return {
    auth: { api: {
      signUpEmail: vi.fn(),
      sendVerificationEmail: vi.fn(),
      verifyEmail: vi.fn(),
      ...overrides,
    } } as unknown as AuthHandle["auth"],
    queue: {} as AuthHandle["queue"],
    withVerificationOperation: operation ?? (async (_key, action) => ({
      value: await action(),
    })),
    closeDb: async () => undefined,
  };
}

describe("RegistrationService review regressions", () => {
  it("maps only expected verification failures to invalid links", async () => {
    const invalid = new RegistrationService(config, handle({
      verifyEmail: vi.fn().mockRejectedValue(APIError.from("UNAUTHORIZED", {
        code: "INVALID_TOKEN",
        message: "Invalid token",
      })),
    }), queue());
    await expect(invalid.verify("token")).rejects.toBeInstanceOf(InvalidVerificationError);

    const outage = new RegistrationService(config, handle({
      verifyEmail: vi.fn().mockRejectedValue(new Error("database unavailable")),
    }), queue());
    await expect(outage.verify("token")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("accepts an ambiguous callback error only when the delivery persisted", async () => {
    const persisted = new RegistrationService(config, handle({}, async () => {
      throw new Error("response lost after commit");
    }), queue({ hasDelivery: async () => true }));
    await expect(persisted.resend("marketer@example.com")).resolves.toEqual({
      status: "verification-pending",
    });

    const missing = new RegistrationService(config, handle({}, async () => {
      throw new Error("enqueue failed");
    }), queue());
    await expect(missing.resend("marketer@example.com")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("releases its own cooldown reservation after handoff failure", async () => {
    const releaseCooldown = vi.fn().mockResolvedValue(true);
    const service = new RegistrationService(config, handle({}, async () => {
      throw new Error("enqueue failed");
    }), queue({ releaseCooldown }));
    await expect(service.resend("marketer@example.com")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(releaseCooldown).toHaveBeenCalledOnce();
  });

  it("keeps duplicate public requests generic while avoiding a second delivery", async () => {
    const releaseCooldown = vi.fn().mockResolvedValue(true);
    const service = new RegistrationService(config, handle(), queue({
      consumeCooldown: async () => ({
        allowed: false,
        retryAfterSeconds: 30,
        reservationToken: "active-reservation",
      }),
      hasDelivery: async () => true,
      releaseCooldown,
    }));
    await expect(service.resend("marketer@example.com")).rejects.toBeInstanceOf(VerificationCooldownError);
    expect(releaseCooldown).not.toHaveBeenCalled();
  });

  it("confirms a duplicate-race result before accepting signup", async () => {
    const failedCreate = APIError.from("UNPROCESSABLE_ENTITY", {
      code: "FAILED_TO_CREATE_USER",
      message: "Failed to create user",
    });
    const signUpEmail = vi.fn()
      .mockRejectedValueOnce(failedCreate)
      .mockRejectedValueOnce(failedCreate);
    const service = new RegistrationService(config, handle({ signUpEmail }), queue());
    await expect(service.signUp("marketer@example.com", "correct-horse-battery-staple"))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(signUpEmail).toHaveBeenCalledTimes(2);

    signUpEmail.mockReset();
    signUpEmail.mockRejectedValueOnce(failedCreate).mockResolvedValueOnce({ token: null });
    const accepted = new RegistrationService(
      config,
      handle({ signUpEmail }),
      queue({ hasDelivery: async () => true }),
    );
    await expect(accepted.signUp("marketer@example.com", "correct-horse-battery-staple"))
      .resolves.toEqual({ status: "verification-pending" });
  });
});
