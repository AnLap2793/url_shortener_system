import type {
  VerificationEmailDelivery,
  VerificationEmailDeliveryResult,
  VerificationEmailTransport,
} from "@url-shortener/application";

const resendEndpoint = "https://api.resend.com/emails";
const timeoutMs = 5_000;
type Fetch = typeof fetch;

export interface ResendVerificationEmailTransportOptions {
  apiKey: string;
  from: string;
  fetchImpl?: Fetch;
}

function retryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get("Retry-After");
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function failed(
  category: "network" | "timeout" | "rate-limited" | "provider-unavailable" | "provider-rejected",
  retryable: boolean,
  retryAfter?: number,
): VerificationEmailDeliveryResult {
  return {
    status: "failed",
    category,
    retryable,
    ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
  };
}

export class ResendVerificationEmailTransport implements VerificationEmailTransport {
  readonly #apiKey: string;
  readonly #from: string;
  readonly #fetch: Fetch;

  constructor(options: ResendVerificationEmailTransportOptions) {
    this.#apiKey = options.apiKey;
    this.#from = options.from;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async deliver(delivery: VerificationEmailDelivery): Promise<VerificationEmailDeliveryResult> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await this.#fetch(resendEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": delivery.id,
        },
        body: JSON.stringify({
          from: this.#from,
          to: [delivery.recipient],
          subject: "Verify your email address",
          text: `Verify your email address: ${delivery.verificationUrl}`,
        }),
        signal: abortController.signal,
      });
      if (response.ok) return { status: "sent" };
      if (response.status === 408) return failed("timeout", true);
      if (response.status === 429) {
        return failed("rate-limited", true, retryAfterSeconds(response.headers));
      }
      if (response.status >= 500) return failed("provider-unavailable", true);
      return failed("provider-rejected", false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        return failed("timeout", true);
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return failed("timeout", true);
      }
      return failed("network", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
