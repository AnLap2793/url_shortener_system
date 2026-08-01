import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workspaceManifests = [
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/application/package.json",
  "packages/contracts/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/observability/package.json",
];

const required = {
  "@better-auth/cli": "1.4.21",
  "@nestjs/common": "11.1.28",
  "@nestjs/swagger": "11.4.6",
  "@nestjs/core": "11.1.28",
  "@nestjs/platform-express": "11.1.28",
  "@playwright/test": "1.61.1",
  "@types/node": "22.19.7",
  "@types/pg": "8.15.5",
  "@types/react": "19.2.14",
  "@types/react-dom": "19.2.3",
  "better-auth": "1.6.23",
  "class-transformer": "0.5.1",
  "class-validator": "0.15.1",
  "drizzle-kit": "0.31.10",
  "drizzle-orm": "0.45.2",
  "openapi-fetch": "0.17.0",
  "openapi-typescript": "7.13.0",
  "pg": "8.16.3",
  "react": "19.2.7",
  "react-dom": "19.2.7",
  "react-router": "8.2.0",
  "reflect-metadata": "0.2.2",
  "rxjs": "7.8.2",
  "typescript": "5.9.3",
  "vite": "8.1.5",
  "vitest": "4.1.10",
};

describe("pinned toolchain", () => {
  it("pins every direct dependency and root lock entry exactly", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    const found: Record<string, string> = {};
    for (const manifestPath of ["package.json", ...workspaceManifests]) {
      const current = JSON.parse(await readFile(manifestPath, "utf8"));
      for (const [name, version] of Object.entries({ ...current.dependencies, ...current.devDependencies })) {
        if (String(version) === "0.0.0") continue;
        expect(version, `${manifestPath}: ${name} must use exact semver`).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
        expect(required[name as keyof typeof required], `${manifestPath}: ${name} must be approved`).toBe(version);
        found[name] = String(version);
      }
    }
    expect(found).toMatchObject(required);
    const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
    expect(lock.packages[""].engines.node).toBe(">=22.22.0");
    expect(lock.packages[""].engines.npm).toBe(">=10.9.4 <11");
    expect(manifest.engines.npm).toBe(">=10.9.4 <11");
    expect(manifest.packageManager).toBe("npm@10.9.4");
  });

  it("uses one Node version source in CI", async () => {
    expect((await readFile(".node-version", "utf8")).trim()).toBe("22.22.0");
    const ci = await readFile(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain("node-version-file: .node-version");
    expect(ci).toContain("npm@10.9.4");
  });
});
