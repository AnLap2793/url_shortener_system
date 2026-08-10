import {
  ProcessVerificationEmailQueue,
  type VerificationEmailQueueRepository,
  type VerificationEmailTransport,
} from "@url-shortener/application";

interface DeliveryLoopOptions {
  batchSize?: number;
  leaseSeconds?: number;
  idleMilliseconds?: number;
  signal?: AbortSignal;
  now?: () => Date;
  onTransition?: (event: {
    deliveryId: string;
    attempt: number;
    state: "sent" | "retry" | "dead" | "stale";
    category?: string;
  }) => void;
}

// Ba provider calls cần hai khoảng chờ: call 1 → 30s → call 2 → 2m → call 3.
const retryDelaysSeconds = [30, 120] as const;

export class VerificationEmailDeliveryLoop {
  readonly #queue: ProcessVerificationEmailQueue;
  readonly #batchSize: number;
  readonly #leaseSeconds: number;
  readonly #idleMilliseconds: number;
  readonly #signal?: AbortSignal;
  readonly #now: () => Date;

  constructor(
    repository: VerificationEmailQueueRepository,
    private readonly transport: VerificationEmailTransport,
    private readonly options: DeliveryLoopOptions = {},
  ) {
    this.#queue = new ProcessVerificationEmailQueue(repository);
    this.#batchSize = options.batchSize ?? 10;
    this.#leaseSeconds = options.leaseSeconds ?? 30;
    this.#idleMilliseconds = options.idleMilliseconds ?? 1_000;
    this.#signal = options.signal;
    this.#now = options.now ?? (() => new Date());
  }

  async run(): Promise<void> {
    while (!this.#signal?.aborted) {
      const count = await this.runOnce();
      if (count === 0) await this.#wait();
    }
  }

  async runOnce(): Promise<number> {
    if (this.#signal?.aborted) return 0;
    const deliveries = await this.#queue.claim(this.#batchSize, this.#leaseSeconds);
    await Promise.all(deliveries.map(async (delivery) => {
      if (delivery.attempt > 3) {
        this.#report(
          delivery.id,
          delivery.attempt,
          await this.#queue.dead(delivery.id, delivery.leaseToken, "attempts-exhausted") ? "dead" : "stale",
          "attempts-exhausted",
        );
        return;
      }
      const result = await this.transport.deliver(delivery);
      if (result.status === "sent") {
        this.#report(delivery.id, delivery.attempt, await this.#queue.complete(delivery.id, delivery.leaseToken) ? "sent" : "stale");
        return;
      }
      if (!result.retryable || delivery.attempt >= 3) {
        this.#report(delivery.id, delivery.attempt, await this.#queue.dead(delivery.id, delivery.leaseToken, result.category) ? "dead" : "stale", result.category);
        return;
      }
      const retryWindow = retryDelaysSeconds[delivery.attempt - 1]!;
      const delaySeconds = Math.min(result.retryAfterSeconds ?? retryWindow, retryWindow);
      const availableAt = new Date(this.#now().getTime() + delaySeconds * 1_000);
      this.#report(delivery.id, delivery.attempt, await this.#queue.retry(delivery.id, delivery.leaseToken, availableAt, result.category) ? "retry" : "stale", result.category);
    }));
    return deliveries.length;
  }

  #report(deliveryId: string, attempt: number, state: "sent" | "retry" | "dead" | "stale", category?: string): void {
    this.options.onTransition?.({ deliveryId, attempt, state, ...(category ? { category } : {}) });
  }

  async #wait(): Promise<void> {
    if (this.#signal?.aborted) return;
    await new Promise<void>((resolve) => {
      const onAbort = () => {
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(() => {
        this.#signal?.removeEventListener("abort", onAbort);
        resolve();
      }, this.#idleMilliseconds);
      this.#signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
