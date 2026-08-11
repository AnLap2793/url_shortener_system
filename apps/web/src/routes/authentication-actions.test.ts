import { describe, expect, it } from "vitest";
import { executeSignInAction, safeRedirectTo } from "./authentication-actions.js";

function request(path: string, form?: Record<string, string>): Request {
  const body = new FormData();
  for (const [key, value] of Object.entries(form ?? {})) body.set(key, value);
  return new Request(`https://links.example.com${path}`, { method: "POST", body });
}

describe("authentication actions", () => {
  it.each([
    ["/sign-in?redirectTo=%2Fdashboard", "/dashboard"],
    ["/sign-in?redirectTo=%2Flinks%3Ffilter%3Dactive", "/links?filter=active"],
    ["/sign-in?redirectTo=%2F%2Fevil.example", "/dashboard"],
    ["/sign-in?redirectTo=https%3A%2F%2Fevil.example", "/dashboard"],
    ["/sign-in?redirectTo=%2Fsign-in", "/dashboard"],
    ["/sign-in?redirectTo=%2Fdashboard.evil", "/dashboard"],
    ["/sign-in?redirectTo=%2F%255Cevil", "/dashboard"],
    ["/sign-in?redirectTo=%2F%252Fevil", "/dashboard"],
  ])("accepts only protected local redirects: %s", (path, expected) => {
    expect(safeRedirectTo(request(path))).toBe(expected);
  });

  it("preserves email but excludes password from failed action data", async () => {
    const result = await executeSignInAction(
      request("/sign-in", { email: "marketer@example.com", password: "correct-horse-battery-staple" }),
      async () => new Response(JSON.stringify({ code: "INVALID_CREDENTIALS" }), { status: 401 }),
    );
    expect(result).toEqual({ status: "credentials-invalid", email: "marketer@example.com" });
    expect(JSON.stringify(result)).not.toContain("correct-horse-battery-staple");
  });

  it("uses the generated facade protocol and redirects only after success", async () => {
    let received: Request | undefined;
    const result = await executeSignInAction(
      request("/sign-in?redirectTo=%2Faccount", { email: "marketer@example.com", password: "correct-horse-battery-staple" }),
      async (input) => {
        received = input instanceof Request ? input : undefined;
        return new Response(JSON.stringify({ status: "signed-in" }), { status: 200 });
      },
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/account");
    expect(received?.url).toContain("/api/authentication/sign-in");
    expect(received?.headers.get("Sec-Fetch-Site")).toBe("same-origin");
  });
});
