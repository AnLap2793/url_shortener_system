type LogFields = Record<string, unknown> & { correlationId: string };
type LogWriter = (line: string) => void;

const sensitiveKey = /password|secret|token|cookie|authorization|database.?url|dsn|ip|forwarded|referer|user.?agent|destination/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item));
  return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, sanitizeValue(nestedKey, nestedValue)]));
}

function sanitize(fields: LogFields): LogFields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitizeValue(key, value)])) as LogFields;
}

export function createLogger(write: LogWriter = console.log) {
  return {
    info(message: string, fields: LogFields): void {
      write(JSON.stringify({ level: "info", message, ...sanitize(fields) }));
    },
  };
}
