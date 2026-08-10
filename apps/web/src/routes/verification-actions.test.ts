import { describe, expect, it, vi } from "vitest";
import { resendVerification, verifyEmailToken } from "./verification-actions.js";

const ok = (body: unknown, headers?: HeadersInit) => vi.fn().mockResolvedValue(new Response(
  JSON.stringify(body),
  { status: 200, headers: { "content-type": "application/json", ...headers } },
));

describe("verification actions", () => {
  it("calls the generated verification facade", async () => {
    const result = await verifyEmailToken("opaque-token-value", ok({ status: "verified" }), "http://127.0.0.1");
    expect(result).toEqual({ status: "verified" });
  });

  it("maps invalid verification without exposing details", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: "INVALID_VERIFICATION" }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    ));
    expect(await verifyEmailToken("bad", fetchImplementation, "http://127.0.0.1")).toEqual({ status: "invalid" });
  });

  it("returns an integer cooldown for resend", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: "VERIFICATION_COOLDOWN" }),
      { status: 429, headers: { "content-type": "application/problem+json", "Retry-After": "17" } },
    ));
    expect(await resendVerification("marketer@example.com", fetchImplementation, "http://127.0.0.1")).toEqual({ status: "cooldown", retryAfterSeconds: 17 });
  });
});
