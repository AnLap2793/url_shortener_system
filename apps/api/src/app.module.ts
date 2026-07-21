import {
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { PgReadinessProbe } from "@url-shortener/db";
import type { ApiConfig } from "./config.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";
import { ReadinessProbeLifecycle } from "./readiness-probe.provider.js";
import { RequestLoggerMiddleware } from "./request-logger.middleware.js";
import { createLogger } from "@url-shortener/observability";
import { API_CONFIG, READINESS_PROBE } from "./tokens.js";

@Module({})
export class AppModule implements NestModule {
  static register(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [
        { provide: API_CONFIG, useValue: config },
        {
          provide: READINESS_PROBE,
          inject: [API_CONFIG],
          useFactory: (value: ApiConfig) => {
            const logger = createLogger();
            return new PgReadinessProbe(value.databaseUrl, 1_000, (category) =>
              logger.info("readiness probe failed", { correlationId: "readiness-probe", category }),
            );
          },
        },
        HealthService,
        ReadinessProbeLifecycle,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("health");
  }
}
