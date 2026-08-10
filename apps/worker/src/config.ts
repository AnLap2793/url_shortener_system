export type WorkerConfig =
  | { databaseUrl: string; emailDeliveryMode: "capture" }
  | {
      databaseUrl: string;
      emailDeliveryMode: "resend";
      resendApiKey: string;
      emailFrom: string;
    };

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

function validateDatabaseUrl(value: string | undefined): string {
  try {
    const parsed = value ? new URL(value) : null;
    if (
      !parsed ||
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      !parsed.pathname.slice(1) ||
      [...parsed.searchParams.keys()].some((key) =>
        unsupportedConnectionOverrides.has(key.toLowerCase()),
      )
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  return value!;
}

function isEmailFrom(value: string): boolean {
  const address = value.match(/^(?:[^<>]+<)?([^<>\s]+@[^<>\s]+)>{0,1}$/)?.[1];
  return address !== undefined && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address);
}

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const databaseUrl = validateDatabaseUrl(environment.DATABASE_URL);
  const mode = environment.EMAIL_DELIVERY_MODE;
  if (mode !== "capture" && mode !== "resend") {
    throw new Error("EMAIL_DELIVERY_MODE must be capture or resend");
  }
  if (mode === "capture") {
    if (environment.NODE_ENV === "production") {
      throw new Error("EMAIL_DELIVERY_MODE capture is not allowed in production");
    }
    return { databaseUrl, emailDeliveryMode: mode };
  }

  const resendApiKey = environment.RESEND_API_KEY;
  const emailFrom = environment.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required for resend delivery");
  }
  if (!isEmailFrom(emailFrom)) throw new Error("EMAIL_FROM must be a valid email address");
  return { databaseUrl, emailDeliveryMode: mode, resendApiKey, emailFrom };
}
