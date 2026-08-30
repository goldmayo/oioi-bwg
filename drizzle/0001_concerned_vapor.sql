CREATE TABLE "account" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "account_role_check" CHECK ("account"."role" in ('USER', 'REVIEWER', 'ADMIN')),
	CONSTRAINT "account_status_check" CHECK ("account"."status" in ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED')),
	CONSTRAINT "account_deleted_at_check" CHECK (("account"."status" = 'DELETED') = ("account"."deleted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "password_credential" (
	"account_id" bigint PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone NOT NULL,
	"password_changed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_credential_email_key" UNIQUE("email"),
	CONSTRAINT "password_credential_email_check" CHECK ("password_credential"."email" <> '' and "password_credential"."email" = lower(btrim("password_credential"."email"))),
	CONSTRAINT "password_credential_hash_check" CHECK ("password_credential"."password_hash" <> '')
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"account_id" bigint PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"avatar_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_nickname_key" UNIQUE("nickname")
);
--> statement-breakpoint
ALTER TABLE "password_credential" ADD CONSTRAINT "password_credential_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;
