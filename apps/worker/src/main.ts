import { createLogger } from "@url-shortener/observability";
import { WorkerLifecycle } from "./worker-lifecycle.js";

const logger = createLogger();
const lifecycle = new WorkerLifecycle();

async function stop(signal: NodeJS.Signals): Promise<void> {
  logger.info("worker stopping", { correlationId: "worker-lifecycle", signal });
  try {
    await lifecycle.stop(2_000);
  } catch {
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
logger.info("worker ready", { correlationId: "worker-lifecycle" });

await new Promise<void>((resolve) => lifecycle.signal.addEventListener("abort", () => resolve(), { once: true }));
