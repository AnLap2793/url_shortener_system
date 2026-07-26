import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

describe("session placeholder contract", () => {
  it("reports the absence of any session as an RFC 9457 401 problem", async () => {
    const app = await NestFactory.create(
      AppModule.register({ databaseUrl: "postgres://invalid:secret@127.0.0.1:1/test", port: 0 }),
      { logger: false },
    );
    await app.listen(0, "127.0.0.1");
    close = () => app.close();
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/session`);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toMatch(/^application\/problem\+json/);
    const problem = await response.json();
    expect(problem).toMatchObject({
      type: "about:blank",
      title: "Unauthenticated",
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(problem).not.toHaveProperty("stack");
  });
});
