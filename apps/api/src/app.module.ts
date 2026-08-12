import {
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { PgLoginRateLimitRepository, PgReadinessProbe } from "@url-shortener/db";
import { AuthLifecycle } from "./auth/auth-lifecycle.provider.js";
import { AuthenticationController } from "./auth/authentication.controller.js";
import { AuthenticationService } from "./auth/authentication.service.js";
import { LoginRateLimitLifecycle } from "./auth/login-rate-limit-lifecycle.provider.js";
import type { AuthHandle } from "./auth/better-auth-instance.js";
import type { ApiConfig } from "./config.js";
import { HealthController } from "./health/health.controller.js";
import { MeController } from "./me/me.controller.js";
import { HealthService } from "./health/health.service.js";
import { ReadinessProbeLifecycle } from "./readiness-probe.provider.js";
import { RequestLoggerMiddleware } from "./request-logger.middleware.js";
import { SpaFallbackMiddleware } from "./web-static/spa-fallback.middleware.js";
import { StaticAssetsMiddleware } from "./web-static/static-assets.middleware.js";
import { createLogger } from "@url-shortener/observability";
import {
  API_CONFIG,
  AUTH_HANDLE,
  LOGIN_RATE_LIMITER,
  READINESS_PROBE,
  VERIFICATION_EMAIL_QUEUE,
} from "./tokens.js";
import { RegistrationController } from "./registration/registration.controller.js";
import { RegistrationService } from "./registration/registration.service.js";

@Module({})
export class AppModule implements NestModule {
  static register(config: ApiConfig, authHandle?: AuthHandle): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        MeController,
        RegistrationController,
        AuthenticationController,
      ],
      providers: [
        { provide: API_CONFIG, useValue: config },
        { provide: AUTH_HANDLE, useValue: authHandle },
        { provide: VERIFICATION_EMAIL_QUEUE, useValue: authHandle?.queue },
        {
          provide: LOGIN_RATE_LIMITER,
          inject: [API_CONFIG],
          useFactory: (value: ApiConfig) => new PgLoginRateLimitRepository(value.databaseUrl),
        },
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
        RegistrationService,
        AuthenticationService,
        ReadinessProbeLifecycle,
        AuthLifecycle,
        LoginRateLimitLifecycle,
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
