import { describe, expect, it, vi } from "vitest";
import { createAuthLifecycleDeny } from "./auth-lifecycle-deny.middleware.js";

function invoke(path: string) {
  const status = vi.fn().mockReturnThis();
  const type = vi.fn().mockReturnThis();
  const set = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn();
  createAuthLifecycleDeny()({ path } as never, { status, type, set, json } as never, next);
  return { status, type, set, json, next };
}

describe("raw Better Auth lifecycle denylist", () => {
  it.each([
    "/sign-up/email",
    "/send-verification-email",
    "/verify-email",
    "/api/auth/sign-up/email",
    "/api/auth/send-verification-email",
    "/api/auth/verify-email",
  ])("denies %s before the auth handler", (path) => {
    const result = invoke(path);
    expect(result.status).toHaveBeenCalledWith(404);
    expect(result.type).toHaveBeenCalledWith("application/problem+json");
    expect(result.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(result.next).not.toHaveBeenCalled();
    expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("passes unrelated lifecycle routes to Better Auth", () => {
    const result = invoke("/get-session");
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
  });
});
