CREATE TABLE "home_carousel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"placement" text NOT NULL,
	"draft_slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "home_carousel_placement_key" UNIQUE("placement"),
	CONSTRAINT "home_carousel_placement_check" CHECK ("home_carousel"."placement" = 'home'),
	CONSTRAINT "home_carousel_lock_version_check" CHECK ("home_carousel"."lock_version" > 0),
	CONSTRAINT "home_carousel_draft_slides_check" CHECK (case when jsonb_typeof("home_carousel"."draft_slides") = 'array' then
          jsonb_array_length("home_carousel"."draft_slides") <= 10
          and not jsonb_path_exists("home_carousel"."draft_slides", 'strict $[*] ? (@.type() != "object")')
        else false end),
	CONSTRAINT "home_carousel_published_slides_check" CHECK (case when jsonb_typeof("home_carousel"."published_slides") = 'array' then
          jsonb_array_length("home_carousel"."published_slides") <= 10
          and not jsonb_path_exists("home_carousel"."published_slides", 'strict $[*] ? (@.type() != "object")')
        else false end)
);
