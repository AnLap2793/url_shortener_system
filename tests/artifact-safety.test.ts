import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readTree(path: string): Promise<{ files: string[]; content: string }> {
  await access(path);
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return readTree(child);
    return { files: [child], content: await readFile(child, "utf8") };
  }));
  return {
    files: nested.flatMap((item) => item.files),
    content: nested.map((item) => item.content).join("\n"),
  };
}

describe("web artifact safety", () => {
  it("scans actual production output for injected server-only values", async () => {
    const artifact = await readTree("apps/web/dist");
    expect(artifact.files.some((file) => file.endsWith("index.html"))).toBe(true);
    expect(artifact.files.some((file) => file.endsWith(".js"))).toBe(true);
    expect(artifact.content).not.toContain("private-build-sentinel");
    expect(artifact.content).not.toContain(".env");
  });
});
