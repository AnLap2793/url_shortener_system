export interface ApiConfig {
  databaseUrl: string;
  port: number;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const databaseUrl = environment.DATABASE_URL;
  try {
    const parsed = databaseUrl ? new URL(databaseUrl) : null;
    if (
      !parsed ||
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      !parsed.pathname.slice(1)
    )
      throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a valid TCP port");
  return { databaseUrl: databaseUrl!, port };
}
