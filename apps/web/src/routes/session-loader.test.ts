import { createApiClient } from "@url-shortener/contracts";
import { describe, expect, it } from "vitest";
import { createSessionLoader } from "./session-loader.js";

const loaderArguments = (url: string) => ({ request: new Request(url) });

function clientReturning(status: number, capture?: (request: Request) => void) {
  return createApiClient(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    capture?.(request);
    if (status >= 400) {
      return new Response(JSON.stringify({ status }), {
        status,
        headers: { "content-type": "application/problem+json" },
      });
    }
    return new Response(JSON.stringify({ actorId: "actor-1" }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }, "http://localhost");
}

describe("protected session loader", () => {
  it("allows navigation when /api/me confirms the actor", async () => {
    const loader = createSessionLoader(clientReturning(200));
    await expect(loader(loaderArguments("http://localhost/dashboard"))).resolves.toBeNull();
  });

  it("redirects to sign-in preserving the intended route when unauthenticated", async () => {
    const loader = createSessionLoader(clientReturning(401));
    const result = await loader(loaderArguments("http://localhost/links"));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/sign-in?redirectTo=%2Flinks");
  });

  it("preserves the intended query string, not just the pathname", async () => {
    const loader = createSessionLoader(clientReturning(401));
    const result = await loader(loaderArguments("http://localhost/links?filter=active&tab=2"));
    expect((result as Response).headers.get("location")).toBe(
      `/sign-in?redirectTo=${encodeURIComponent("/links?filter=active&tab=2")}`,
    );
  });

  it("fails closed to sign-in when the session check cannot complete", async () => {
    const failingClient = createApiClient(async () => {
      throw new TypeError("network down");
    }, "http://localhost");
    const loader = createSessionLoader(failingClient);
    const result = await loader(loaderArguments("http://localhost/account"));
    expect((result as Response).headers.get("location")).toBe("/sign-in?redirectTo=%2Faccount");
  });

  it("requests /api/me same-origin with credentials through the generated client", async () => {
    let captured: Request | undefined;
    const loader = createSessionLoader(clientReturning(200, (request) => {
      captured = request;
    }));
    await loader(loaderArguments("http://localhost/dashboard"));
    expect(captured?.url).toContain("/api/me");
    expect(captured?.credentials).toBe("same-origin");
  });
});
