import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { join } from "node:path";
import type { ApiConfig } from "../config.js";
import { API_CONFIG } from "../tokens.js";
import {
  decodeRequestPath,
  requestPath,
  resolveContainedFile,
  serveFile,
  type StaticResponseLike,
} from "./serve-static-file.js";

interface RequestLike { method: string; url: string }

/** Serves hashed immutable build assets under /assets from the configured web dist. */
@Injectable()
export class StaticAssetsMiddleware implements NestMiddleware {
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
    const rawPath = requestPath(request.url);
    if (!rawPath?.startsWith("/assets/")) return next();
    const decoded = decodeRequestPath(rawPath);
    if (!decoded) return next();
    // Contain within the assets subtree: dist-root files (index.html, manifests)
    // must never be reachable here with an immutable cache lifetime.
    const assetsRoot = join(distRoot, "assets");
    const filePath = resolveContainedFile(assetsRoot, decoded.slice("/assets/".length));
    if (!filePath) return next();
    const served = await serveFile(filePath, "public, max-age=31536000, immutable", request.method, response);
    if (!served) next();
  }
}
