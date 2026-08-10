import { describe, expect, it, vi } from "vitest";
import {
  CaptureVerificationEmailTransport,
  FailingVerificationEmailTransport,
  type VerificationEmailDelivery,
} from "./verification-email-delivery.js";

const delivery: VerificationEmailDelivery = {
  id: "opaque-delivery-id",
  recipient: "marketer@example.com",
  verificationUrl: "https://links.example.com/verify-email?token=opaque",
};

describe("verification email delivery contracts", () => {
  it("captures injected deliveries without external effects", async () => {
    const transport = new CaptureVerificationEmailTransport();
    await expect(transport.deliver(delivery)).resolves.toEqual({ status: "sent" });
    expect(transport.deliveries).toEqual([delivery]);
  });

  it("returns an injected sanitized failure", async () => {
    const transport = new FailingVerificationEmailTransport("rate-limited", 12);
    await expect(transport.deliver(delivery)).resolves.toEqual({
      status: "failed",
      category: "rate-limited",
      retryable: true,
      retryAfterSeconds: 12,
    });
  });

  it("capture does not retain later caller mutations", async () => {
    const transport = new CaptureVerificationEmailTransport();
    await transport.deliver(delivery);
    const first = transport.deliveries[0];
    expect(first).not.toBe(delivery);
    expect(vi.isMockFunction(transport.deliver)).toBe(false);
  });
});
