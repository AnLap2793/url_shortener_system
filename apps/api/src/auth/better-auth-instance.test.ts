import { describe, expect, it } from "vitest";
import { createVerificationEmailUrl } from "./verification-handoff.js";

describe("Better Auth email verification composition", () => {
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
