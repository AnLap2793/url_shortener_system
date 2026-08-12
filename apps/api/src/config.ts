import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface ApiConfig {
  databaseUrl: string;
  port: number;
  /** Session signing secret for Better Auth; never logged. */
  betterAuthSecret: string;
  /** The single public origin (AD-2/AD-18): scheme://host[:port], no path. */
  publicOrigin: string;
  /** Absolute path to the built SPA; static hosting is disabled when absent. */
  webDistDir?: string;
  /** Number of trusted reverse-proxy hops before the public client. */
  trustedProxyHops: number;
  /** Google OAuth is disabled only when both credentials are absent. */
  googleClientId?: string;
  /** OAuth client secret; never logged. */
  googleClientSecret?: string;
  /** Derived from the one configured public origin; never independently configured. */
  googleCallbackUrl?: string;
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

  const betterAuthSecret = environment.BETTER_AUTH_SECRET;
  if (!betterAuthSecret || betterAuthSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters");
  }

  let publicOrigin = `http://127.0.0.1:${port}`;
  if (environment.PUBLIC_ORIGIN) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(environment.PUBLIC_ORIGIN);
    } catch {
      throw new Error("PUBLIC_ORIGIN must be an absolute http(s) origin without a path");
    }
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.pathname !== "/" ||
      parsedOrigin.search ||
      parsedOrigin.hash ||
      environment.PUBLIC_ORIGIN.endsWith("/")
    ) {
      throw new Error("PUBLIC_ORIGIN must be an absolute http(s) origin without a path");
    }
    publicOrigin = parsedOrigin.origin;
  }
  if (environment.NODE_ENV === "production" && new URL(publicOrigin).protocol !== "https:") {
    throw new Error("PUBLIC_ORIGIN must use https in production");
  }

  const trustedProxyHops = Number(environment.TRUSTED_PROXY_HOPS ?? 0);
  if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 5) {
    throw new Error("TRUSTED_PROXY_HOPS must be an integer from 0 to 5");
  }
  if (environment.NODE_ENV === "production" && trustedProxyHops !== 1) {
    throw new Error("TRUSTED_PROXY_HOPS must be 1 in production");
  }

  const googleClientId = environment.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  if (
    Boolean(googleClientId) !== Boolean(googleClientSecret)
    || (environment.NODE_ENV === "production" && !googleClientId)
  ) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set");
  }

  let webDistDir: string | undefined;
  if (environment.WEB_DIST_DIR) {
    webDistDir = resolve(environment.WEB_DIST_DIR);
    if (!existsSync(join(webDistDir, "index.html"))) {
      throw new Error("WEB_DIST_DIR must point to a directory containing index.html");
    }
  }
  return {
    databaseUrl: databaseUrl!,
    port,
    betterAuthSecret,
    publicOrigin,
    webDistDir,
    trustedProxyHops,
    googleClientId,
    googleClientSecret,
    googleCallbackUrl: googleClientId ? `${publicOrigin}/api/auth/callback/google` : undefined,
  };
}
