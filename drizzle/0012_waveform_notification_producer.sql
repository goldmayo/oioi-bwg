CREATE TABLE "waveform" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"video_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waveform_song_id_unique" UNIQUE("song_id"),
	CONSTRAINT "waveform_video_check" CHECK ("waveform"."video_id" ~ '^[A-Za-z0-9_-]{11}$'),
	CONSTRAINT "waveform_data_check" CHECK (jsonb_typeof("waveform"."data") = 'object')
);
--> statement-breakpoint
CREATE TABLE "waveform_job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"video_id" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"attempt_id" uuid,
	"error_code" text,
	"enqueued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "waveform_job_video_check" CHECK ("waveform_job"."video_id" ~ '^[A-Za-z0-9_-]{11}$'),
	CONSTRAINT "waveform_job_status_check" CHECK ("waveform_job"."status" in ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
	CONSTRAINT "waveform_job_terminal_check" CHECK (("waveform_job"."status" in ('SUCCEEDED','FAILED')) = ("waveform_job"."finished_at" is not null)),
	CONSTRAINT "waveform_job_attempt_check" CHECK ("waveform_job"."status" not in ('RUNNING','SUCCEEDED') or ("waveform_job"."attempt_id" is not null and "waveform_job"."started_at" is not null)),
	CONSTRAINT "waveform_job_error_check" CHECK (case when "waveform_job"."status" = 'FAILED' then "waveform_job"."error_code" is not null and "waveform_job"."error_code" in ('ENQUEUE_FAILED','PROCESSING_FAILED','DLQ','DELIVERY_EXPIRED','SOURCE_CHANGED') else "waveform_job"."error_code" is null end)
);
--> statement-breakpoint
CREATE TABLE "waveform_job_requester" (
	"job_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	CONSTRAINT "waveform_job_requester_job_id_account_id_pk" PRIMARY KEY("job_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "waveform" ADD CONSTRAINT "waveform_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waveform_job" ADD CONSTRAINT "waveform_job_song_id_song_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."song"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waveform_job_requester" ADD CONSTRAINT "waveform_job_requester_job_id_waveform_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."waveform_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waveform_job_requester" ADD CONSTRAINT "waveform_job_requester_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "waveform_job_active_key" ON "waveform_job" USING btree ("song_id","video_id") WHERE "waveform_job"."status" in ('QUEUED','RUNNING');--> statement-breakpoint
CREATE INDEX "waveform_job_song_idx" ON "waveform_job" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "waveform_job_requester_account_idx" ON "waveform_job_requester" USING btree ("account_id");