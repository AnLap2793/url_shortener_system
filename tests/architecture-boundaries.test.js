import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
const importPattern = /(?:from\s*|import\s*(?:\(\s*)?|export\s+(?:\*|\{[^}]*\})\s*from\s*)["']([^"']+)["']/g;

const rules = {
  "packages/domain": { internal: [], externalForbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "packages/application": { internal: ["packages/domain"], externalForbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "packages/db": { internal: ["packages/application"], externalForbidden: [/^react(?:\/|$)/, /^@nestjs\//] },
  "apps/web": { internal: ["packages/contracts"], externalForbidden: [/^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "apps/worker": { internal: ["packages/application", "packages/observability"], externalForbidden: [/controllers?(?:\/|$)/i] },
};

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : sourceExtensions.includes(extname(path)) ? [path] : [];
  }))).flat();
}

function ownerFor(path, root) {
  const normalized = relative(root, path).split(sep).join("/");
  return Object.keys(rules).find((area) => normalized === area || normalized.startsWith(`${area}/`)) ??
    normalized.match(/^(packages|apps)\/[^/]+/)?.[0];
}

async function resolveSpecifier(specifier, file, root) {
  if (specifier.startsWith("@url-shortener/")) return `packages/${specifier.slice("@url-shortener/".length).split("/")[0]}`;
  if (!specifier.startsWith(".")) return specifier;
  const base = resolve(dirname(file), specifier);
  for (const candidate of [base, ...sourceExtensions.map((extension) => `${base.replace(/\.js$/, "")}${extension}`)]) {
    const canonical = await realpath(candidate).catch(() => null);
    if (canonical) return ownerFor(canonical, root) ?? specifier;
  }
  return ownerFor(base, root) ?? specifier;
}

export async function violations(root) {
  const found = [];
  for (const [area, rule] of Object.entries(rules)) {
    for (const file of await filesUnder(join(root, area))) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        const dependency = await resolveSpecifier(specifier, file, root);
        const forbiddenInternal = dependency.startsWith("packages/") || dependency.startsWith("apps/")
          ? !rule.internal.includes(dependency) && dependency !== area
          : false;
        if (forbiddenInternal || rule.externalForbidden.some((pattern) => pattern.test(dependency))) {
          found.push(`${relative(root, file)} imports forbidden ${specifier} (${dependency})`);
        }
      }
    }
  }
  return found;
}

async function selfTest() {
  const root = await mkdtemp(join(tmpdir(), "architecture-boundary-"));
  try {
    for (const area of Object.keys(rules)) await mkdir(join(root, area), { recursive: true });
    await mkdir(join(root, "apps/api"), { recursive: true });
    await writeFile(join(root, "packages/domain/bad.ts"), 'import "@url-shortener/application";\nexport * from "../db/bad.js";\n');
    await writeFile(join(root, "packages/db/bad.ts"), 'export * from "../../apps/api/bad.js";\n');
    await writeFile(join(root, "apps/api/bad.ts"), "export {};\n");
    await writeFile(join(root, "apps/web/bad.ts"), 'import "better-auth";\n');
    await writeFile(join(root, "packages/application/bad.ts"), 'import "@nestjs/common";\n');
    const found = await violations(root);
    if (found.length !== 5) throw new Error(`Negative fixtures expected 5 violations, got ${found.length}: ${found.join("; ")}`);
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
