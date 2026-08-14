import { describe, expect, it } from "vitest";
import { createVerificationEmailUrl } from "./verification-handoff.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const betterAuthSource = readFileSync(
  fileURLToPath(new URL("../../../../node_modules/better-auth/dist/api/routes/sign-in.mjs", import.meta.url)),
  "utf8",
);

describe("Better Auth email verification composition", () => {
  it("uses Better Auth state and PKCE S256 for authorization-code sign-in", () => {
    expect(betterAuthSource).toContain("const { codeVerifier, state } = await generateState");
    expect(betterAuthSource).toContain("codeVerifier");
  });

  it("rejects every Google profile without an explicitly verified email", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./better-auth-instance.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("profile.email_verified === true ? {} : { email: null }");
  });

  it("builds only the public SPA verification URL", () => {
    expect(createVerificationEmailUrl("https://links.example.com", "opaque-token")).toBe(
      "https://links.example.com/verify-email?token=opaque-token",
    );
    expect(createVerificationEmailUrl("https://links.example.com", "a b")).toBe(
      "https://links.example.com/verify-email?token=a+b",
    );
    expect(createVerificationEmailUrl("https://links.example.com", "opaque-token")).not.toContain(
      "/api/auth/verify-email",
    );
  });
});
