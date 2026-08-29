CREATE TABLE "Album" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"imgUrl" text NOT NULL,
	"color" text NOT NULL,
	"releaseDate" timestamp(3),
	"isVisible" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "Album_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "Song" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"albumId" integer NOT NULL,
	"title" text,
	"youtubeId" text,
	"lyrics" jsonb,
	"hasOfficialCheer" boolean,
	"isTitle" boolean DEFAULT false NOT NULL,
	"isVisible" boolean DEFAULT true NOT NULL,
	"order" bigint,
	"createdAt" timestamp(3) with time zone,
	"updatedAt" timestamp(3) with time zone,
	"slug" text
);
--> statement-breakpoint
ALTER TABLE "Song" ADD CONSTRAINT "Song_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "public"."Album"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Song_albumId_idx" ON "Song" USING btree ("albumId");