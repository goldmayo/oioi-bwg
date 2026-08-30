CREATE TABLE "email_verification_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"status" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"ip_address" "inet" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_challenge_status_check" CHECK ("email_verification_challenge"."status" in ('PENDING', 'VERIFIED', 'CONSUMED', 'INVALIDATED')),
	CONSTRAINT "email_verification_challenge_otp_hash_check" CHECK ("email_verification_challenge"."otp_hash" <> ''),
	CONSTRAINT "email_verification_challenge_failed_attempts_check" CHECK ("email_verification_challenge"."failed_attempts" >= 0 and "email_verification_challenge"."failed_attempts" <= 5),
	CONSTRAINT "email_verification_challenge_verified_at_check" CHECK (("email_verification_challenge"."status" = 'VERIFIED') = ("email_verification_challenge"."verified_at" is not null)),
	CONSTRAINT "email_verification_challenge_consumed_at_check" CHECK (("email_verification_challenge"."status" = 'CONSUMED') = ("email_verification_challenge"."consumed_at" is not null)),
	CONSTRAINT "email_verification_challenge_invalidated_at_check" CHECK (("email_verification_challenge"."status" = 'INVALIDATED') = ("email_verification_challenge"."invalidated_at" is not null))
);
--> statement-breakpoint
CREATE INDEX "email_verification_challenge_email_created_at_idx" ON "email_verification_challenge" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "email_verification_challenge_ip_created_at_idx" ON "email_verification_challenge" USING btree ("ip_address","created_at");