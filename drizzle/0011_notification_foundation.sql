CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient_account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_event_key" UNIQUE("recipient_account_id","type","event_key"),
	CONSTRAINT "notification_type_check" CHECK ("notification"."type" in ('WAVEFORM_SUCCEEDED', 'WAVEFORM_FAILED')),
	CONSTRAINT "notification_resource_type_check" CHECK ("notification"."resource_type" = 'WAVEFORM_JOB'),
	CONSTRAINT "notification_event_key_check" CHECK (length("notification"."event_key") between 1 and 256)
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"notification_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"binding_version" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"last_error_code" text,
	CONSTRAINT "notification_delivery_target_key" UNIQUE("notification_id","installation_id","binding_version"),
	CONSTRAINT "notification_delivery_status_check" CHECK ("notification_delivery"."status" in ('PENDING', 'ACCEPTED', 'DISCARDED')),
	CONSTRAINT "notification_delivery_attempt_check" CHECK ("notification_delivery"."attempt_count" >= 0 and "notification_delivery"."binding_version" > 0),
	CONSTRAINT "notification_delivery_lease_check" CHECK (("notification_delivery"."lease_token" is null) = ("notification_delivery"."lease_until" is null))
);
--> statement-breakpoint
CREATE TABLE "push_installation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fid" text NOT NULL,
	"account_id" uuid NOT NULL,
	"mfa_version" integer NOT NULL,
	"binding_version" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "push_installation_fid_key" UNIQUE("fid"),
	CONSTRAINT "push_installation_version_check" CHECK ("push_installation"."mfa_version" > 0 and "push_installation"."binding_version" > 0),
	CONSTRAINT "push_installation_fid_check" CHECK (length("push_installation"."fid") between 16 and 256)
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_account_id_account_id_fk" FOREIGN KEY ("recipient_account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_installation_id_push_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."push_installation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_installation" ADD CONSTRAINT "push_installation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_recipient_cursor_idx" ON "notification" USING btree ("recipient_account_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_unread_idx" ON "notification" USING btree ("recipient_account_id") WHERE "notification"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notification_delivery_due_idx" ON "notification_delivery" USING btree ("next_attempt_at","lease_until") WHERE "notification_delivery"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "push_installation_account_idx" ON "push_installation" USING btree ("account_id") WHERE "push_installation"."enabled";