import { describe, expect, it } from "vitest";
import { createSessionLoader } from "./session-loader.js";

const loaderArguments = (url: string) => ({ request: new Request(url), params: {}, context: {} });

describe("protected session loader", () => {
  it("allows navigation when the session endpoint confirms a session", async () => {
    const loader = createSessionLoader(async () => new Response("{}", { status: 200 }));
    await expect(loader(loaderArguments("http://localhost/dashboard"))).resolves.toBeNull();
  });

  it("redirects to sign-in preserving the intended route when unauthenticated", async () => {
    const loader = createSessionLoader(async () => new Response("{}", { status: 401 }));
    const result = await loader(loaderArguments("http://localhost/links"));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/sign-in?redirectTo=%2Flinks");
  });

  it("preserves the intended query string, not just the pathname", async () => {
    const loader = createSessionLoader(async () => new Response("{}", { status: 401 }));
    const result = await loader(loaderArguments("http://localhost/links?filter=active&tab=2"));
    expect((result as Response).headers.get("location")).toBe(
      `/sign-in?redirectTo=${encodeURIComponent("/links?filter=active&tab=2")}`,
    );
  });

  it("fails closed to sign-in when the session check cannot complete", async () => {
    const loader = createSessionLoader(async () => {
      throw new TypeError("network down");
    });
    const result = await loader(loaderArguments("http://localhost/account"));
    expect((result as Response).headers.get("location")).toBe("/sign-in?redirectTo=%2Faccount");
  });

  it("requests the session same-origin with credentials", async () => {
    let captured: RequestInit | undefined;
    const loader = createSessionLoader(async (_input, init) => {
      captured = init;
      return new Response("{}", { status: 200 });
    });
    await loader(loaderArguments("http://localhost/dashboard"));
    expect(captured?.credentials).toBe("same-origin");
  });
});
