import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const expected = {
  "@playwright/test": "1.61.1",
  "@nestjs/common": "11.1.28",
  "better-auth": "1.6.23",
  "drizzle-kit": "0.31.10",
  "drizzle-orm": "0.45.2",
  "react": "19.2.7",
  "react-dom": "19.2.7",
  "react-router": "8.2.0",
  "typescript": "5.9.3",
  "vite": "8.1.5",
  "vitest": "4.1.10",
};

describe("pinned toolchain", () => {
  it("pins required versions and npm", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    expect(manifest.packageManager).toBe("npm@10.9.4");
    expect(manifest.engines.node).toBe(">=22.22.0");
    expect({ ...manifest.dependencies, ...manifest.devDependencies }).toMatchObject(expected);
  });

  it("pins CI Node", async () => {
    expect((await readFile(".node-version", "utf8")).trim()).toBe("22.22.0");
  });
});
