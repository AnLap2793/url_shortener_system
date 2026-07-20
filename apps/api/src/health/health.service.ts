import { Injectable } from "@nestjs/common";
import type { ReadinessProbe } from "@url-shortener/application";

@Injectable()
export class HealthService {
  constructor(private readonly readinessProbe: ReadinessProbe) {}

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
