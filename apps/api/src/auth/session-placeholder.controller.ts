import { Controller, Get, Header, HttpCode } from "@nestjs/common";

/**
 * No session mechanism exists yet, so every session lookup is truthfully 401.
 * Story 1.3 mounts the official Better Auth handler at /api/auth/*splat before
 * Nest routes and REMOVES this controller (AD-9: Better Auth owns identity).
 */
@Controller("api/auth")
export class SessionPlaceholderController {
  @Get("session")
  @HttpCode(401)
  @Header("Cache-Control", "no-store")
  @Header("Content-Type", "application/problem+json")
  session(): Record<string, unknown> {
    return {
      type: "about:blank",
      title: "Unauthenticated",
      status: 401,
      detail: "Sign in to access this resource.",
      code: "UNAUTHENTICATED",
    };
  }
}
