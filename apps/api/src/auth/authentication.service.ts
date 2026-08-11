import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { isAPIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { createLogger } from "@url-shortener/observability";
import {
  ConsumeLoginRateLimit,
  createLoginRateLimitKey,
  type LoginRateLimitRepository,
  type LoginRateLimitScope,
} from "@url-shortener/application";
import { AUTH_HANDLE, LOGIN_RATE_LIMITER, API_CONFIG } from "../tokens.js";
import type { ApiConfig } from "../config.js";
import type { AuthHandle } from "./better-auth-instance.js";

interface RequestHeaders {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export class InvalidCredentialsError extends Error {}
export class EmailVerificationRequiredError extends Error {}
export class LoginThrottledError extends Error {
  constructor(readonly retryAfterSeconds: number, readonly rejectedScopes: LoginRateLimitScope[]) {
    super("Login attempts are throttled");
  }
}

@Injectable()
export class AuthenticationService {
  readonly #consumeRateLimit: ConsumeLoginRateLimit;
  readonly #logger = createLogger();

  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    @Inject(AUTH_HANDLE) private readonly authHandle: AuthHandle,
    @Inject(LOGIN_RATE_LIMITER) limiter: LoginRateLimitRepository,
  ) {
    this.#consumeRateLimit = new ConsumeLoginRateLimit(limiter);
  }

  async signIn(request: RequestHeaders, emailInput: string, password: string): Promise<string[]> {
    const email = emailInput.trim().toLowerCase();
    const sourceIp = request.socket?.remoteAddress ?? "unknown";
    let admission;
    try {
      admission = await this.#consumeRateLimit.execute([
        {
          scope: "account",
          keyDigest: createLoginRateLimitKey("account", email, this.config.betterAuthSecret),
          windowSeconds: 900,
          maximumAttempts: 5,
        },
        {
          scope: "ip",
          keyDigest: createLoginRateLimitKey("ip", sourceIp, this.config.betterAuthSecret),
          windowSeconds: 900,
          maximumAttempts: 30,
        },
      ]);
    } catch {
      throw new ServiceUnavailableException("Authentication is temporarily unavailable");
    }
    if (!admission.allowed) {
      for (const scope of admission.rejectedScopes ?? []) {
        this.#logger.info("login_throttle_total", { correlationId: "login-throttle", scope });
      }
      throw new LoginThrottledError(admission.retryAfterSeconds ?? 1, admission.rejectedScopes ?? []);
    }

    try {
      const result = await this.authHandle.auth.api.signInEmail({
        body: { email, password, rememberMe: false },
        headers: fromNodeHeaders(request.headers),
        returnHeaders: true,
      });
      return result.headers.getSetCookie();
    } catch (error) {
      if (!isAPIError(error)) {
        throw new ServiceUnavailableException("Authentication is temporarily unavailable");
      }
      if (error.body?.code === "EMAIL_NOT_VERIFIED") throw new EmailVerificationRequiredError();
      throw new InvalidCredentialsError();
    }
  }

  async signOut(request: RequestHeaders): Promise<string[]> {
    try {
      const headers = fromNodeHeaders(request.headers);
      const sessionResult = await this.authHandle.auth.api.getSession({ headers, returnHeaders: true });
      const session = sessionResult.response;
      if (session?.session?.token) {
        await this.authHandle.auth.api.revokeSession({
          body: { token: session.session.token },
          headers,
        });
      }
      const signOut = await this.authHandle.auth.api.signOut({ headers, returnHeaders: true });
      return [...sessionResult.headers.getSetCookie(), ...signOut.headers.getSetCookie()];
    } catch {
      throw new ServiceUnavailableException("Authentication is temporarily unavailable");
    }
  }
}
