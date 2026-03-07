-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "Song" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"albumName" text NOT NULL,
	"youtubeId" text NOT NULL,
	"lyrics" jsonb NOT NULL,
	"hasOfficialCheer" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Song_slug_key" ON "Song" USING btree ("slug" text_ops);
*/