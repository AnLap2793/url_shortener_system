import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";

async function run(environment: NodeJS.ProcessEnv): Promise<{ code: number | null; output: string }> {
  const child = spawn(process.execPath, ["packages/db/dist/migrate-cli.js"], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const [code] = await once(child, "exit");
  return { code, output };
}

describe("migration CLI", () => {
  it("fails fast when DATABASE_URL is missing", async () => {
    const environment = { ...process.env };
    delete environment.DATABASE_URL;
    const result = await run(environment);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("DATABASE_URL is required for migrations");
  });

  it("does not reveal database credentials when migration fails", async () => {
    const sentinel = "sentinel-migration-password";
    const result = await run({
      ...process.env,
      DATABASE_URL: `postgres://invalid:${sentinel}@127.0.0.1:1/unreachable`,
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("Database migration failed");
    expect(result.output).not.toContain(sentinel);
  });
});
