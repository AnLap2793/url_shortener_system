import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const loginRateLimit = pgTable(
  "login_rate_limit",
  {
    scope: text("scope", { enum: ["account", "ip"] }).notNull(),
    keyDigest: text("key_digest").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.keyDigest] }),
    check("login_rate_limit_scope_check", sql`${table.scope} IN ('account', 'ip')`),
    check("login_rate_limit_attempts_check", sql`${table.attempts} >= 0`),
  ],
);
