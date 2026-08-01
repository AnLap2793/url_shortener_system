import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { ActorId } from "@url-shortener/application";
import { AUTH_HANDLE } from "../tokens.js";
import type { AuthHandle } from "./better-auth-instance.js";

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  actorId?: ActorId;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

const unauthenticatedProblem = {
  type: "about:blank",
  title: "Unauthenticated",
  status: 401,
  detail: "Sign in to access this resource.",
  code: "UNAUTHENTICATED",
};

/**
 * Resolves the canonical session through Better Auth's server API (AD-9 — no
 * second session store). Any failure, including an unreachable database, fails
 * closed to 401 without leaking details.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Optional() @Inject(AUTH_HANDLE) private readonly authHandle?: AuthHandle) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (this.authHandle) {
      try {
        const session = await this.authHandle.auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (session?.user?.id) {
          request.actorId = session.user.id;
          return true;
        }
      } catch {
        // Fail closed below; never surface adapter/database errors here.
      }
    }
    const response = context.switchToHttp().getResponse<ResponseLike>();
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/problem+json");
    throw new UnauthorizedException(unauthenticatedProblem);
  }
}
