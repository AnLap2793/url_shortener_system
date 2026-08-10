import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerificationEmailDelivery } from "@url-shortener/application";
import { ResendVerificationEmailTransport } from "./resend-verification-email-transport.js";

const delivery: VerificationEmailDelivery = {
  id: "opaque-delivery-id",
  recipient: "marketer@example.com",
  verificationUrl: "https://links.example.com/verify-email?token=opaque-token",
};

afterEach(() => vi.useRealTimers());

describe("Resend verification email transport", () => {
  it("sends exactly one text email with the stable delivery id", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status: 202 }),
    );
    const transport = new ResendVerificationEmailTransport({
      apiKey: "provider-secret",
      from: "Marketer <mail@example.com>",
      fetchImpl,
    });

    await expect(transport.deliver(delivery)).resolves.toEqual({ status: "sent" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init).toBeDefined();
    expect(init!.headers).toMatchObject({
      Authorization: "Bearer provider-secret",
      "Idempotency-Key": delivery.id,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init!.body))).toEqual({
      from: "Marketer <mail@example.com>",
      to: [delivery.recipient],
      subject: "Verify your email address",
      text: `Verify your email address: ${delivery.verificationUrl}`,
    });
  });

  it.each([
    [408, "timeout", true],
    [429, "rate-limited", true],
    [500, "provider-unavailable", true],
    [400, "provider-rejected", false],
  ] as const)("classifies HTTP %i without reading response bodies", async (status, category, retryable) => {
    const text = vi.fn(async () => "sentinel-provider-body");
    const response = { ok: false, status, headers: new Headers(), text } as unknown as Response;
    const transport = new ResendVerificationEmailTransport({
      apiKey: "provider-secret",
      from: "mail@example.com",
      fetchImpl: vi.fn(async () => response),
    });

    await expect(transport.deliver(delivery)).resolves.toMatchObject({
      status: "failed",
      category,
      retryable,
    });
    expect(text).not.toHaveBeenCalled();
  });

  it("returns a bounded Retry-After value for provider throttling", async () => {
    const transport = new ResendVerificationEmailTransport({
      apiKey: "provider-secret",
      from: "mail@example.com",
      fetchImpl: vi.fn(async () =>
        new Response(null, { status: 429, headers: { "Retry-After": "120" } }),
      ),
    });
    await expect(transport.deliver(delivery)).resolves.toMatchObject({
      retryAfterSeconds: 120,
    });
  });

  it("classifies network failures without leaking their messages", async () => {
    const transport = new ResendVerificationEmailTransport({
      apiKey: "provider-secret",
      from: "mail@example.com",
      fetchImpl: vi.fn(async () => {
        throw new Error("sentinel provider-secret opaque-token");
      }),
    });
    const result = await transport.deliver(delivery);
    expect(result).toEqual({ status: "failed", category: "network", retryable: true });
    expect(JSON.stringify(result)).not.toContain("sentinel");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
    expect(JSON.stringify(result)).not.toContain("opaque-token");
  });

  it("aborts one network attempt after five seconds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );
    const transport = new ResendVerificationEmailTransport({
      apiKey: "provider-secret",
      from: "mail@example.com",
      fetchImpl,
    });
    const result = transport.deliver(delivery);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toEqual({ status: "failed", category: "timeout", retryable: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
