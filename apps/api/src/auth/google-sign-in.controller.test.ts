import { describe, expect, it, vi } from "vitest";
import type { ApiConfig } from "../config.js";
import { GoogleSignInController } from "./google-sign-in.controller.js";

const config = { publicOrigin: "https://links.example.com" } as ApiConfig;

function response() {
  return { redirect: vi.fn(), setHeader: vi.fn() };
}

describe("GoogleSignInController", () => {
  it.each([
    ["account_not_linked", "collision"],
    ["access_denied", "cancelled"],
    ["state_mismatch", "unavailable"],
    [undefined, "unavailable"],
  ])("maps Better Auth error %s to a local sign-in state", async (error, status) => {
    const controller = new GoogleSignInController({ isGoogleSignInEnabled: () => true } as never, config);
    const result = response();

    await controller.googleFailure({ query: { error, redirectTo: "//evil.example" } }, result);

    expect(result.redirect).toHaveBeenCalledWith(303, `/sign-in?google=${status}&redirectTo=%2Fdashboard`);
  });

  it("redirects the native POST facade and forwards only Better Auth cookies", async () => {
    const startGoogleSignIn = vi.fn().mockResolvedValue({
      cookies: ["better-auth.oauth_state=opaque; HttpOnly"],
      url: "https://accounts.google.com/o/oauth2/v2/auth?opaque",
    });
    const controller = new GoogleSignInController({ startGoogleSignIn } as never, config);
    const result = response();

    await controller.startGoogleSignIn(
      { headers: { origin: "https://links.example.com" } },
      { redirectTo: "/account" },
      result,
    );

    expect(startGoogleSignIn).toHaveBeenCalledWith(expect.anything(), "/account");
    expect(result.setHeader).toHaveBeenCalledWith("Set-Cookie", ["better-auth.oauth_state=opaque; HttpOnly"]);
    expect(result.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(result.redirect).toHaveBeenCalledWith(303, "https://accounts.google.com/o/oauth2/v2/auth?opaque");
  });

  it("preserves only a safe intended route when Google start fails", async () => {
    const startGoogleSignIn = vi.fn().mockRejectedValue(new Error("unavailable"));
    const controller = new GoogleSignInController({ startGoogleSignIn } as never, config);
    const result = response();

    await controller.startGoogleSignIn(
      { headers: { origin: "https://links.example.com" } },
      { redirectTo: "/account" },
      result,
    );

    expect(result.redirect).toHaveBeenCalledWith(303, "/sign-in?google=unavailable&redirectTo=%2Faccount");
  });

  it("drops an unsafe intended route when Google start fails", async () => {
    const startGoogleSignIn = vi.fn().mockRejectedValue(new Error("unavailable"));
    const controller = new GoogleSignInController({ startGoogleSignIn } as never, config);
    const result = response();

    await controller.startGoogleSignIn(
      { headers: { origin: "https://links.example.com" } },
      { redirectTo: "//evil.example" },
      result,
    );

    expect(result.redirect).toHaveBeenCalledWith(303, "/sign-in?google=unavailable&redirectTo=%2Fdashboard");
  });
});
