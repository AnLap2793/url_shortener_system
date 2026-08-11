import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const testSecret = "test-secret-0123456789abcdef-0123456789";

function runApi(environment: Record<string, string>) {
  return spawn(process.execPath, ["apps/api/dist/main.js"], {
    env: { ...process.env, BETTER_AUTH_SECRET: testSecret, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("API process boundaries", () => {
  it("fails before listening without leaking malformed config", async () => {
    const child = runApi({ DATABASE_URL: "sentinel-malformed", PORT: "3199" });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const [code] = await once(child, "exit");
    expect(code).not.toBe(0);
    expect(output).not.toContain("sentinel-malformed");
    await expect(fetch("http://127.0.0.1:3199/health/live")).rejects.toThrow();
  }, 15_000);

  it("stays live after readiness failure", async () => {
    const child = runApi({ DATABASE_URL: "postgres://invalid:sentinel-secret@127.0.0.1:1/test", PORT: "3198" });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    try {
      let live: Response | undefined;
      for (let attempt = 0; attempt < 50; attempt++) {
        live = await fetch("http://127.0.0.1:3198/health/live").catch(() => undefined);
        if (live) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(live?.status).toBe(200);
      expect((await fetch("http://127.0.0.1:3198/health/ready")).status).toBe(503);
      expect((await fetch("http://127.0.0.1:3198/health/live")).status).toBe(200);
      expect(child.exitCode).toBeNull();
      expect(output).not.toContain("sentinel-secret");
    } finally {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }, 15_000);

  it("serves the built SPA for deep-route refreshes when WEB_DIST_DIR is set", async () => {
    const child = runApi({
      DATABASE_URL: "postgres://invalid:secret@127.0.0.1:1/test",
      PORT: "3197",
      WEB_DIST_DIR: resolve("apps/web/dist"),
    });
    try {
      let page: Response | undefined;
      for (let attempt = 0; attempt < 50; attempt++) {
        page = await fetch("http://127.0.0.1:3197/dashboard", { headers: { accept: "text/html" } })
          .catch(() => undefined);
        if (page) break;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      }
      expect(page?.status).toBe(200);
      expect(page?.headers.get("content-type")).toMatch(/^text\/html/);
      // The API must serve the exact artifact the safety scan reads from disk.
      expect(await page?.text()).toBe(readFileSync("apps/web/dist/index.html", "utf8"));
    } finally {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }, 15_000);

  it("fails fast without BETTER_AUTH_SECRET", async () => {
    const environment = {
      ...process.env,
      DATABASE_URL: "postgres://invalid:secret@127.0.0.1:1/test",
      PORT: "3195",
    };
    delete environment.BETTER_AUTH_SECRET;
    const child = spawn(process.execPath, ["apps/api/dist/main.js"], {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const [code] = await once(child, "exit");
    expect(code).not.toBe(0);
    expect(output).toContain("BETTER_AUTH_SECRET");
  }, 15_000);

  it("fails fast for an invalid WEB_DIST_DIR without leaking its value", async () => {
    const emptyDir = join(mkdtempSync(join(tmpdir(), "sentinel-web-dist-")), "sentinel-web-dist");
    const child = runApi({
      DATABASE_URL: "postgres://invalid:secret@127.0.0.1:1/test",
      PORT: "3196",
      WEB_DIST_DIR: emptyDir,
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const [code] = await once(child, "exit");
    expect(code).not.toBe(0);
    expect(output).not.toContain("sentinel-web-dist");
    await expect(fetch("http://127.0.0.1:3196/health/live")).rejects.toThrow();
  });
});
