import { describe, expect, it } from "vitest";
import {
  executeSignInAction,
  executeSignOutAction,
  safeRedirectTo,
  shouldRevalidateProtectedSession,
} from "./authentication-actions.js";

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
    ["/sign-in?redirectTo=%2Fdashboard%2F..%2Faccount", "/dashboard"],
    ["/sign-in?redirectTo=%2Fdashboard%2F%252e%252e%2Faccount", "/dashboard"],
  ])("accepts only protected local redirects: %s", (path, expected) => {
    expect(safeRedirectTo(request(path))).toBe(expected);
  });

  it("normalizes email and sends short wrong passwords through the generic credential path", async () => {
    let received: Request | undefined;
    const result = await executeSignInAction(
      request("/sign-in", { email: " Marketer@Example.COM ", password: "wrong" }),
      async (input) => {
        received = input instanceof Request ? input : undefined;
        return new Response(JSON.stringify({ code: "INVALID_CREDENTIALS" }), { status: 401 });
      },
    );
    expect(result).toEqual({ status: "credentials-invalid", email: "marketer@example.com" });
    expect(JSON.stringify(result)).not.toContain("wrong");
    expect(received?.credentials).toBe("same-origin");
    expect(received?.headers.get("Origin")).toBe("https://links.example.com");
    expect(received?.headers.get("Sec-Fetch-Site")).toBe("same-origin");
    await expect(received?.clone().json()).resolves.toEqual({
      email: "marketer@example.com",
      password: "wrong",
    });
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

  it("uses the generated sign-out protocol and redirects only on exact success", async () => {
    let received: Request | undefined;
    const success = await executeSignOutAction(request("/account"), async (input) => {
      received = input instanceof Request ? input : undefined;
      return new Response(JSON.stringify({ status: "signed-out" }), { status: 200 });
    });
    expect(success).toBeInstanceOf(Response);
    expect((success as Response).headers.get("Location")).toBe("/sign-in");
    expect(received?.credentials).toBe("same-origin");
    expect(received?.headers.get("Origin")).toBe("https://links.example.com");
    expect(received?.headers.get("Sec-Fetch-Site")).toBe("same-origin");

    const invalidSuccess = await executeSignOutAction(
      request("/account"),
      async () => new Response(JSON.stringify({ status: "signed-in" }), { status: 200 }),
    );
    expect(invalidSuccess).toEqual({
      status: "error",
      message: "Sign-out is temporarily unavailable. Try again.",
    });
  });

  it("does not revalidate the protected loader after failed sign-out", () => {
    expect(shouldRevalidateProtectedSession({
      formAction: "https://links.example.com/account",
      formMethod: "POST",
      actionResult: { status: "error" },
      defaultShouldRevalidate: true,
    } as never)).toBe(false);
    expect(shouldRevalidateProtectedSession({
      defaultShouldRevalidate: true,
    } as never)).toBe(true);
  });
});
