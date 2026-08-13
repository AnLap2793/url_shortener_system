import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { EnqueueVerificationEmail, type VerificationEmailQueueRepository } from "@url-shortener/application";
import {
  PgVerificationEmailQueueRepository,
  authSchema,
  createDb,
  type DbHandle,
} from "@url-shortener/db";
import type { ApiConfig } from "../config.js";
import { createVerificationEmailUrl } from "./verification-handoff.js";

interface VerificationOperation {
  logicalKey: string;
}

const verificationOperation = new AsyncLocalStorage<VerificationOperation>();
type Queue = VerificationEmailQueueRepository;
const googleFailurePath = "/api/authentication/sign-in/google/error";

// Better Auth merges hook data into its provider payload. Explicit nulls prevent
// OAuth material from reaching the account table while preserving identity fields.
const clearOAuthTokens = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
};

function buildAuth(config: ApiConfig, db: DbHandle["db"], queue: Queue) {
  const enqueueVerificationEmail = new EnqueueVerificationEmail(queue);
  return betterAuth({
    baseURL: config.publicOrigin,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.publicOrigin],
    rateLimit: { enabled: false },
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    logger: { disabled: true },
    onAPIError: { errorURL: `${config.publicOrigin}${googleFailurePath}` },
    socialProviders: config.googleClientId && config.googleClientSecret
      ? {
        google: {
          clientId: config.googleClientId,
          clientSecret: config.googleClientSecret,
          accessType: "online",
          mapProfileToUser: (profile) => profile.email_verified ? {} : { email: null },
        },
      }
      : undefined,
    account: {
      accountLinking: { disableImplicitLinking: true, trustedProviders: [] },
      storeAccountCookie: false,
    },
    databaseHooks: {
      account: {
        create: { before: async () => ({ data: clearOAuthTokens }) },
        update: { before: async () => ({ data: clearOAuthTokens }) },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
    },
    emailVerification: {
      sendOnSignUp: false,
      expiresIn: 3_600,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        const operation = verificationOperation.getStore();
        if (!operation) throw new Error("Verification delivery operation is missing");
        await enqueueVerificationEmail.execute({
          id: randomUUID(),
          logicalKey: operation.logicalKey,
          recipient: user.email,
          verificationUrl: createVerificationEmailUrl(config.publicOrigin, token),
        });
      },
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof buildAuth>;

export interface AuthHandle {
  auth: BetterAuthInstance;
  queue: PgVerificationEmailQueueRepository;
  withVerificationOperation<T>(
    logicalKey: string,
    action: () => Promise<T>,
  ): Promise<{ value: T }>;
  closeDb(): Promise<void>;
}

/** One Better Auth owner plus a durable callback-only verification outbox. */
export function createAuth(config: ApiConfig): AuthHandle {
  const handle = createDb(config.databaseUrl);
  const queue = new PgVerificationEmailQueueRepository(config.databaseUrl);
  const auth = buildAuth(config, handle.db, queue);
  return {
    auth,
    queue,
    withVerificationOperation: async (logicalKey, action) => ({
      value: await verificationOperation.run({ logicalKey }, action),
    }),
    closeDb: async () => {
      await Promise.all([handle.close(), queue.close()]);
    },
  };
}
