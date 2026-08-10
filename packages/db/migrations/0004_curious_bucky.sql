ALTER TABLE "verification_email_cooldown"
ADD COLUMN "reservation_token" text;
--> statement-breakpoint
UPDATE "verification_email_cooldown"
SET "reservation_token" = gen_random_uuid()::text
WHERE "reservation_token" IS NULL;
--> statement-breakpoint
ALTER TABLE "verification_email_cooldown"
ALTER COLUMN "reservation_token" SET NOT NULL;
