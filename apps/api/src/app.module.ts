import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { PgReadinessProbe } from "@url-shortener/db";
import { loadConfig } from "./config.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";
import { RequestLoggerMiddleware } from "./request-logger.middleware.js";

const config = loadConfig();
const readinessProbe = new PgReadinessProbe(config.databaseUrl, 1_000);

@Module({
  controllers: [HealthController],
  providers: [
    { provide: "READINESS_PROBE", useValue: readinessProbe },
    {
      provide: HealthService,
      useFactory: () => new HealthService(readinessProbe),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("health");
  }
}
