CREATE TABLE "login_rate_limit" (
	"scope" text NOT NULL,
	"key_digest" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_rate_limit_scope_key_digest_pk" PRIMARY KEY("scope","key_digest"),
	CONSTRAINT "login_rate_limit_scope_check" CHECK ("login_rate_limit"."scope" IN ('account', 'ip')),
	CONSTRAINT "login_rate_limit_attempts_check" CHECK ("login_rate_limit"."attempts" >= 0)
);
