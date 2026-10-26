CREATE TABLE "service_policy" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"effective_on" date NOT NULL,
	"content" jsonb NOT NULL,
	"change_notice" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_policy_slug_version_key" UNIQUE("slug","version"),
	CONSTRAINT "service_policy_slug_check" CHECK ("service_policy"."slug" in ('privacy', 'terms', 'copyright', 'email', 'ga')),
	CONSTRAINT "service_policy_version_check" CHECK ("service_policy"."version" > 0),
	CONSTRAINT "service_policy_title_check" CHECK (length(btrim("service_policy"."title")) between 1 and 200),
	CONSTRAINT "service_policy_description_check" CHECK (length(btrim("service_policy"."description")) between 1 and 500),
	CONSTRAINT "service_policy_content_check" CHECK (case when jsonb_typeof("service_policy"."content") = 'array' then
      jsonb_array_length("service_policy"."content") between 1 and 100
      and not jsonb_path_exists("service_policy"."content", 'strict $[*] ? (@.type() != "string")')
      else false end),
	CONSTRAINT "service_policy_change_notice_check" CHECK ("service_policy"."change_notice" is null or length(btrim("service_policy"."change_notice")) between 1 and 2000)
);
--> statement-breakpoint
CREATE INDEX "service_policy_public_idx" ON "service_policy" USING btree ("slug","version" DESC NULLS LAST) WHERE "service_policy"."is_published" = true;
--> statement-breakpoint
-- f4efc1a2281ca59a0276971055341e57e137940d의 공개 안내 다섯 건을 내용 그대로 이전한다.
-- 새 본문 시안은 검토 전이므로 포함하지 않는다.
INSERT INTO "service_policy" ("id", "slug", "version", "title", "description", "effective_on", "content", "change_notice", "is_published") VALUES
('01a178f7-0993-7ab3-aed9-f57159691356', 'privacy', 1, '개인정보 처리방침', '여러분의 소중한 개인정보를 어떻게 보호하고 있는지 알려드립니다.', '2026-04-06', '["제1조 (목적) 본 방침은 팬 메이드 비영리 프로젝트 ''어이어이 바위게''(이하 ''서비스'') 이용자의 권익을 보호하고 개인정보 관련 고충을 처리하기 위해 수집 및 이용 기준을 규정합니다.", "제2조 (수집 항목) 서비스는 별도의 회원가입 없이 이용 가능하며, UX 개선을 위한 익명 기기 정보(Google Analytics) 및 응원법 공유 시의 최소한의 메타데이터만을 수집합니다.", "제3조 (보유 및 파기) 수집된 비식별 정보는 서비스 운영 목적 달성 시까지 보관하며, 이용자가 브라우저 쿠키 삭제 등을 통해 수집 거부를 요청할 경우 즉각 반영됩니다."]'::jsonb, '본 약관의 구체적인 내용은 서비스의 업데이트에 따라 사전 고지 없이 변경될 수 있습니다.', true),
('01a178f7-0993-7942-bd90-a2cb09a88b2c', 'terms', 1, '이용 약관', '어이어이 바위게 서비스 이용을 위한 기본적인 규칙입니다.', '2026-04-06', '["제1조 (독립성 명시) 본 서비스는 QWER 팬들에 의해 운영되는 독립적인 비영리 프로젝트이며, 아티스트 소속사인 ''3Y Corporation''과는 어떠한 공식적 관계도 없음을 밝힙니다.", "제2조 (이용 제한) 본 서비스는 응원법 연습이라는 본래 목적 외에 영리적 이용, 부당한 시스템 접근(크롤링 등), 아티스트의 명예를 훼손하는 행위에 대한 이용을 엄격히 금지합니다.", "제3조 (면책 조항) 서비스 내 정보는 팬들의 자발적 참여로 가공되었습니다. 실제 공식 응원법 및 공연 현장 상황과 차이가 있을 수 있으며, 이로 인해 발생하는 혼선에 대해 본 운영팀은 책임을 지지 않습니다."]'::jsonb, '본 약관의 구체적인 내용은 서비스의 업데이트에 따라 사전 고지 없이 변경될 수 있습니다.', true),
('01a178f7-0993-7298-992b-875ff5920f9a', 'copyright', 1, '저작권 정책', '응원법 및 앨범 자산의 저작권에 관한 안내입니다.', '2026-04-06', '["본 서비스에 사용된 앨범 아트, 곡 제목, 아티스트 성명 등 모든 지식재산권은 원저작권자인 ''3Y Corporation''에 귀속됩니다.", "본 서비스는 아티스트의 활동을 지원하고 팬덤 문화를 활성화하기 위한 비영리 목적으로만 운영되며, 저작권자의 요청이 있을 경우 관련 콘텐츠는 즉각 수정 또는 삭제됩니다.", "서비스 내 독자적으로 구성된 UI/UX 디자인 및 응원법 가이드 데이터의 권리는 ''어이어이 바위게'' 제작팀에 있으며, 무단 복제 및 상업적 재배포를 금합니다."]'::jsonb, '본 약관의 구체적인 내용은 서비스의 업데이트에 따라 사전 고지 없이 변경될 수 있습니다.', true),
('01a178f7-0993-7b90-a5b0-665bcb3c1d12', 'email', 1, '이메일 무단 수집 거부', '무분별한 광고성 연락으로부터의 권리를 보호합니다.', '2026-04-06', '["본 웹사이트에 게시된 운영진의 이메일 주소가 자동 수집 프로그램이나 기타 기술적 장치를 이용하여 무단으로 수집되는 것을 거부합니다.", "이를 위반하여 스팸 메일 발송 등 부당한 행위가 적발될 경우 관련 법령에 의해 처벌될 수 있음을 유념하시기 바랍니다."]'::jsonb, '본 약관의 구체적인 내용은 서비스의 업데이트에 따라 사전 고지 없이 변경될 수 있습니다.', true),
('01a178f7-0993-7a45-946b-6f8beaaedbec', 'ga', 1, 'GA 수집 안내', '더 나은 서비스 경험을 위한 통계 데이터 수집에 관한 안내입니다.', '2026-04-06', '["더 나은 팬 경험(UX)을 제공하기 위해 Google Analytics를 사용하여 익명의 방문 통계를 수집하고 있습니다.", "수집 정보는 개인을 특정할 수 없는 범위(연령대, 기기 종류, 페이지 체류 시간 등) 내에서만 활용되며, 이는 오직 서비스 사용성 개선을 위한 분석 목적으로만 사용됩니다."]'::jsonb, '본 약관의 구체적인 내용은 서비스의 업데이트에 따라 사전 고지 없이 변경될 수 있습니다.', true);
