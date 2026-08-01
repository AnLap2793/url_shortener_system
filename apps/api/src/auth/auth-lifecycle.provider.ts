import { Inject, Injectable, Optional, type OnApplicationShutdown } from "@nestjs/common";
import { AUTH_HANDLE } from "../tokens.js";
import type { AuthHandle } from "./better-auth-instance.js";

/** Closes the auth database pool within a bounded deadline on SIGTERM. */
@Injectable()
export class AuthLifecycle implements OnApplicationShutdown {
  constructor(@Optional() @Inject(AUTH_HANDLE) private readonly authHandle?: AuthHandle) {}

  async onApplicationShutdown(): Promise<void> {
    if (!this.authHandle) return;
    await Promise.race([
      this.authHandle.closeDb(),
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}
