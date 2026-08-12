import { describe, expect, it, vi } from "vitest";
import { createAuthLifecycleDeny } from "./auth-lifecycle-deny.middleware.js";

function invoke(path: string, method = "GET") {
  const status = vi.fn().mockReturnThis();
  const type = vi.fn().mockReturnThis();
  const set = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn();
  createAuthLifecycleDeny()({ path, method } as never, { status, type, set, json } as never, next);
  return { status, type, set, json, next };
}

function expectDenied(path: string, method?: string) {
  const result = invoke(path, method);
  expect(result.status).toHaveBeenCalledWith(404);
  expect(result.type).toHaveBeenCalledWith("application/problem+json");
  expect(result.set).toHaveBeenCalledWith("Cache-Control", "no-store");
  expect(result.next).not.toHaveBeenCalled();
  expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
}

describe("raw Better Auth lifecycle allowlist", () => {
  it("only passes the exact Google callback GET to Better Auth", () => {
    for (const path of ["/callback/google", "/api/auth/callback/google", "/callback/google/"]) {
      const result = invoke(path);
      expect(result.next).toHaveBeenCalledOnce();
      expect(result.status).not.toHaveBeenCalled();
    }
  });

  it.each([
    "/sign-up/email",
    "/send-verification-email",
    "/verify-email",
    "/sign-in/email",
    "/sign-in/social",
    "/sign-out",
    "/get-session",
    "/error",
    "/unknown",
    "/api/auth/sign-in/social",
    "/api/auth/callback/github",
  ])("denies raw route %s before the auth handler", (path) => expectDenied(path));

  it.each(["POST", "PUT", "DELETE"]) ("denies callback method %s", (method) => {
    expectDenied("/callback/google", method);
  });
});
