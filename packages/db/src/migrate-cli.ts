import { runMigrations } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for migrations");
  process.exitCode = 1;
} else {
  try {
    await runMigrations(databaseUrl);
  } catch {
    console.error("Database migration failed");
    process.exitCode = 1;
  }
}
