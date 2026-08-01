import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

describe("HTTP health contract", () => {
  it("serves exact degraded health responses and headers", async () => {
    const app = await NestFactory.create(
      AppModule.register({ databaseUrl: "postgres://invalid:secret@127.0.0.1:1/test", port: 0, betterAuthSecret: "test-secret-0123456789abcdef-0123456789", publicOrigin: "http://127.0.0.1:0" }),
      { logger: false },
    );
    await app.listen(0, "127.0.0.1");
    close = () => app.close();
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const live = await fetch(`${baseUrl}/health/live`);
    expect(live.status).toBe(200);
    expect(live.headers.get("cache-control")).toBe("no-store");
    expect(live.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await live.json()).toEqual({ status: "ok" });

    const started = performance.now();
    const ready = await fetch(`${baseUrl}/health/ready`);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(ready.status).toBe(503);
    expect(ready.headers.get("cache-control")).toBe("no-store");
    expect(await ready.json()).toEqual({ status: "unavailable" });
  });
});
