import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { createAuth, type AuthHandle } from "./auth/better-auth-instance.js";
import type { ApiConfig } from "./config.js";
import { createOriginCheck } from "./security/origin-check.middleware.js";

interface ExpressLike {
  use(path: string, handler: unknown): void;
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
export async function bootstrap(config: ApiConfig): Promise<INestApplication> {
  const authHandle: AuthHandle = createAuth(config);
  const app = await NestFactory.create(AppModule.register(config, authHandle), {
    bodyParser: false,
    logger: false,
  });
  const server = app.getHttpAdapter().getInstance() as ExpressLike;
  server.use("/api", createOriginCheck(config.publicOrigin));
  server.all("/api/auth/*splat", toNodeHandler(authHandle.auth));
  (app as unknown as BodyParserCapable).useBodyParser("json");
  (app as unknown as BodyParserCapable).useBodyParser("urlencoded", { extended: true });
  app.enableShutdownHooks();
  return app;
}
