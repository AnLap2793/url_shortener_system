import { Inject, Injectable } from "@nestjs/common";
import type { ReadinessProbe } from "@url-shortener/application";
import { READINESS_PROBE } from "../tokens.js";

@Injectable()
export class HealthService {
  constructor(@Inject(READINESS_PROBE) private readonly readinessProbe: ReadinessProbe) {}

  live() {
    return { status: "ok" as const };
  }

  async ready() {
    return {
      status: (await this.readinessProbe.isReady())
        ? ("ok" as const)
        : ("unavailable" as const),
    };
  }
}
