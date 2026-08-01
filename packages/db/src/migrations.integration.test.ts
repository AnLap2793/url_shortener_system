import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";

const integrationUrl = process.env.INTEGRATION_DATABASE_URL;

// Real-PostgreSQL gate: mandatory in CI via the service container; skipped
// locally when no integration database is configured (Story 1.1 pattern).
describe.skipIf(!integrationUrl)("auth migration chain", () => {
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
        for (const expected of ["account", "session", "user", "verification"]) {
          expect(names).toContain(expected);
        }
        const idType = await target.query(
          "SELECT data_type FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'id'",
        );
        expect(idType.rows[0]?.data_type).toBe("text");
      } finally {
        await target.end();
      }
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${ephemeralName} WITH (FORCE)`);
      await admin.end();
    }
  }, 30_000);
});
