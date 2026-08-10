CREATE TABLE "verification_email_cooldown" (
	"key_digest" text PRIMARY KEY NOT NULL,
	"next_allowed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_email_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text,
	"verification_url" text,
	"logical_key" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" text,
	"lease_until" timestamp with time zone,
	"error_category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_email_delivery_logical_key_unique" UNIQUE("logical_key"),
	CONSTRAINT "verification_email_delivery_state_check" CHECK ("verification_email_delivery"."state" IN ('pending', 'leased', 'sent', 'dead')),
	CONSTRAINT "verification_email_delivery_attempts_check" CHECK ("verification_email_delivery"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "verification_email_delivery_claim_idx" ON "verification_email_delivery" USING btree ("state","available_at","lease_until");