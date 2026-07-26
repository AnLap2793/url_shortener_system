import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface ApiConfig {
  databaseUrl: string;
  port: number;
  /** Absolute path to the built SPA; static hosting is disabled when absent. */
  webDistDir?: string;
}

const unsupportedConnectionOverrides = new Set([
  "host",
  "hostaddr",
  "port",
  "user",
  "password",
  "dbname",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "statement_timeout",
  "query_timeout",
  "connect_timeout",
]);

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const databaseUrl = environment.DATABASE_URL;
  try {
    const parsed = databaseUrl ? new URL(databaseUrl) : null;
    if (
      !parsed ||
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      !parsed.pathname.slice(1) ||
      [...parsed.searchParams.keys()].some((key) => unsupportedConnectionOverrides.has(key.toLowerCase()))
    ) throw new Error();
    if (parsed.port && (!/^\d+$/.test(parsed.port) || Number(parsed.port) > 65535)) throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");

  let webDistDir: string | undefined;
  if (environment.WEB_DIST_DIR) {
    webDistDir = resolve(environment.WEB_DIST_DIR);
    if (!existsSync(join(webDistDir, "index.html"))) {
      throw new Error("WEB_DIST_DIR must point to a directory containing index.html");
    }
  }
  return { databaseUrl: databaseUrl!, port, webDistDir };
}
