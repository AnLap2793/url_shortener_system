import {
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { PgReadinessProbe } from "@url-shortener/db";
import { SessionPlaceholderController } from "./auth/session-placeholder.controller.js";
import type { ApiConfig } from "./config.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";
import { ReadinessProbeLifecycle } from "./readiness-probe.provider.js";
import { RequestLoggerMiddleware } from "./request-logger.middleware.js";
import { SpaFallbackMiddleware } from "./web-static/spa-fallback.middleware.js";
import { StaticAssetsMiddleware } from "./web-static/static-assets.middleware.js";
import { createLogger } from "@url-shortener/observability";
import { API_CONFIG, READINESS_PROBE } from "./tokens.js";

@Module({})
export class AppModule implements NestModule {
  static register(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, SessionPlaceholderController],
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
        StaticAssetsMiddleware,
        SpaFallbackMiddleware,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("health");
    // Both middleware self-disable when webDistDir is absent and pass reserved
    // paths through so controllers keep ownership (AD-2).
    consumer
      .apply(StaticAssetsMiddleware, SpaFallbackMiddleware)
      .forRoutes({ path: "{*splat}", method: RequestMethod.ALL });
  }
}
