import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { createAuth, type AuthHandle } from "./auth/better-auth-instance.js";
import { createAuthLifecycleDeny } from "./auth/auth-lifecycle-deny.middleware.js";
import type { ApiConfig } from "./config.js";
import { registrationParserError } from "./registration/registration-parser-error.middleware.js";
import { createOriginCheck } from "./security/origin-check.middleware.js";

interface ExpressLike {
  set(name: string, value: unknown): void;
  use(path: string, handler: unknown): void;
  use(handler: unknown): void;
  all(path: string, handler: unknown): void;
}

interface BodyParserCapable {
  useBodyParser(parser: "json" | "urlencoded", options?: Record<string, unknown>): void;
}

/**
 * Composition root wiring order is load-bearing (AD-9/AD-18):
 * 1. origin check guards every unsafe /api request, including auth;
 * 2. the official Better Auth handler owns /api/auth/*splat BEFORE any body
 *    parser touches the stream (bodyParser: false at create);
 * 3. JSON/urlencoded parsing is re-enabled afterwards for Nest routes only.
 */
export async function bootstrap(
  config: ApiConfig,
  authHandle: AuthHandle = createAuth(config),
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(config, authHandle), {
    bodyParser: false,
    logger: false,
  });
  const server = app.getHttpAdapter().getInstance() as ExpressLike;
  server.set("trust proxy", config.trustedProxyHops);
  server.use("/api", createOriginCheck(config.publicOrigin));
  server.use("/api/auth", createAuthLifecycleDeny());
  server.all("/api/auth/*splat", toNodeHandler(authHandle.auth));
  (app as unknown as BodyParserCapable).useBodyParser("json");
  (app as unknown as BodyParserCapable).useBodyParser("urlencoded", { extended: true });
  server.use(registrationParserError);
  app.enableShutdownHooks();
  return app;
}
