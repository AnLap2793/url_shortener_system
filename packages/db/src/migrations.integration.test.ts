import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";

const integrationUrl = process.env.INTEGRATION_DATABASE_URL;
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const legacyTag = "0005_talented_gorilla_man";

function createLegacyMigrationsFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), "url-shortener-legacy-migrations-"));
  const meta = join(folder, "meta");
  mkdirSync(meta);
  for (const tag of ["0000_huge_luke_cage", "0001_cloudy_fantastic_four", "0004_curious_bucky", legacyTag]) {
    const index = tag.split("_", 1)[0]!;
    copyFileSync(join(migrationsFolder, `${tag}.sql`), join(folder, `${tag}.sql`));
    copyFileSync(join(migrationsFolder, "meta", `${index}_snapshot.json`), join(meta, `${index}_snapshot.json`));
  }
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { tag: string }) => entry.tag !== "0006_google_account_identity_unique");
  writeFileSync(join(meta, "_journal.json"), JSON.stringify(journal));
  return folder;
}

async function withEphemeralDatabase(action: (databaseUrl: string) => Promise<void>): Promise<void> {
  const admin = new pg.Client({ connectionString: integrationUrl });
  await admin.connect();
  const name = `mig_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(integrationUrl!);
  url.pathname = `/${name}`;
  try {
    await action(url.toString());
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
}


// Real-PostgreSQL gate: mandatory in CI via the service container; skipped
// locally when no integration database is configured (Story 1.1 pattern).
describe.skipIf(!integrationUrl)("auth migration chain", () => {
  it("upgrades a populated 0005 database without changing account ownership", async () => {
    const legacyFolder = createLegacyMigrationsFolder();
    try {
      await withEphemeralDatabase(async (databaseUrl) => {
        await runMigrations(databaseUrl, legacyFolder);
        const target = new pg.Client({ connectionString: databaseUrl });
        await target.connect();
        try {
          await target.query(`INSERT INTO "user" ("id", "name", "email", "email_verified") VALUES ('legacy-user-1', 'Legacy Marketer', 'legacy@example.test', true)`);
          await target.query(`INSERT INTO "account" ("id", "account_id", "provider_id", "user_id") VALUES ('legacy-google-account-1', 'google-subject-legacy-1', 'google', 'legacy-user-1')`);
        } finally {
          await target.end();
        }

        await runMigrations(databaseUrl);
        await runMigrations(databaseUrl);

        const upgraded = new pg.Client({ connectionString: databaseUrl });
        await upgraded.connect();
        try {
          await expect(upgraded.query(`SELECT "user_id", "provider_id", "account_id" FROM "account" WHERE "id" = 'legacy-google-account-1'`))
            .resolves.toMatchObject({ rows: [{ user_id: "legacy-user-1", provider_id: "google", account_id: "google-subject-legacy-1" }] });
          await expect(upgraded.query(`INSERT INTO "account" ("id", "account_id", "provider_id", "user_id") VALUES ('duplicate-google-account-1', 'google-subject-legacy-1', 'google', 'legacy-user-1')`))
            .rejects.toThrow();
        } finally {
          await upgraded.end();
        }
      });
    } finally {
      rmSync(legacyFolder, { recursive: true, force: true });
    }
  }, 30_000);

  it("migrates an empty database and yields the four Better Auth tables with string ids", async () => {
    const admin = new pg.Client({ connectionString: integrationUrl });
    await admin.connect();
    const ephemeralName = `mig_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    await admin.query(`CREATE DATABASE ${ephemeralName}`);
    try {
      const ephemeralUrl = new URL(integrationUrl!);
      ephemeralUrl.pathname = `/${ephemeralName}`;
      // Concurrent deploy instances serialize on the database advisory lock.
      await Promise.all([
        runMigrations(ephemeralUrl.toString()),
        runMigrations(ephemeralUrl.toString()),
      ]);
      // Idempotent: applying the same chain again must be a no-op.
      await runMigrations(ephemeralUrl.toString());

      const target = new pg.Client({ connectionString: ephemeralUrl.toString() });
      await target.connect();
      try {
        const tables = await target.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
        );
        const names = tables.rows.map((row) => row.table_name);
        for (const expected of [
          "account",
          "session",
          "user",
          "verification",
          "verification_email_cooldown",
          "verification_email_delivery",
          "login_rate_limit",
        ]) {
          expect(names).toContain(expected);
        }
        const idType = await target.query(
          "SELECT data_type FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'id'",
        );
        expect(idType.rows[0]?.data_type).toBe("text");
        const accountIdentityConstraint = await target.query(
          `SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_schema = 'public'
             AND table_name = 'account'
             AND constraint_type = 'UNIQUE'
             AND constraint_name = 'account_provider_id_account_id_unique'`,
        );
        expect(accountIdentityConstraint.rowCount).toBe(1);
      } finally {
        await target.end();
      }
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${ephemeralName} WITH (FORCE)`);
      await admin.end();
    }
  }, 30_000);
});
