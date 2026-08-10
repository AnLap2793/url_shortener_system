import { createLogger } from "@url-shortener/observability";
import { loadWorkerConfig } from "./config.js";
import { createWorker } from "./worker-composition-root.js";
import { WorkerLifecycle } from "./worker-lifecycle.js";

const config = loadWorkerConfig();
const logger = createLogger();
const lifecycle = new WorkerLifecycle();
const worker = createWorker(config, lifecycle.signal);
const runPromise = worker.run();
void runPromise.catch(async () => {
  process.exitCode = 1;
  await worker.close();
});
lifecycle.register(async () => {
  await runPromise.catch(() => undefined);
  await worker.close();
});

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

void runPromise;
