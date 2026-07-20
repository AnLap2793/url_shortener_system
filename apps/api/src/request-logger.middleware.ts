import { Injectable, type NestMiddleware } from "@nestjs/common";
import { createLogger } from "@url-shortener/observability";
import { randomUUID } from "node:crypto";

interface RequestLike {
  method: string;
  url: string;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: "finish", listener: () => void): void;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  readonly #logger = createLogger();

  use(request: RequestLike, response: ResponseLike, next: () => void): void {
    const correlationId = randomUUID();
    response.setHeader("X-Correlation-Id", correlationId);
    response.once("finish", () =>
      this.#logger.info("request completed", {
        correlationId,
        method: request.method,
        path: new URL(request.url, "http://localhost").pathname,
        statusCode: response.statusCode,
      }),
    );
    next();
  }
}
