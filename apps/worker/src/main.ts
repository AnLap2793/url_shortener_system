import { createLogger } from "@url-shortener/observability";

const logger = createLogger();
const abortController = new AbortController();

async function stop(signal: NodeJS.Signals): Promise<void> {
  logger.info("worker stopping", { correlationId: "worker-lifecycle", signal });
  abortController.abort();
}

process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
logger.info("worker ready", { correlationId: "worker-lifecycle" });

await new Promise<void>((resolve) => abortController.signal.addEventListener("abort", () => resolve(), { once: true }));
