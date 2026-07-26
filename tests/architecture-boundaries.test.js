import { access, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import ts from "typescript";

const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const rules = {
  "packages/domain": { internal: [], forbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "packages/application": { internal: ["packages/domain"], forbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "packages/db": { internal: ["packages/application"], forbidden: [/^react(?:\/|$)/, /^@nestjs\//] },
  "packages/contracts": { internal: [], forbidden: [/.+/] },
  "packages/observability": { internal: [], forbidden: [/^react(?:\/|$)/, /^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "apps/web": { internal: ["packages/contracts"], forbidden: [/^@nestjs\//, /^drizzle-orm(?:\/|$)/, /^better-auth(?:\/|$)/] },
  "apps/api": { internal: ["packages/application", "packages/db", "packages/observability"], forbidden: [/^react(?:\/|$)/, /^better-auth\/adapters/] },
  "apps/worker": { internal: ["packages/application", "packages/observability"], forbidden: [/controllers?(?:\/|$)/i, /^@nestjs\//] },
};

async function filesUnder(directory) {
  await access(directory);
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "dist" ? [] : filesUnder(path);
    return sourceExtensions.has(extname(path)) ? [path] : [];
  }))).flat();
}

function ownerFor(path, root) {
  const normalized = relative(root, path).split(sep).join("/");
  return Object.keys(rules).find((area) => normalized === area || normalized.startsWith(`${area}/`)) ?? normalized.match(/^(packages|apps)\/[^/]+/)?.[0];
}

async function resolveSpecifier(specifier, file, root) {
  if (specifier.startsWith("@url-shortener/")) return `packages/${specifier.slice(15).split("/")[0]}`;
  if (!specifier.startsWith(".")) return specifier;
  const base = resolve(dirname(file), specifier);
  const canonical = await realpath(base).catch(() => null);
  const normalized = (canonical ?? base).split(sep).join("/");
  const nodeModules = normalized.match(/\/node_modules\/(?:@[^/]+\/[^/]+|[^/]+)/)?.[0];
  if (nodeModules) return nodeModules.slice("/node_modules/".length);
  return ownerFor(canonical ?? base, root) ?? specifier;
}

function importsFrom(source, file) {
  const scriptKind = [".js", ".jsx", ".mjs", ".cjs"].includes(extname(file)) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const imports = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) imports.push(node.arguments[0].text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return imports;
}

function violates(rule, dependency, area) {
  const internal = dependency.startsWith("packages/") || dependency.startsWith("apps/");
  return internal ? dependency !== area && !rule.internal.includes(dependency) : rule.forbidden.some((pattern) => pattern.test(dependency));
}

export async function violations(root) {
  const found = [];
  for (const [area, rule] of Object.entries(rules)) {
    const manifest = JSON.parse(await readFile(join(root, area, "package.json"), "utf8"));
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
      const canonical = dependency.startsWith("@url-shortener/") ? `packages/${dependency.slice(15)}` : dependency;
      if (violates(rule, canonical, area)) found.push(`${area}/package.json declares forbidden ${dependency}`);
    }
    for (const file of await filesUnder(join(root, area, "src"))) {
      for (const specifier of importsFrom(await readFile(file, "utf8"), file)) {
        const dependency = await resolveSpecifier(specifier, file, root);
        if (violates(rule, dependency, area)) found.push(`${relative(root, file)} imports forbidden ${specifier} (${dependency})`);
      }
    }
  }
  return found;
}

async function selfTest() {
  const root = await mkdtemp(join(tmpdir(), "architecture-boundary-"));
  try {
    for (const area of Object.keys(rules)) {
      await mkdir(join(root, area, "src"), { recursive: true });
      await writeFile(join(root, area, "package.json"), '{"type":"module"}');
    }
    await writeFile(join(root, "packages/domain/src/domain.mts"), 'await import(/* comment */ "@nestjs/common");');
    await writeFile(join(root, "packages/application/src/app.ts"), 'import type X from "@nestjs/common";');
    await writeFile(join(root, "apps/worker/src/worker.ts"), 'import "../../api/src/controller.js";');
    await writeFile(join(root, "apps/api/src/controller.ts"), "export {};\n");
    await writeFile(join(root, "apps/web/package.json"), '{"dependencies":{"better-auth":"1.0.0"}}');
    const found = await violations(root);
    const expected = ["domain.mts", "application", "worker.ts", "package.json"];
    for (const marker of expected) if (!found.some((item) => item.includes(marker))) throw new Error(`Missing negative fixture ${marker}: ${found.join("; ")}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await selfTest();
const found = await violations(process.cwd());
if (found.length) {
  console.error(found.join("\n"));
  process.exitCode = 1;
} else console.log("Architecture boundaries passed (including negative fixtures)." );
