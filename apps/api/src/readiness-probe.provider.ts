import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { ReadinessProbe } from "@url-shortener/application";
import { READINESS_PROBE } from "./tokens.js";

@Injectable()
export class ReadinessProbeLifecycle implements OnApplicationShutdown {
  constructor(@Inject(READINESS_PROBE) private readonly probe: ReadinessProbe) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.race([
      this.probe.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}
