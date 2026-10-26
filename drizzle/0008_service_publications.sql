CREATE TABLE "service_publication" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"published_on" date NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"category" text,
	"release_version" text,
	"content" jsonb NOT NULL,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_publication_title_check" CHECK (length(btrim("service_publication"."title")) between 1 and 200),
	CONSTRAINT "service_publication_lock_version_check" CHECK ("service_publication"."lock_version" > 0),
	CONSTRAINT "service_publication_shape_check" CHECK (case
      when "service_publication"."kind" = 'notice' then
        "service_publication"."category" is not null and length(btrim("service_publication"."category")) between 1 and 40
        and "service_publication"."release_version" is null and jsonb_typeof("service_publication"."content") = 'string'
        and length(btrim("service_publication"."content" #>> '{}')) between 1 and 20000
      when "service_publication"."kind" = 'update' then
        "service_publication"."category" is null and "service_publication"."release_version" is not null
        and length(btrim("service_publication"."release_version")) between 1 and 40
        and case when jsonb_typeof("service_publication"."content") = 'array' then
          jsonb_array_length("service_publication"."content") between 1 and 100
          and not jsonb_path_exists("service_publication"."content", 'strict $[*] ? (@.type() != "string")')
        else false end
      else false end)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_publication_release_version_key" ON "service_publication" USING btree ("release_version") WHERE "service_publication"."kind" = 'update';--> statement-breakpoint
CREATE INDEX "service_publication_list_idx" ON "service_publication" USING btree ("kind","is_published","published_on","id");
--> statement-breakpoint
-- 현재 Web에서 공개 중인 공지 1건과 업데이트 2건을 그대로 이전한다.
INSERT INTO "service_publication" ("id", "kind", "title", "published_on", "is_published", "category", "release_version", "content") VALUES
('01a177c2-7216-75a8-824b-093241e80cd9', 'notice', '리뉴얼 기념 서비스 점검 및 최적화 안내', '2026-04-06', true, '공지', NULL, to_jsonb('어이어이 바위게 리뉴얼 및 최적화 작업을 진행 중입니다. 더 빠르고 쾌적한 응원법 연습 환경을 위해 노력하겠습니다.'::text)),
('01a177c2-7216-75a8-824b-0e7e85d32aed', 'update', '홈 모바일 뷰 리뉴얼', '2026-04-06', true, NULL, 'v0.2.1', '["모바일 레이아웃 최적화", "탐색 뎁스 축소", "더보기 탭 추가"]'::jsonb),
('01a177c2-7216-75a8-824b-133e504ac85b', 'update', '서비스 런칭', '2026-03-09', true, NULL, 'v0.1.0', '["서비스 오픈", "동영상기반 응원법 싱크 기능"]'::jsonb);
