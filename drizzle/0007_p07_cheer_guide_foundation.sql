CREATE TABLE "cheer_guide" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"legacy_write_target" boolean DEFAULT false NOT NULL,
	"current_publication_id" uuid,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cheer_guide_song_id_mode_key" UNIQUE("song_id","mode"),
	CONSTRAINT "cheer_guide_mode_check" CHECK ("cheer_guide"."mode" in ('CONCERT', 'FESTIVAL')),
	CONSTRAINT "cheer_guide_lock_version_check" CHECK ("cheer_guide"."lock_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "cheer_guide_publication" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cheer_guide_id" uuid NOT NULL,
	"publication_no" integer NOT NULL,
	"action" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cheer_guide_publication_cheer_guide_id_publication_no_key" UNIQUE("cheer_guide_id","publication_no"),
	CONSTRAINT "cheer_guide_publication_cheer_guide_id_id_key" UNIQUE("cheer_guide_id","id"),
	CONSTRAINT "cheer_guide_publication_publication_no_check" CHECK ("cheer_guide_publication"."publication_no" > 0),
	CONSTRAINT "cheer_guide_publication_action_check" CHECK ("cheer_guide_publication"."action" in ('PUBLISH', 'UNPUBLISH')),
	CONSTRAINT "cheer_guide_publication_reason_check" CHECK (length(btrim("cheer_guide_publication"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "cheer_guide_snapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cheer_guide_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"lyrics" jsonb NOT NULL,
	"reference_youtube_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"guide_video_url" text,
	"description" text,
	"created_by_account_id" uuid,
	"change_summary" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cheer_guide_snapshot_cheer_guide_id_version_no_key" UNIQUE("cheer_guide_id","version_no"),
	CONSTRAINT "cheer_guide_snapshot_cheer_guide_id_id_key" UNIQUE("cheer_guide_id","id"),
	CONSTRAINT "cheer_guide_snapshot_version_no_check" CHECK ("cheer_guide_snapshot"."version_no" > 0),
	CONSTRAINT "cheer_guide_snapshot_lyrics_check" CHECK (jsonb_typeof("cheer_guide_snapshot"."lyrics") = 'array'),
	CONSTRAINT "cheer_guide_snapshot_reference_youtube_id_check" CHECK (length(btrim("cheer_guide_snapshot"."reference_youtube_id")) > 0),
	CONSTRAINT "cheer_guide_snapshot_source_type_check" CHECK ("cheer_guide_snapshot"."source_type" in ('OFFICIAL', 'FANDOM')),
	CONSTRAINT "cheer_guide_snapshot_source_url_check" CHECK ("cheer_guide_snapshot"."source_type" <> 'OFFICIAL' or ("cheer_guide_snapshot"."source_url" is not null and length(btrim("cheer_guide_snapshot"."source_url")) > 0)),
	CONSTRAINT "cheer_guide_snapshot_change_summary_check" CHECK (length(btrim("cheer_guide_snapshot"."change_summary")) > 0)
);
--> statement-breakpoint
ALTER TABLE "cheer_guide" ADD CONSTRAINT "cheer_guide_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer_guide" ADD CONSTRAINT "cheer_guide_id_current_publication_id_fkey" FOREIGN KEY ("id","current_publication_id") REFERENCES "public"."cheer_guide_publication"("cheer_guide_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer_guide_publication" ADD CONSTRAINT "cheer_guide_publication_cheer_guide_id_fkey" FOREIGN KEY ("cheer_guide_id") REFERENCES "public"."cheer_guide"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer_guide_publication" ADD CONSTRAINT "cheer_guide_publication_cheer_guide_id_snapshot_id_fkey" FOREIGN KEY ("cheer_guide_id","snapshot_id") REFERENCES "public"."cheer_guide_snapshot"("cheer_guide_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer_guide_publication" ADD CONSTRAINT "cheer_guide_publication_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer_guide_snapshot" ADD CONSTRAINT "cheer_guide_snapshot_cheer_guide_id_fkey" FOREIGN KEY ("cheer_guide_id") REFERENCES "public"."cheer_guide"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer_guide_snapshot" ADD CONSTRAINT "cheer_guide_snapshot_created_by_account_id_fkey" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cheer_guide_song_id_legacy_write_target_key" ON "cheer_guide" USING btree ("song_id") WHERE "cheer_guide"."legacy_write_target";--> statement-breakpoint
CREATE INDEX "cheer_guide_publication_cheer_guide_id_snapshot_id_idx" ON "cheer_guide_publication" USING btree ("cheer_guide_id","snapshot_id");--> statement-breakpoint
CREATE INDEX "cheer_guide_publication_actor_account_id_idx" ON "cheer_guide_publication" USING btree ("actor_account_id");--> statement-breakpoint
CREATE INDEX "cheer_guide_snapshot_created_by_account_id_idx" ON "cheer_guide_snapshot" USING btree ("created_by_account_id");
--> statement-breakpoint
-- Drizzle does not model triggers; preserve both content and publication history in PostgreSQL.
CREATE FUNCTION reject_cheer_guide_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'cheer guide history is immutable' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cheer_guide_snapshot_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON cheer_guide_snapshot
  FOR EACH STATEMENT EXECUTE FUNCTION reject_cheer_guide_history_mutation();
--> statement-breakpoint
CREATE TRIGGER cheer_guide_publication_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON cheer_guide_publication
  FOR EACH STATEMENT EXECUTE FUNCTION reject_cheer_guide_history_mutation();
