import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authSchema, createDb, type DbHandle } from "@url-shortener/db";
import type { ApiConfig } from "../config.js";

function buildAuth(config: ApiConfig, db: DbHandle["db"]) {
  return betterAuth({
    baseURL: config.publicOrigin,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.publicOrigin],
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    emailAndPassword: { enabled: true },
  });
}

export type BetterAuthInstance = ReturnType<typeof buildAuth>;

export interface AuthHandle {
  auth: BetterAuthInstance;
  /** Closes the auth database pool; idempotent. */
  closeDb(): Promise<void>;
}

/**
 * The one auth owner (AD-9): Better Auth over the shared Drizzle schema.
 * Session cookies inherit Better Auth defaults (HttpOnly, SameSite=Lax,
 * Secure on https baseURL); no second session store, no community wrapper.
 * Email verification flows are Story 1.4 scope.
 */
export function createAuth(config: ApiConfig): AuthHandle {
  const handle = createDb(config.databaseUrl);
  return { auth: buildAuth(config, handle.db), closeDb: handle.close };
}
