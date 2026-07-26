import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";

function runApi(environment: Record<string, string>) {
  return spawn(process.execPath, ["apps/api/dist/main.js"], {
    env: { ...process.env, ...environment },
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
  });

  it("stays live after readiness failure", async () => {
    const child = runApi({ DATABASE_URL: "postgres://invalid:sentinel-secret@127.0.0.1:1/test", PORT: "3198" });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    try {
      let live: Response | undefined;
      for (let attempt = 0; attempt < 20; attempt++) {
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
  });
});
