export type VerificationEmailFailureCategory =
  | "network"
  | "timeout"
  | "rate-limited"
  | "provider-unavailable"
  | "provider-rejected";

export interface VerificationEmailDelivery {
  id: string;
  recipient: string;
  verificationUrl: string;
}

export type VerificationEmailDeliveryResult =
  | { status: "sent" }
  | {
      status: "failed";
      category: VerificationEmailFailureCategory;
      retryable: boolean;
      retryAfterSeconds?: number;
    };

export interface VerificationEmailTransport {
  deliver(delivery: VerificationEmailDelivery): Promise<VerificationEmailDeliveryResult>;
}

export class CaptureVerificationEmailTransport implements VerificationEmailTransport {
  readonly #deliveries: VerificationEmailDelivery[] = [];

  get deliveries(): readonly VerificationEmailDelivery[] {
    return this.#deliveries;
  }

  async deliver(delivery: VerificationEmailDelivery): Promise<VerificationEmailDeliveryResult> {
    this.#deliveries.push({ ...delivery });
    return { status: "sent" };
  }
}

export class FailingVerificationEmailTransport implements VerificationEmailTransport {
  constructor(
    private readonly category: VerificationEmailFailureCategory,
    private readonly retryAfterSeconds?: number,
  ) {}

  async deliver(_delivery: VerificationEmailDelivery): Promise<VerificationEmailDeliveryResult> {
    return {
      status: "failed",
      category: this.category,
      retryable: this.category !== "provider-rejected",
      ...(this.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: this.retryAfterSeconds }),
    };
  }
}
