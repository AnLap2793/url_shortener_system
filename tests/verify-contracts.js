import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const generatedPaths = [
  "packages/contracts/openapi.json",
  "packages/contracts/src/generated",
];

async function fileHashes(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => undefined);
  if (!entries) {
    return new Map([[path, createHash("sha256").update(await readFile(path)).digest("hex")]]);
  }
  const hashes = new Map();
  for (const entry of entries) {
    for (const [childPath, hash] of await fileHashes(join(path, entry.name))) {
      hashes.set(childPath, hash);
    }
  }
  return hashes;
}

async function generatedHashes() {
  const hashes = new Map();
  for (const path of generatedPaths) {
    for (const [childPath, hash] of await fileHashes(path)) hashes.set(childPath, hash);
  }
  return hashes;
}

const before = await generatedHashes();
if (!process.env.npm_execpath) throw new Error("Run contract verification through npm");
execFileSync(process.execPath, [process.env.npm_execpath, "run", "generate:contracts"], {
  stdio: "inherit",
});
const after = await generatedHashes();
const paths = new Set([...before.keys(), ...after.keys()]);
const changed = [...paths].filter((path) => before.get(path) !== after.get(path));
if (changed.length) throw new Error(`Generated contracts were stale:\n${changed.join("\n")}`);
console.log("Generated contracts are current.");
