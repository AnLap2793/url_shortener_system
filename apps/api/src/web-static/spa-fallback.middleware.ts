import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { isControllerOwnedRoute } from "@url-shortener/application";
import { join } from "node:path";
import type { ApiConfig } from "../config.js";
import { API_CONFIG } from "../tokens.js";
import {
  decodeRequestPath,
  requestPath,
  serveFile,
  type StaticResponseLike,
} from "./serve-static-file.js";

interface RequestLike { method: string; url: string; headers: Record<string, string | string[] | undefined> }

/**
 * Serves the SPA entry document for browser routes so client-side route
 * refreshes never 404 (AD-2). Controller-owned paths (api/health/assets) always
 * pass through to Nest; short-path registry precedence arrives with Epic 3.
 */
@Injectable()
export class SpaFallbackMiddleware implements NestMiddleware {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  use(request: RequestLike, response: StaticResponseLike, next: () => void): void {
    this.#serve(request, response, next).catch(() => {
      if (!response.headersSent) next();
      else response.end();
    });
  }

  async #serve(request: RequestLike, response: StaticResponseLike, next: () => void): Promise<void> {
    const distRoot = this.config.webDistDir;
    if (!distRoot || !["GET", "HEAD"].includes(request.method)) return next();
    const accept = request.headers.accept;
    const acceptsHtml = typeof accept === "string" && accept.includes("text/html");
    if (!acceptsHtml) return next();
    const rawPath = requestPath(request.url);
    if (!rawPath) return next();
    const decoded = decodeRequestPath(rawPath);
    if (!decoded) return next();
    // Express matches routes case-insensitively and ignores trailing slashes;
    // classification must normalize the same way or controller routes like
    // /Api/auth/session or /health/live/ would receive the SPA document.
    const classifierPath = decoded.toLowerCase().replace(/\/+$/, "") || "/";
    if (isControllerOwnedRoute(classifierPath)) return next();
    response.setHeader("Vary", "Accept");
    const served = await serveFile(join(distRoot, "index.html"), "no-cache", request.method, response);
    if (!served) next();
  }
}
