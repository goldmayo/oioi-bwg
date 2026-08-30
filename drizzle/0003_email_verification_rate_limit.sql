CREATE TABLE "email_verification_rate_limit" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_rate_limit_scope_key_window_started_at_pk" PRIMARY KEY("scope","key","window_started_at"),
	CONSTRAINT "email_verification_rate_limit_scope_check" CHECK ("email_verification_rate_limit"."scope" in ('EMAIL', 'IP')),
	CONSTRAINT "email_verification_rate_limit_key_check" CHECK ("email_verification_rate_limit"."key" <> ''),
	CONSTRAINT "email_verification_rate_limit_count_check" CHECK ("email_verification_rate_limit"."request_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "email_verification_rate_limit_updated_at_idx" ON "email_verification_rate_limit" USING btree ("updated_at");