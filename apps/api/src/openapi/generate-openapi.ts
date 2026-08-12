import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync } from "node:fs";
import { AppModule } from "../app.module.js";
import type { ApiConfig } from "../config.js";

// Build-time document emission (AD-14): DTO metadata is the source of truth.
// The app never listens and never touches a database; config values are inert.
const generationConfig: ApiConfig = {
  databaseUrl: "postgres://openapi:openapi@127.0.0.1:5432/openapi",
  port: 0,
  betterAuthSecret: "openapi-generation-placeholder-secret-000",
  publicOrigin: "http://127.0.0.1:0",
  trustedProxyHops: 0,
};

const app = await NestFactory.create(AppModule.register(generationConfig), {
  bodyParser: false,
  logger: false,
});
await app.init();
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle("URL Shortener API")
    .setDescription("Generated from NestJS DTOs; Better Auth routes are owned by its own handler.")
    .setVersion("0.1.0")
    .build(),
);
await app.close();

const outputPath = process.argv[2] ?? "packages/contracts/openapi.json";
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);
