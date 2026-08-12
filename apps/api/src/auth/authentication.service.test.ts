import { ServiceUnavailableException } from "@nestjs/common";
import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import type { LoginRateLimitRepository } from "@url-shortener/application";
import type { ApiConfig } from "../config.js";
import type { AuthHandle } from "./better-auth-instance.js";
import {
  AuthenticationService,
  EmailVerificationRequiredError,
  GoogleSignInUnavailableError,
  InvalidCredentialsError,
  LoginThrottledError,
} from "./authentication.service.js";

const config = { betterAuthSecret: "x".repeat(32) } as ApiConfig;
const request = {
  headers: { cookie: "session=value" },
  ip: "127.0.0.1",
};

function limiter(result: Awaited<ReturnType<LoginRateLimitRepository["consume"]>>): LoginRateLimitRepository {
  return { consume: vi.fn().mockResolvedValue(result) };
}

function authHandle(overrides: Partial<AuthHandle["auth"]["api"]> = {}): AuthHandle {
  return {
    auth: { api: { signInEmail: vi.fn(), signOut: vi.fn(), ...overrides } } as unknown as AuthHandle["auth"],
    queue: {} as AuthHandle["queue"],
    withVerificationOperation: async (_key, action) => ({ value: await action() }),
    closeDb: async () => undefined,
  };
}

describe("AuthenticationService", () => {
  it("forwards Better Auth cookies without exposing its session token", async () => {
    const signInEmail = vi.fn().mockResolvedValue({
      headers: new Headers([["Set-Cookie", "better-auth.session_token=opaque; HttpOnly"]]),
    });
    const service = new AuthenticationService(config, authHandle({ signInEmail }), limiter({ allowed: true }));

    await expect(service.signIn(request, " Marketer@example.com ", "correct-horse-battery-staple"))
      .resolves.toEqual(["better-auth.session_token=opaque; HttpOnly"]);
    expect(signInEmail).toHaveBeenCalledWith(expect.objectContaining({
      body: { email: "marketer@example.com", password: "correct-horse-battery-staple", rememberMe: false },
      returnHeaders: true,
    }));
  });

  it("stops before Better Auth when either scope is throttled", async () => {
    const signInEmail = vi.fn();
    const service = new AuthenticationService(
      config,
      authHandle({ signInEmail }),
      limiter({ allowed: false, retryAfterSeconds: 30, rejectedScopes: ["account"] }),
    );

    await expect(service.signIn(request, "marketer@example.com", "correct-horse-battery-staple"))
      .rejects.toBeInstanceOf(LoginThrottledError);
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("starts Google only through the fixed provider and safe local redirects", async () => {
    const signInSocial = vi.fn().mockResolvedValue({
      headers: new Headers([["Set-Cookie", "better-auth.oauth_state=opaque; HttpOnly"]]),
      response: { redirect: true, url: "https://accounts.google.com/o/oauth2/v2/auth?opaque" },
    });
    const service = new AuthenticationService(
      { ...config, publicOrigin: "https://links.example.com", googleClientId: "google-client-id" },
      authHandle({ signInSocial }),
      limiter({ allowed: true }),
    );

    await expect(service.startGoogleSignIn(request, "//evil.example")).resolves.toEqual({
      cookies: ["better-auth.oauth_state=opaque; HttpOnly"],
      url: "https://accounts.google.com/o/oauth2/v2/auth?opaque",
    });
    expect(signInSocial).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        provider: "google",
        callbackURL: "https://links.example.com/dashboard",
        newUserCallbackURL: "https://links.example.com/dashboard",
        errorCallbackURL: "https://links.example.com/api/authentication/sign-in/google/error?redirectTo=%2Fdashboard",
        disableRedirect: true,
      }),
      returnHeaders: true,
    }));
  });

  it("fails closed when Google is disabled", async () => {
    const signInSocial = vi.fn();
    const service = new AuthenticationService(config, authHandle({ signInSocial }), limiter({ allowed: true }));
    await expect(service.startGoogleSignIn(request, "/dashboard")).rejects.toBeInstanceOf(GoogleSignInUnavailableError);
    expect(signInSocial).not.toHaveBeenCalled();
  });

  it("only reports signed out after Better Auth revokes the server session", async () => {
    const revokeSession = vi.fn().mockResolvedValue({ status: true });
    const signOut = vi.fn().mockResolvedValue({ headers: new Headers([["Set-Cookie", "session=; Max-Age=0"]]) });
    const service = new AuthenticationService(config, authHandle({
      getSession: vi.fn().mockResolvedValue({
        headers: new Headers(),
        response: { session: { token: "session-token" }, user: { id: "actor-1" } },
      }),
      revokeSession,
      signOut,
    }), limiter({ allowed: true }));

    await expect(service.signOut(request)).resolves.toEqual(["session=; Max-Age=0"]);
    expect(revokeSession).toHaveBeenCalledWith(expect.objectContaining({ body: { token: "session-token" } }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("keeps the session intact when authoritative revocation fails", async () => {
    const revokeSession = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const signOut = vi.fn();
    const service = new AuthenticationService(config, authHandle({
      getSession: vi.fn().mockResolvedValue({
        headers: new Headers(),
        response: { session: { token: "session-token" }, user: { id: "actor-1" } },
      }),
      revokeSession,
      signOut,
    }), limiter({ allowed: true }));

    await expect(service.signOut(request)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("maps only expected Better Auth failures to public authentication states", async () => {
    const invalid = new AuthenticationService(config, authHandle({
      signInEmail: vi.fn().mockRejectedValue(APIError.from("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password",
      })),
    }), limiter({ allowed: true }));
    await expect(invalid.signIn(request, "marketer@example.com", "password"))
      .rejects.toBeInstanceOf(InvalidCredentialsError);

    const unverified = new AuthenticationService(config, authHandle({
      signInEmail: vi.fn().mockRejectedValue(APIError.from("FORBIDDEN", {
        code: "EMAIL_NOT_VERIFIED", message: "Email not verified",
      })),
    }), limiter({ allowed: true }));
    await expect(unverified.signIn(request, "marketer@example.com", "password"))
      .rejects.toBeInstanceOf(EmailVerificationRequiredError);

    const unavailable = new AuthenticationService(config, authHandle({
      signInEmail: vi.fn().mockRejectedValue(new Error("database unavailable")),
    }), limiter({ allowed: true }));
    await expect(unavailable.signIn(request, "marketer@example.com", "password"))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    const sessionFailure = new AuthenticationService(config, authHandle({
      signInEmail: vi.fn().mockRejectedValue(APIError.from("UNAUTHORIZED", {
        code: "FAILED_TO_CREATE_SESSION", message: "Failed to create session",
      })),
    }), limiter({ allowed: true }));
    await expect(sessionFailure.signIn(request, "marketer@example.com", "password"))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("fails closed when Express cannot resolve a client IP", async () => {
    const consume = vi.fn();
    const service = new AuthenticationService(
      config,
      authHandle(),
      { consume },
    );
    await expect(service.signIn({ headers: {} }, "marketer@example.com", "password"))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(consume).not.toHaveBeenCalled();
  });
});
