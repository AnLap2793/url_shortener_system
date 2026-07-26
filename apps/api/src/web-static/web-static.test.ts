import { NestFactory } from "@nestjs/core";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import type { ApiConfig } from "../config.js";

/** Sends a raw request target verbatim — undici normalizes dot segments client-side. */
function rawGet(baseUrl: string, path: string): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolvePromise, rejectPromise) => {
    const clientRequest = httpRequest(
      { hostname, port, path, method: "GET", headers: { accept: "text/html" } },
      (response) => {
        let body = "";
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () =>
          resolvePromise({ status: response.statusCode ?? 0, body, headers: response.headers }));
      },
    );
    clientRequest.on("error", rejectPromise);
    clientRequest.end();
  });
}

const databaseUrl = "postgres://invalid:secret@127.0.0.1:1/test";
let workspace: string;
let distDir: string;

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), "web-static-"));
  distDir = join(workspace, "dist");
  mkdirSync(join(distDir, "assets"), { recursive: true });
  writeFileSync(join(distDir, "index.html"), "<!doctype html><html><body>shell-index-marker</body></html>");
  writeFileSync(join(distDir, "assets", "app-abc123.js"), "console.log('asset-js-marker');");
  writeFileSync(join(distDir, "assets", "style-abc123.css"), ".marker{color:#000}");
  writeFileSync(join(workspace, "outside-secret.txt"), "outside-dist-secret");
});
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

async function startApi(config: ApiConfig): Promise<string> {
  const app = await NestFactory.create(AppModule.register(config), { logger: false });
  await app.listen(0, "127.0.0.1");
  close = () => app.close();
  const address = app.getHttpServer().address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${address.port}`;
}

describe("same-origin web static hosting", () => {
  it("serves SPA fallback for deep browser routes without 404", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    for (const path of ["/sign-in", "/sign-up", "/dashboard", "/links", "/account", "/links/deep/refresh"]) {
      const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "text/html,*/*" } });
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/html/);
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(await response.text()).toContain("shell-index-marker");
    }
  });

  it("supports HEAD fallback requests with empty body", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    const response = await fetch(`${baseUrl}/dashboard`, { method: "HEAD", headers: { accept: "text/html" } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("serves hashed assets with immutable caching and exact content types", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    const script = await fetch(`${baseUrl}/assets/app-abc123.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(script.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await script.text()).toContain("asset-js-marker");

    const style = await fetch(`${baseUrl}/assets/style-abc123.css`);
    expect(style.headers.get("content-type")).toBe("text/css; charset=utf-8");
  });

  it("keeps reserved API and health routes owned by controllers", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    const live = await fetch(`${baseUrl}/health/live`, { headers: { accept: "text/html" } });
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: "ok" });

    const unknownApi = await fetch(`${baseUrl}/api/unknown`, { headers: { accept: "text/html" } });
    expect(unknownApi.status).toBe(404);
    expect(unknownApi.headers.get("content-type")).toMatch(/^application\/json/);
  });

  it("never serves files outside the dist root", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    for (const path of [
      "/assets/..%2foutside-secret.txt",
      "/assets/..%2f..%2foutside-secret.txt",
      "/assets/%2e%2e/outside-secret.txt",
      "/assets/app-abc123.js%00.txt",
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(await response.text(), path).not.toContain("outside-dist-secret");
      expect(response.status, path).not.toBe(200);
    }
  });

  it("never lets encoded traversal reach dist-root files through the immutable assets namespace", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    for (const path of [
      "/assets/..%2findex.html",
      "/assets/%2e%2e/index.html",
      "/assets/%2e%2e%2findex.html",
      "/assets/..%5cindex.html",
      "/assets/..%2f..%2foutside-secret.txt",
    ]) {
      const response = await rawGet(baseUrl, path);
      expect(String(response.headers["cache-control"] ?? ""), path).not.toContain("immutable");
      expect(response.body, path).not.toContain("outside-dist-secret");
      if (response.status === 200) {
        // Anything that resolves outside assets/ may only be the SPA document
        // via the fallback, never an immutable-cached asset response.
        expect(response.headers["cache-control"], path).toBe("no-cache");
      }
    }
  });

  it("normalizes case and trailing slashes so controller routes never receive the SPA", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    const session = await fetch(`${baseUrl}/Api/auth/session`, { headers: { accept: "text/html" } });
    expect(session.status).toBe(401);
    expect(session.headers.get("content-type")).not.toMatch(/text\/html/);

    const live = await fetch(`${baseUrl}/health/live/`, { headers: { accept: "text/html" } });
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: "ok" });

    const upper = await fetch(`${baseUrl}/DASHBOARD`, { headers: { accept: "text/html" } });
    expect(upper.status).toBe(200);
    expect(upper.headers.get("content-type")).toMatch(/^text\/html/);
  });

  it("does not fall back for non-HTML accept headers", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    // Intended contract: the SPA document is only for clients that ask for
    // HTML; */* or JSON-only clients (curl, monitors, bots) get the API 404.
    for (const accept of ["application/json", "*/*"]) {
      const response = await fetch(`${baseUrl}/dashboard`, { headers: { accept } });
      expect(response.status, accept).toBe(404);
      expect(response.headers.get("content-type"), accept).toMatch(/^application\/json/);
    }
  });

  it("marks fallback responses as varying on Accept", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0, webDistDir: distDir });
    const response = await fetch(`${baseUrl}/dashboard`, { headers: { accept: "text/html" } });
    expect(response.headers.get("vary")).toContain("Accept");
  });

  it("preserves API-only behavior when WEB_DIST_DIR is not configured", async () => {
    const baseUrl = await startApi({ databaseUrl, port: 0 });
    const response = await fetch(`${baseUrl}/dashboard`, { headers: { accept: "text/html" } });
    expect(response.status).toBe(404);
    const live = await fetch(`${baseUrl}/health/live`);
    expect(live.status).toBe(200);
  });
});
