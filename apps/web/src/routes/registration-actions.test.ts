import { describe, expect, it, vi } from "vitest";
import { executeSignUpAction as signUpAction } from "./registration-actions.js";

function request(form: Record<string, string>) {
  const body = new URLSearchParams(form);
  return new Request("http://127.0.0.1/sign-up", { method: "POST", body });
}

describe("registration actions", () => {
  it("validates fields before calling the generated client", async () => {
    const fetchImplementation = vi.fn();
    const result = await signUpAction(request({ email: "bad", password: "short" }), fetchImplementation);
    expect(result).toMatchObject({ status: "invalid" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("uses the generated facade with required same-origin headers", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ status: "verification-pending" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const result = await signUpAction(
      request({ email: "marketer@example.com", password: "correct-horse-battery-staple" }),
      fetchImplementation,
    );

    expect(result).toEqual({ status: "verification-pending", email: "marketer@example.com" });
    const [sentRequest] = fetchImplementation.mock.calls[0]!;
    const headers = new Headers(sentRequest.headers);
    expect(headers.get("Origin")).toBe("http://127.0.0.1");
    expect(headers.get("Sec-Fetch-Site")).toBe("same-origin");
  });

  it("never returns the password in action data", async () => {
    const result = await signUpAction(
      request({ email: "marketer@example.com", password: "correct-horse-battery-staple" }),
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    expect(result).toEqual({
      status: "error",
      email: "marketer@example.com",
      message: "Registration is temporarily unavailable. Try again.",
    });
    expect(JSON.stringify(result)).not.toContain("correct-horse-battery-staple");
  });
});
