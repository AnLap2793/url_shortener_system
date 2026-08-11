import { Inject, Injectable, Optional, type OnApplicationShutdown } from "@nestjs/common";
import { LOGIN_RATE_LIMITER } from "../tokens.js";

interface Closable {
  close(): Promise<void>;
}

@Injectable()
export class LoginRateLimitLifecycle implements OnApplicationShutdown {
  constructor(@Optional() @Inject(LOGIN_RATE_LIMITER) private readonly limiter?: Closable) {}

  async onApplicationShutdown(): Promise<void> {
    if (!this.limiter) return;
    await Promise.race([
      this.limiter.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}
