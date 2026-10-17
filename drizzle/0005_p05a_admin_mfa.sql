CREATE TABLE "admin_mfa" (
	"account_id" bigint PRIMARY KEY NOT NULL,
	"encrypted_secret" text,
	"enabled_at" timestamp with time zone,
	"last_used_step" integer,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "admin_mfa_version_check" CHECK ("admin_mfa"."version" > 0),
	CONSTRAINT "admin_mfa_secret_check" CHECK ("admin_mfa"."encrypted_secret" is null or "admin_mfa"."encrypted_secret" <> ''),
	CONSTRAINT "admin_mfa_step_check" CHECK ("admin_mfa"."last_used_step" is null or "admin_mfa"."last_used_step" >= 0),
	CONSTRAINT "admin_mfa_state_check" CHECK (("admin_mfa"."enabled_at" is null and "admin_mfa"."last_used_step" is null)
        or ("admin_mfa"."enabled_at" is not null and "admin_mfa"."encrypted_secret" is not null and "admin_mfa"."last_used_step" is not null))
);
--> statement-breakpoint
ALTER TABLE "admin_mfa" ADD CONSTRAINT "admin_mfa_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;