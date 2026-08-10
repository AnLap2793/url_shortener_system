import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { isAPIError } from "better-auth/api";
import {
  CheckVerificationEmailDelivery,
  ConsumeVerificationEmailCooldown,
  createVerificationEmailCooldownKey,
  type VerificationEmailQueueRepository,
} from "@url-shortener/application";
import { API_CONFIG, AUTH_HANDLE, VERIFICATION_EMAIL_QUEUE } from "../tokens.js";
import type { ApiConfig } from "../config.js";
import type { AuthHandle } from "../auth/better-auth-instance.js";

const pending = { status: "verification-pending" as const };
const invalidVerificationCodes = new Set(["INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"]);

export class VerificationCooldownError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Verification email cooldown is active");
  }
}

export class InvalidVerificationError extends Error {}

@Injectable()
export class RegistrationService {
  readonly #consumeCooldown: ConsumeVerificationEmailCooldown;
  readonly #hasDelivery: CheckVerificationEmailDelivery;

  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    @Inject(AUTH_HANDLE) private readonly authHandle: AuthHandle,
    @Inject(VERIFICATION_EMAIL_QUEUE) queue: VerificationEmailQueueRepository,
  ) {
    this.#consumeCooldown = new ConsumeVerificationEmailCooldown(queue);
    this.#hasDelivery = new CheckVerificationEmailDelivery(queue);
  }

  async signUp(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    try {
      await this.authHandle.auth.api.signUpEmail({ body: { email, password, name: "Marketer" } });
    } catch (error) {
      if (!isDuplicateCreateRace(error)) throw error;
      await this.confirmExistingAccount(email, password);
    }
    await this.withCooldown(email, (logicalKey) => this.sendVerification(email, logicalKey));
    return pending;
  }

  async resend(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    await this.withCooldown(email, (logicalKey) => this.sendVerification(email, logicalKey));
    return pending;
  }

  async confirmExistingAccount(email: string, password: string): Promise<void> {
    try {
      await this.authHandle.auth.api.signUpEmail({
        body: { email, password, name: "Marketer" },
      });
    } catch {
      throw new ServiceUnavailableException("Registration is temporarily unavailable");
    }
  }

  async verify(token: string) {
    try {
      await this.authHandle.auth.api.verifyEmail({ query: { token } });
      return { status: "verified" as const };
    } catch (error) {
      if (isExpectedInvalidVerification(error)) throw new InvalidVerificationError();
      throw new ServiceUnavailableException("Verification is temporarily unavailable");
    }
  }

  async withCooldown(email: string, operation: (logicalKey: string) => Promise<void>): Promise<void> {
    const reservation = await this.consumeCooldown(email);
    if (!reservation.allowed) {
      throw new VerificationCooldownError(reservation.retryAfterSeconds ?? 1);
    }
    try {
      await operation(reservation.logicalKey);
    } catch (error) {
      await this.releaseCooldown(reservation);
      throw error;
    }
  }

  async consumeCooldown(email: string): Promise<{
    allowed: boolean;
    digest: string;
    logicalKey: string;
    reservationToken?: string;
    retryAfterSeconds?: number;
  }> {
    const digest = createVerificationEmailCooldownKey(email, this.config.betterAuthSecret);
    const result = await this.#consumeCooldown.execute(digest, 60);
    return {
      allowed: result.allowed,
      digest,
      logicalKey: result.reservationToken ?? "cooldown-rejected",
      reservationToken: result.reservationToken,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }

  async releaseCooldown(reservation: { digest: string; reservationToken?: string }): Promise<void> {
    if (reservation.reservationToken) {
      await this.#consumeCooldown.release(reservation.digest, reservation.reservationToken);
    }
  }

  async sendVerification(email: string, logicalKey: string): Promise<void> {
    try {
      await this.authHandle.withVerificationOperation(logicalKey, () =>
        this.authHandle.auth.api.sendVerificationEmail({ body: { email } }),
      );
    } catch {
      if (await this.#hasDelivery.execute(logicalKey)) return;
      throw new ServiceUnavailableException("Verification delivery is temporarily unavailable");
    }
    if (await this.#hasDelivery.execute(logicalKey)) return;
    // Better Auth intentionally performs a no-op for absent/already-verified accounts.
  }
}

function isExpectedInvalidVerification(error: unknown): boolean {
  return isAPIError(error) && invalidVerificationCodes.has(String(error.body?.code));
}

function isDuplicateCreateRace(error: unknown): boolean {
  return isAPIError(error) && error.statusCode === 422 && error.body?.code === "FAILED_TO_CREATE_USER";
}
