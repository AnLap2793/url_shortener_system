import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const migrationDirectory = "packages/db/migrations";
const metadataDirectory = join(migrationDirectory, "meta");

async function fileHashes(directory) {
  const hashes = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [childPath, hash] of await fileHashes(path)) hashes.set(childPath, hash);
    } else {
      hashes.set(path, createHash("sha256").update(await readFile(path)).digest("hex"));
    }
  }
  return hashes;
}

function assertSameFiles(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  const changed = [...paths].filter((path) => before.get(path) !== after.get(path));
  if (changed.length) throw new Error(`Database schema and migrations differ:\n${changed.join("\n")}`);
}

const journal = JSON.parse(await readFile(join(metadataDirectory, "_journal.json"), "utf8"));
const sqlFiles = (await readdir(migrationDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name));
const snapshots = (await readdir(metadataDirectory)).filter((name) => /^\d{4}_snapshot\.json$/.test(name));
let previousPrefix = -1;
let previousSnapshotId;

for (const [position, entry] of journal.entries.entries()) {
  const prefix = Number(entry.tag.slice(0, 4));
  if (entry.idx !== position || prefix <= previousPrefix) {
    throw new Error(`Migration journal order is invalid at ${entry.tag}`);
  }
  const sqlMatches = sqlFiles.filter((name) => name.startsWith(`${entry.tag}.`));
  const snapshotName = `${entry.tag.slice(0, 4)}_snapshot.json`;
  if (sqlMatches.length !== 1 || !snapshots.includes(snapshotName)) {
    throw new Error(`Migration artifacts are incomplete for ${entry.tag}`);
  }
  const snapshot = JSON.parse(await readFile(join(metadataDirectory, snapshotName), "utf8"));
  if (position > 0 && snapshot.prevId !== previousSnapshotId) {
    throw new Error(`Snapshot chain is invalid at ${snapshotName}`);
  }
  previousPrefix = prefix;
  previousSnapshotId = snapshot.id;
}

if (sqlFiles.length !== journal.entries.length || snapshots.length !== journal.entries.length) {
  throw new Error("Migration files and journal entries do not have a one-to-one mapping");
}

const before = await fileHashes(migrationDirectory);
if (!process.env.npm_execpath) throw new Error("Run migration verification through npm");
execFileSync(
  process.execPath,
  [process.env.npm_execpath, "run", "db:generate", "--workspace=@url-shortener/db"],
  { stdio: "inherit" },
);
assertSameFiles(before, await fileHashes(migrationDirectory));
console.log("Migration metadata and generated schema are consistent.");
