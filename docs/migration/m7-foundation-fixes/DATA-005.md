# M7-DATA-005

## Status

PLANNED

2026-09-06 사용자 정책 승인과 TECHNICAL PLAN 작성 완료.
IMPLEMENT / REVIEW는 아직 시작하지 않았다. DATA-005 전체 완료 또는 VERIFIED를 뜻하지 않는다.

## PLAN

### Finding

Song.slug uniqueness policy. 스키마 누락 복구가 아니라 공개 식별자 정책 결정이다.
기준 커밋: `ca25046bcad0f1464fb77051a66ce2a838820a98`.
2026-09-06 fetch 후 local HEAD와 origin/migration_develop이 같은 것을 확인하고
`migration_m7-data-005-policy`로 분기했다. 시작 작업 트리는 깨끗했다.

### Selected Model / Effort

Registry 권고: POLICY DESIGN Astra High/Max, TECHNICAL PLAN Sol High,
IMPLEMENT 정책 결정 후 Sol High/Terra, FINAL REVIEW Astra 또는 Sol High.
사용자는 다음 IMPLEMENT worker로 Sol High를 지정했다. 이 PLAN 실행의 실제 runtime model/effort는
이 기록에서 확인할 수 없어 추정하지 않는다. 보조 agent 실행 없음.

### Approved Policy Decision

2026-09-06 사용자가 Option A를 다음 12개 조건과 함께 명시적으로 승인했다.

1. Song.id는 내부의 안정적인 Song identity다.
2. non-null Song.slug는 전체 Song에서 global unique다.
3. slug nullable은 유지하여 legacy null row를 허용한다.
4. null에서 최초 slug 지정은 허용한다.
5. 기존 non-null slug의 변경은 금지한다.
6. title 변경과 album 이동은 slug 변경 없이 허용한다.
7. 공개 URL `/songs/{slug}`는 유지한다.
8. 같은 앨범, 다른 앨범, 비공개 곡 모두 동일한 uniqueness 규칙을 적용한다.
9. 중복 slug는 자동 suffix를 만들지 않고 409와 slug field error로 처리한다.
10. Song을 참조하는 현재/미래 domain은 Song.id를 identity로 사용하며 slug를 FK/domain identity로
    사용하지 않는다.
11. 별도 UUID/public-id는 이번 범위에서 추가하지 않는다.
12. 삭제 후 slug 재사용, 영구 예약, redirect/history 정책은 후속 URL/deletion lifecycle decision으로
    남긴다.

이 결정은 DATA-005의 승인된 policy baseline이며 아래 TECHNICAL PLAN의 입력이다.

### Confirmed Cause

- `docs/migration/implementation/M7-DATA-LAYER-ANALYSIS.md` DATA-005:
  legacy unique 선언은 baseline에서 의도적으로 제거됐다.
- `docs/migration/implementation/LOCAL-DEVELOPMENT-ENVIRONMENT.md`의 schema decision:
  Song_slug_key는 repo-only / production 미확인으로 분류됐다. migration 누락으로 복원하지 않는다.
- `.local/M7-POSTGRES-VERIFICATION.md` (2026-09-05, 기준 3b5743e):
  로컬 non-null 중복 그룹 0, unique 제약 없음, 격리 DB에서 같은 slug 두 행 insert 성공.
  이 파일은 Git 제외된 과거 로컬 증거이며 이번 작업에서 DB 검증을 재실행하지 않았다.
- 현재 `src/server/db/schema.ts`: Song.slug nullable, slug unique/index 없음.
- `src/server/repositories/song-repository.ts`: 공개/관리자 조회가 slug 조건의 findFirst.
  중복 시 단일 곡 identity를 보장하지 못한다. 공개 조회는 Song visibility를 먼저 필터하고
  service가 부모 Album visibility를 검사하므로 중복된 다른 공개 곡이 있어도 선택 행에 따라 404가 될 수 있다.
- `src/app/(user)/songs/[slug]/page.tsx`, `src/app/api/songs/[slug]/route.ts`,
  `src/app/(admin)/admin/edit/[slug]/page.tsx`, sitemap과 목록 링크는 slug 단독 주소를 사용한다.
- `src/shared/contracts/song.ts`: 관리자 입력은 trim 후 소문자 영숫자/하이픈 slug를 요구한다.
  `song-service.ts`의 생성/수정은 slug 중복을 처리하지 않는다. 관리자 mutation identity는 숫자 id다.
- `song-service.test.ts`는 repository mock 기반이다. DB uniqueness를 증명하지 않는다.
- Domain Specification §8.1~8.2는 Song.id와 Song + Mode guide 관계를 정의하지만
  slug의 전역/앨범별 유일성이나 rename 호환성은 정하지 않는다.

### Invariant to Preserve

- RSC → Service → Repository(DbExecutor), HTTP Zod/DTO, service admin 권한 경계를 유지한다.
- Song.id를 곡 identity로 보존한다. slug 변경이나 album 이동으로 기존 곡을 새 곡으로 만들지 않는다.
- 공개 Song/Album visibility 검사와 관리자 id 기반 mutation을 보존한다.
- 기존 migration을 고치지 않고, 운영 credential 및 로컬 application DB를 사용/변경하지 않는다.
- 기존 URL 변경과 과거 URL 호환성은 제품 결정으로 명시한다. 자동 backfill/rename으로 숨기지 않는다.
- CheerGuide/Revision 신규 기능은 이번 범위 밖이며 그 URL을 선제 확정하지 않는다.

### Options

| 기준 | A. 전역 고유 slug | B. 앨범별 고유 slug | C. 비고유 slug | D. 별도 안정 공개 identity |
| --- | --- | --- | --- | --- |
| URL 의미 | 현재 /songs/{slug} 유지 | album + slug 필요 | slug 단독으로 곡 지정 불가 | id 등을 주소에 포함, slug는 설명용 가능 |
| findFirst 모호성 | non-null 전역 유일성으로 해소 | album 조건 없는 현재 조회는 여전히 모호 | 추가 식별자 없이는 미해결 | 안정 identity 조회로 해소 |
| 기존 URL | 기존 slug 유지 시 호환 | 구주소 해석/redirect 정책 필요 | 현 주소가 계속 모호 | 구주소 매핑/redirect 필요 |
| album 이동 | URL 유지 | URL 변경 및 목적 앨범 충돌 가능 | 중복 문제 유지 | identity 유지 가능 |
| rename | URL 변경; 불변 또는 alias 정책 선택 필요 | 복합 URL 변경 | 모호성과 링크 단절 동시 발생 가능 | id 유지; 설명용 slug redirect 여부 선택 |
| SEO | 기존 URL 유지에 유리; rename 별도 처리 | 주소 전환과 canonical 정리 필요 | canonical 대상 곡 불명확 | 전환/redirect 후 안정 URL 가능 |
| API identity | 공개 slug, 관리자 id 유지 가능 | 공개 계약에 album 추가 | 공개 API에 추가 키 필요 | 공개 API/Query key도 identity 전환 검토 |
| 미래 Guide/Revision | 내부 Song.id 참조; URL 설계 별도 | album 이동 결합 피할 설계 필요 | 내부 id와 공개 URL 분리 필요 | 안정 참조에 유리; 미래 기능 선구현 불필요 |
| DB 제약 후보 | non-null slug 전역 unique, null 허용 유지 | (albumId, slug) unique | slug unique 없음 | 공개 identity unique/PK; slug 유일성 별도 |
| 충돌 UX | 중복 slug 생성/수정 409 및 필드 안내 | 같은 앨범 중복/이동 409 | slug 충돌 없음; 상세 곡 선택 UX 필요 | identity 충돌 방지; slug 중복 허용 여부 별도 |
| migration/backfill | 중복 사전 점검, 새 migration; 임의 정리 금지 | 복합 제약 + URL 전환 | 제약 변경 없지만 조회 재설계 필요 | 기존 id 재사용 또는 새 키 backfill 및 URL 전환 |

C는 현상 유지안이며 현재 단일 상세 조회의 모호성을 해결하는 완료안으로 권고하지 않는다.
D에서 기존 Song.id를 공개 식별자로 사용할 수 있는지는 별도 제품 선택이며 새 UUID 컬럼을 당연시하지 않는다.

### Recommended Minimal Change

승인된 Option A를 다음의 작은 수직 변경으로 구현한다.

1. **사전 검사:** current local application DB에는 read-only transaction으로만 연결해 non-null slug
   duplicate group 수와 중복 행 수를 집계한다. slug 값 자체는 evidence에 기록하지 않는다. 한 그룹이라도
   있으면 schema/migration/code를 변경하기 전에 `ESCALATE`한다. Production credential은 사용하지 않으며,
   production 적용 전에는 운영자가 같은 read-only query를 별도 승인 절차로 실행해야 한다.
2. **Persistence:** `src/server/db/schema.ts`의 nullable `song.slug`에 명시적
   `.unique("Song_slug_key")`를 추가한다. PostgreSQL 기본 UNIQUE는 여러 NULL을 허용하므로 partial index나
   `NULLS NOT DISTINCT`를 사용하지 않는다. `pnpm db:generate`로 새 0004 migration과 snapshot/journal을
   만들고, 생성 SQL이 `Song_slug_key UNIQUE (slug)`만 추가하는지 검토한다. 0000~0003은 수정하지 않는다.
3. **불변 update:** 일반 `updateSong`은 type 수준에서 slug를 받을 수 없게 좁히고, 관리자 곡 편집에는
   별도의 policy-aware repository update를 사용한다. 이 update는 단일 PostgreSQL statement에서
   `id`와 `(현재 slug IS NULL OR 현재 slug = 요청 slug)`를 함께 조건으로 검사한다. 따라서 null 유지,
   null에서 최초 지정, 기존 값과 같은 slug를 보낸 title/album 변경은 허용하고, non-null에서 다른 값이나
   null로의 변경은 막는다. 조건 불일치 후 id/slug 최소 projection을 조회해 존재하면
   `SONG_SLUG_IMMUTABLE`, 없으면 `SONG_NOT_FOUND`로 분류한다. 여러 statement transaction이나 DB trigger는
   추가하지 않는다. 경쟁하는 null 최초 지정은 UPDATE predicate 재검사로 한 요청만 성공해야 한다.
4. **Conflict:** create와 policy-aware update에서 기존 narrow
   `isPostgresUniqueViolation(error, "Song_slug_key")`만 사용해 `SONG_SLUG_ALREADY_EXISTS`로 바꾼다.
   두 Song error code는 HTTP mapper에서 409가 된다. unknown constraint/다른 SQLSTATE는 원래 error를
   유지해 안전한 500 경로로 보낸다.
5. **Contract/UI:** create는 지금처럼 non-null slug를 요구한다. 관리자 summary는 DB의 null을 빈 문자열로
   숨기지 않고 nullable로 전달한다. update는 `slug: string | null`을 받아 legacy null 유지와 최초 지정을
   표현한다. 기존 non-null slug input은 현재 값을 보이되 read-only로 만들어 편집을 막고, null row만
   slug input을 활성화한다. 빈 edit input은 null로 전송한다. duplicate/immutable ApiError code는 RHF의
   slug field error로 연결한다. 자동 suffix는 만들지 않는다.
6. **Public read:** `/songs/{slug}`, API path, sitemap과 공개 링크 형식은 변경하지 않는다. 전역 unique
   constraint가 현재 slug-only `findFirst`의 단일 identity 전제를 보장하며 공개 Song/Album visibility
   filter는 그대로 둔다.
7. **Domain record:** `DOMAIN_SPECIFICATION.md`의 Song 절에 Song.id identity, nullable/global unique slug,
   최초 지정과 불변 조건, slug를 FK/domain identity로 사용하지 않는다는 승인 정책을 기록한다.
   미래 CheerGuide/Revision schema나 URL은 구현하지 않는다.

### Files Expected to Change

이번 PLAN 단계에서 변경하는 파일은 이 canonical evidence 하나뿐이다.

IMPLEMENT 예상 변경 파일은 다음과 같다. 생성 migration 이름의 slug만 `pnpm db:generate` 결과에 따른다.

- `docs/migration/DOMAIN_SPECIFICATION.md` — 승인된 Song identity/slug invariant.
- `src/server/db/schema.ts`, `src/server/db/schema.test.ts` — nullable global unique 선언과 metadata test.
- `drizzle/0004_*.sql`, `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json` — 새 migration.
- `src/shared/contracts/song.ts` — nullable admin summary와 update slug contract.
- `src/shared/contracts/error.ts`, `src/server/http/api-response.ts` —
  `SONG_SLUG_ALREADY_EXISTS`, `SONG_SLUG_IMMUTABLE` 409 계약.
- `src/app/api/admin/songs/route.test.ts`, `src/app/api/admin/songs/[id]/route.test.ts` —
  create/update input과 409 route regression.
- `src/server/repositories/song-repository.ts` — slug 없는 일반 update, policy-aware atomic update,
  실패 분류용 id/slug 최소 조회.
- `src/server/services/song-service.ts`, `src/server/services/song-service.test.ts` — create conflict,
  immutable update와 not-found 분류.
- `src/features/manage-song/model/schemas.ts`,
  `src/features/manage-song/ui/SongFormDialog.tsx`,
  `src/features/manage-song/ui/SongManagerClient.tsx`,
  `src/features/manage-song/ui/SongManagerTable.tsx`,
  `src/features/manage-song/model/schemas.test.ts`,
  `src/features/manage-song/ui/SongFormDialog.test.tsx` — null 표시/전송,
  기존 slug read-only, slug field error.
- 이 canonical evidence — IMPLEMENTATION/VERIFICATION 결과.

Route Handler 구현, 공개 Song page/API/repository read, query key, cache ownership은 변경하지 않는다.
기존 migration, Album 정책, 삭제/redirect/history, 별도 public id, future domain schema/feature,
generic repository/error/lock abstraction, production 배포 설정은 제외한다.

예상 범위가 20 files 또는 400 lines를 넘으면 global constraint → service contract → admin UX → 검증 순서로
리뷰할 수 있도록 PR 본문에 결합 이유와 리뷰 순서를 적는다. 이 항목들은 하나의 저장 경로에서 DB invariant와
409 field UX를 함께 보장하므로 별도 시점에 배포되는 PR로 분리하지 않는다.

### Tests Required

이번 PLAN 문서에는 application test를 추가하지 않는다. IMPLEMENT에서는 다음 regression을 추가한다.

- Schema metadata: Song.slug는 nullable이며 `Song_slug_key` 이름의 unique다.
- Service create: 실제 wrapper-shaped `Song_slug_key / 23505`는
  `SONG_SLUG_ALREADY_EXISTS`; unknown 23505/다른 오류는 원형 전파.
- Service update: null 유지, null → slug 최초 지정, 같은 slug로 title 변경, 같은 slug로 album 이동 성공.
  non-null → 다른 slug/null은 `SONG_SLUG_IMMUTABLE`; 없는 id는 `SONG_NOT_FOUND`.
- Route/error: create duplicate와 immutable update가 안전한 409 code를 반환하고, request schema는
  create non-null/update nullable 규칙을 지킨다.
- Admin UI: non-null slug는 read-only이고 null slug만 입력 가능하다. null을 유지하는 edit payload,
  최초 지정 payload, duplicate/immutable의 slug field error를 검증한다. 검색/표는 null을 안전하게 다룬다.
- Public regression: 기존 `/songs/{slug}` path와 공개/부모 visibility 동작은 변하지 않는다.
- Mock test는 DB constraint/concurrency 증거로 사용하지 않고 아래 실제 PostgreSQL 검증을 별도로 통과한다.

구현 순서에 맞춰 targeted test를 먼저 실행하고, 마지막에 repository gate를 실행한다.

```bash
pnpm exec vitest run src/server/db/schema.test.ts src/server/services/song-service.test.ts \
  src/app/api/admin/songs/route.test.ts 'src/app/api/admin/songs/[id]/route.test.ts' \
  src/features/manage-song/model/schemas.test.ts \
  src/features/manage-song/ui/SongFormDialog.test.tsx
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
```

### Actual PostgreSQL Verification

이번 PLAN 단계에서는 PostgreSQL을 재실행하지 않았다. 2026-09-05 evidence의 non-null duplicate group 0,
unique 제약 없음, duplicate insert 성공은 과거 관찰이며 수정 후 증거가 아니다.

IMPLEMENT에서 다음 절차를 수행한다.

1. Docker Compose PostgreSQL 17이 healthy인지 확인한다. 현재 local application DB에는 READ ONLY
   transaction으로만 연결하고 다음 의미의 집계를 실행한다.

   ```sql
   select count(*) as duplicate_groups, coalesce(sum(row_count), 0) as duplicate_rows
   from (
     select count(*) as row_count
     from "Song"
     where "slug" is not null
     group by "slug"
     having count(*) > 1
   ) duplicates;
   ```

   결과 count만 기록한다. duplicate group이 있으면 backfill/rename/delete하지 말고 IMPLEMENT를
   `ESCALATE`한다. Local application DB에는 migration/fixture/write를 실행하지 않는다.
2. 실행마다 이름이 다른 disposable verification DB를 만들고 localhost URL로
   `scripts/assert-local-database.ts` guard를 통과한다. 먼저 current tracked migration 0000~0003을 적용한다.
3. duplicate fixture가 있는 별도 disposable DB에서 새 migration이 23505로 중단되는 것을 확인한다.
   이는 자동 정리 없이 unsafe data를 거부하는 증거다. 실패 DB는 폐기한다.
4. clean disposable DB에 0000~0004를 적용한다. `pg_constraint`/`pg_indexes`에서
   `Song_slug_key`, contype `u`, `UNIQUE (slug)`를 확인하고 migration journal/hash가 새 파일과 맞는지
   확인한다. 두 NULL insert는 성공해야 한다.
5. 실제 PostgreSQL/Drizzle/Service를 사용해 같은 앨범, 다른 앨범, 비공개 곡 각각의 동일 slug insert가
   `23505 / Song_slug_key`이고 create Service/HTTP가 `SONG_SLUG_ALREADY_EXISTS` 409인지 확인한다.
6. null 유지, null → 최초 slug, non-null 같은 slug + title/album update를 확인한다. non-null → 다른
   slug/null은 immutable 409이고 기존 row가 바뀌지 않아야 한다. 이미 사용 중인 slug를 null row에
   최초 지정하면 duplicate 409이며 null이 유지돼야 한다.
7. 같은 slug의 동시 create N개는 정확히 1개만 성공하고 나머지는 duplicate 409여야 한다. 하나의 null
   row에 서로 다른 slug를 동시 최초 지정하면 정확히 1개만 성공하고 나머지는 immutable 409여야 한다.
   최종 row count/slug를 확인한다.
8. 공개 `/songs/{slug}` Service/DTO가 승인된 slug로 동일 곡을 반환하고 비공개 Song/Album visibility가
   기존대로 적용되는지 확인한다.
9. 실제 명령, 버전, count/catalog/SQLSTATE/AppError/HTTP/concurrency 결과와 한계를 VERIFICATION에
   기록한다. 연결 0개를 확인한 뒤 disposable DB만 drop한다.

Production credential/DB에는 접근하거나 migration을 적용하지 않는다. 기존 local application DB에도
migration을 적용하지 않는다. Production rollout은 별도 승인 후 같은 duplicate preflight와 migration
lock/rollback 검토를 거쳐야 한다. Disposable verification DB는 이 계획이 요구하는 격리 시험 대상이다.

### Risks / Unknowns

- 과거 로컬 duplicate 0은 현재 local/production 상태를 보장하지 않는다. 실제 current duplicate가 있으면
  처리 정책이 승인되지 않았으므로 escalation한다.
- PostgreSQL UNIQUE 추가는 table lock/build 비용이 있다. Production table size와 배포 허용 시간은
  미확인이며 이번 IMPLEMENT에서 production 적용하지 않는다.
- DB constraint는 global uniqueness를 보장한다. non-null slug immutability는 모든 application write를
  Service → policy-aware repository update로 제한하고 atomic predicate로 보장한다. 이 범위를 우회하는
  별도 writer 또는 database-level trigger 요구가 발견되면 migration에 trigger를 임의 추가하지 않고
  architecture decision으로 escalation한다.
- Admin DTO의 nullable slug가 현재 UI consumer에 영향을 준다. 모든 compile-time/runtime consumer를
  고쳐야 하며 public Song DTO는 계속 non-null이다.
- 삭제 후 slug 재사용, 과거 URL redirect/history, 영구 예약은 의도적으로 미결이다. 이번 unique 제약은
  삭제된 row의 slug를 예약하지 않는다.
- 다음이면 IMPLEMENT를 중단한다: duplicate current data, schema 외 추가 generated SQL, constraint 이름
  불일치, Drizzle wrapper shape 변화, atomic UPDATE가 실제 동시성 invariant를 지키지 못함, 기존 URL 또는
  visibility 변경 필요, production/local application DB write 필요, 승인되지 않은 lifecycle 결정을 요구함.
- 원본 DB 오류나 row 전체를 evidence/log/Sentry에 기록하지 않는다.

### Implementation Prompt

Sol High는 `M7-DATA-005`만 구현한다. Canonical plan은
`docs/migration/m7-foundation-fixes/DATA-005.md`다. 사용자가 승인한 Option A와 12개 policy condition을
그대로 유지한다: Song.id가 내부 identity이고, nullable non-null slug는 global unique이며, null 유지/최초
지정은 허용하고 기존 non-null slug 변경은 금지한다. title/album 변경과 `/songs/{slug}`는 유지한다.

코드 변경 전 current local application DB를 read-only duplicate 집계로 검사한다. duplicate가 있으면
데이터를 고치지 말고 `ESCALATE`한다. 이상이 없으면 Drizzle의 nullable slug에 명명된
`Song_slug_key` unique를 추가하고 `pnpm db:generate`로 새 migration을 생성한다. 기존 migration은 한 byte도
수정하지 않는다. 생성 SQL이 승인 범위 외 변경을 포함하면 중단한다.

일반 repository update가 slug를 받을 수 없게 하고, 관리자 edit에는 `(현재 slug IS NULL OR 현재 slug =
요청 slug)`를 id와 함께 검사하는 단일 atomic UPDATE를 사용한다. 실패한 id의 최소 projection으로
immutable/not-found를 구분한다. `Song_slug_key / 23505`만 기존 narrow helper로 duplicate AppError에 매핑한다.
새 duplicate/immutable code를 409로 매핑하고 관리자 RHF slug field error로 표시한다. Admin summary/update
contract는 legacy null을 보존하고 UI는 non-null slug를 read-only로, null slug를 입력 가능하게 만든다.
Public route/read/query key는 바꾸지 않는다. Domain Specification에는 승인된 identity invariant만 추가하며
future domain은 구현하지 않는다.

PLAN의 예상/제외 파일과 focused tests를 지킨다. 지정된 targeted tests, 전체 gate와 build를 실행한다.
PostgreSQL 증거는 current local DB가 아닌 disposable PostgreSQL 17 DB에서 0000~0004 migration/catalog,
duplicate migration failure, nullable, 같은/다른 album 및 hidden duplicate, create/update 409, null 최초 지정,
immutability, public read, concurrent create/assignment를 실제 구현으로 확인한다. 결과와 cleanup을 이 파일에
기록하고 REVIEW는 pending으로 둔다.

Production credential/DB와 existing local application DB에 migration/write를 실행하지 않는다. Current
duplicate, 승인 범위 밖 migration diff, trigger/별도 writer 필요, constraint/runtime shape 불일치,
concurrency 실패, URL/lifecycle 정책 추가 결정이 필요하면 범위를 넓히지 말고 evidence와 필요한 선택을
보고하며 `ESCALATE`한다. 구현 완료 후에만 `/m7-review DATA-005`로 넘긴다.

## IMPLEMENTATION

pending

## VERIFICATION

정책 문서 근거와 current code/migration/error/form 경계를 정적 대조했다.
사용자 승인 정책과 Sol High TECHNICAL PLAN handoff를 기록했다.
application test/build/DB 검증은 이번 PLAN 단계에서 실행하지 않았다.

## REVIEW

pending
