import { CaptureVerificationEmailTransport } from "@url-shortener/application";
import { PgVerificationEmailQueueRepository } from "@url-shortener/db";
import { createLogger } from "@url-shortener/observability";
import type { WorkerConfig } from "./config.js";
import { ResendVerificationEmailTransport } from "./email/resend-verification-email-transport.js";
import { VerificationEmailDeliveryLoop } from "./verification-email-delivery-loop.js";

export function createWorker(config: WorkerConfig, signal: AbortSignal) {
  const queue = new PgVerificationEmailQueueRepository(config.databaseUrl);
  const transport = config.emailDeliveryMode === "capture"
    ? new CaptureVerificationEmailTransport()
    : new ResendVerificationEmailTransport({ apiKey: config.resendApiKey, from: config.emailFrom });
  const logger = createLogger();
  const loop = new VerificationEmailDeliveryLoop(queue, transport, {
    signal,
    onTransition: ({ deliveryId, attempt, state, category }) => logger.info(
      "verification email transition",
      {
        correlationId: deliveryId,
        deliveryId,
        attempt,
        state,
        ...(category ? { category } : {}),
      },
    ),
  });
  return { run: () => loop.run(), close: () => queue.close() };
}
