import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthHandle } from "./better-auth-instance.js";
import { SessionGuard } from "./session.guard.js";

function context(request: Record<string, unknown>, response: { setHeader: ReturnType<typeof vi.fn> }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

function handle(result: unknown): AuthHandle {
  return {
    auth: { api: { getSession: vi.fn().mockResolvedValue(result) } } as unknown as AuthHandle["auth"],
    queue: {} as AuthHandle["queue"],
    withVerificationOperation: async (_key, action) => ({ value: await action() }),
    closeDb: async () => undefined,
  };
}

describe("SessionGuard", () => {
  it("forwards every Better Auth Set-Cookie while assigning an immutable actor", async () => {
    const response = { setHeader: vi.fn() };
    const request = { headers: {} };
    const guard = new SessionGuard(handle({
      headers: { getSetCookie: () => ["session=renewed", "session-data=renewed"] },
      response: { user: { id: "actor-1" } },
    }));

    await expect(guard.canActivate(context(request, response))).resolves.toBe(true);
    expect(response.setHeader).toHaveBeenCalledWith("Set-Cookie", ["session=renewed", "session-data=renewed"]);
    expect(request).toHaveProperty("actorId", "actor-1");
    expect(() => { (request as { actorId?: string }).actorId = "actor-2"; }).toThrow();
  });

  it("forwards a clearing cookie before failing closed", async () => {
    const response = { setHeader: vi.fn() };
    const guard = new SessionGuard(handle({
      headers: { getSetCookie: () => ["session=; Max-Age=0"] },
      response: null,
    }));

    await expect(guard.canActivate(context({ headers: {} }, response))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(response.setHeader).toHaveBeenCalledWith("Set-Cookie", ["session=; Max-Age=0"]);
  });
});
