CREATE TABLE "operator_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"device_hash" text NOT NULL,
	"user_code_hash" text NOT NULL,
	"account_id" uuid,
	"mfa_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"exchanged_at" timestamp with time zone,
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "operator_session_device_hash_key" UNIQUE("device_hash"),
	CONSTRAINT "operator_session_user_code_hash_key" UNIQUE("user_code_hash"),
	CONSTRAINT "operator_session_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "operator_session_hash_check" CHECK ("operator_session"."device_hash" ~ '^[a-f0-9]{64}$' and "operator_session"."user_code_hash" ~ '^[a-f0-9]{64}$' and ("operator_session"."token_hash" is null or "operator_session"."token_hash" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "operator_session_expiry_check" CHECK ("operator_session"."expires_at" > "operator_session"."created_at"),
	CONSTRAINT "operator_session_approval_check" CHECK (("operator_session"."approved_at" is null and "operator_session"."account_id" is null and "operator_session"."mfa_version" is null) or ("operator_session"."approved_at" is not null and "operator_session"."account_id" is not null and "operator_session"."mfa_version" is not null and "operator_session"."mfa_version" > 0 and "operator_session"."approved_at" >= "operator_session"."created_at" and "operator_session"."approved_at" < "operator_session"."expires_at")),
	CONSTRAINT "operator_session_exchange_check" CHECK (("operator_session"."exchanged_at" is null and "operator_session"."token_hash" is null and "operator_session"."token_expires_at" is null) or ("operator_session"."exchanged_at" is not null and "operator_session"."approved_at" is not null and "operator_session"."exchanged_at" >= "operator_session"."approved_at" and "operator_session"."exchanged_at" < "operator_session"."expires_at" and "operator_session"."token_hash" is not null and "operator_session"."token_expires_at" is not null and "operator_session"."token_expires_at" > "operator_session"."exchanged_at")),
	CONSTRAINT "operator_session_revocation_check" CHECK ("operator_session"."revoked_at" is null or ("operator_session"."exchanged_at" is not null and "operator_session"."revoked_at" >= "operator_session"."exchanged_at"))
);
--> statement-breakpoint
ALTER TABLE "operator_session" ADD CONSTRAINT "operator_session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operator_session_account_id_idx" ON "operator_session" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "operator_session_expires_at_idx" ON "operator_session" USING btree ("expires_at");