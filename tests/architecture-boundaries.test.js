import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";
import process from "node:process";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const importPattern = /(?:from\s*|import\s*(?:\(\s*)?|export\s+(?:\*|\{[^}]*\})\s*from\s*)["']([^"']+)["']/g;

const rules = [
  { area: "packages/domain", forbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/, /^@url-shortener\/(?:db|contracts|observability)(?:\/|$)/] },
  { area: "apps/worker", forbidden: [/controllers?(?:\/|$)/i, /^@url-shortener\/db(?:\/|$)/] },
  { area: "apps/web", forbidden: [/^@url-shortener\/(?:application|domain|db|observability)(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/] },
  { area: "packages/application", forbidden: [/^@url-shortener\/(?:db|contracts)(?:\/|$)/, /^apps\//] },
  { area: "packages/db", forbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^@url-shortener\/(?:domain|observability|contracts)(?:\/|$)/, /^apps\//] },
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : sourceExtensions.has(extname(path)) ? [path] : [];
  }));
  return nested.flat();
}

export async function violations(root) {
  const found = [];
  for (const rule of rules) {
    for (const file of await filesUnder(join(root, rule.area))) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        if (rule.forbidden.some((pattern) => pattern.test(specifier))) {
          found.push(`${relative(root, file)} imports forbidden ${specifier}`);
        }
      }
    }
  }
  return found;
}

async function selfTest() {
  const root = await mkdtemp(join(tmpdir(), "architecture-boundary-"));
  try {
    await mkdir(join(root, "packages/domain"), { recursive: true });
    await mkdir(join(root, "packages/db"), { recursive: true });
    await mkdir(join(root, "apps/worker"), { recursive: true });
    await writeFile(join(root, "packages/domain/bad.ts"), 'import "react";\nexport * from "drizzle-orm";\n');
    await writeFile(join(root, "packages/db/bad.ts"), 'export * from "react";\n');
    await writeFile(join(root, "apps/worker/bad.ts"), 'const module = import("../api/controllers/health.js");\n');
    const found = await violations(root);
    if (found.length !== 4) throw new Error(`Negative fixtures expected 4 violations, got ${found.length}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await selfTest();
const found = await violations(process.cwd());
if (found.length) {
  console.error(found.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries passed (including negative fixtures)." );
}
