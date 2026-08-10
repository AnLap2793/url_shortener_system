type Cleanup = () => void | Promise<void>;

export class WorkerLifecycle {
  readonly #abortController = new AbortController();
  readonly #cleanup = new Set<Cleanup>();

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }

  register(cleanup: Cleanup): () => void {
    this.#cleanup.add(cleanup);
    return () => this.#cleanup.delete(cleanup);
  }

  async stop(timeoutMs = 2_000): Promise<void> {
    this.#abortController.abort();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled([...this.#cleanup].map((cleanup) => cleanup())),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, timeoutMs); }),
    ]);
    if (timeout) clearTimeout(timeout);
  }
}
