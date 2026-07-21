type LogFields = Record<string, unknown> & { correlationId: string };
type LogWriter = (line: string) => void;

const sensitiveKeys = new Set([
  "authorization", "cookie", "databaseurl", "destination", "dsn", "forwardedfor",
  "ip", "password", "rawip", "referer", "secret", "sessionid", "token", "useragent",
]);
const credentialPattern = /(?:postgres(?:ql)?:\/\/)[^\s/@:]+(?::[^\s/@]*)?@|(?:token|password|secret|api[_-]?key)=([^&\s]+)/gi;

function keyToken(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function scrubString(value: string): string {
  return value.replace(credentialPattern, (match) => match.startsWith("postgres") ? "postgres://[REDACTED]@" : match.replace(/=.*/, "=[REDACTED]"));
}

function sanitizeValue(key: string, value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (sensitiveKeys.has(keyToken(key))) return "[REDACTED]";
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object" || value === null) return value;
  if (depth >= 8) return "[MAX_DEPTH]";
  if (seen.has(value)) return "[CIRCULAR]";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, code: "code" in value ? String(value.code) : undefined };
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item, seen, depth + 1));
    if (value instanceof Map) return [...value.entries()].map(([mapKey, item]) => [sanitizeValue("key", mapKey, seen, depth + 1), sanitizeValue("value", item, seen, depth + 1)]);
    if (value instanceof Set) return [...value].map((item) => sanitizeValue("value", item, seen, depth + 1));
    const result: Record<string, unknown> = {};
    for (const propertyKey of Reflect.ownKeys(value)) {
      if (typeof propertyKey !== "string") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);
      result[propertyKey] = descriptor && "value" in descriptor
        ? sanitizeValue(propertyKey, descriptor.value, seen, depth + 1)
        : "[ACCESSOR]";
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function sanitize(fields: LogFields): Record<string, unknown> {
  const seen = new WeakSet<object>();
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitizeValue(key, value, seen, 0)]));
}

export function createLogger(write: LogWriter = console.log) {
  return {
    info(message: string, fields: LogFields): void {
      try {
        write(JSON.stringify({ ...sanitize(fields), level: "info", message: scrubString(message) }));
      } catch {
        write('{"level":"error","message":"log serialization failed"}');
      }
    },
  };
}
