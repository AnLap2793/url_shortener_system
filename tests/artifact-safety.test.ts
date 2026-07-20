import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readTree(path: string): Promise<string> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map(async (entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? readTree(child) : readFile(child, "utf8").catch(() => "");
  }))).join("\n");
}

describe("web artifact safety", () => {
  it("does not expose server-only environment sentinel", async () => {
    expect(await readTree("apps/web/dist")).not.toContain("STORY_TEST_PRIVATE_SENTINEL");
  });
});
