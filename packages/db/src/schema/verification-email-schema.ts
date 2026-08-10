import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const verificationEmailDelivery = pgTable(
  "verification_email_delivery",
  {
    id: text("id").primaryKey(),
    recipient: text("recipient"),
    verificationUrl: text("verification_url"),
    logicalKey: text("logical_key").notNull().unique(),
    state: text("state", { enum: ["pending", "leased", "sent", "dead"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    leaseToken: text("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    errorCategory: text("error_category"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("verification_email_delivery_claim_idx").on(table.state, table.availableAt, table.leaseUntil),
    check(
      "verification_email_delivery_state_check",
      sql`${table.state} IN ('pending', 'leased', 'sent', 'dead')`,
    ),
    check("verification_email_delivery_attempts_check", sql`${table.attempts} >= 0`),
  ],
);

export const verificationEmailCooldown = pgTable("verification_email_cooldown", {
  keyDigest: text("key_digest").primaryKey(),
  nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true }).notNull(),
  reservationToken: text("reservation_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
