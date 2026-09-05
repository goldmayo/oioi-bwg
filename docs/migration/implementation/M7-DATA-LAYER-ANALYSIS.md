# M7 Data Layer / Foundation 분석

## Current State

- 분석일: 2026-09-05. 상태: **분석 완료, 코드 수정 전 중간 보고**. Foundation 완료 판정은 보류한다.
- 실제 코드 기준: `migration_m7-data-layer-analysis`, `e5f908b762c5b8b1e6fe22f09cb367989b1b89ee`.
- PR #51은 이미 squash 병합됐다. 문서 checkpoint는 fetch로 확인한 `origin/migration_develop`의
  `e31f7295d3d9575e37a954986b89a701fd39547d`에서 `migration_m7-foundation-audit`로 분기한다.
  두 커밋의 `src`, `drizzle`, `package.json`에는 tree diff가 없다. stale local `migration_develop`
  (`a92959d`)은 분기 기준으로 사용하지 않았다.
- Legacy 코드 기준: `4b299934846f4a0eed7132f58c5b1c2a481a3739`. `git show`로 실제 schema/query를 확인했다.
- 추가 입력: 원래 작업 트리의 `docs/reverse-engineering/legacy-main/`, `migrated-current/`,
  `10-main-to-migrated-gap-map.md`, `docs/ENGINEERING_PRINCIPLES.md` 및 사용자 실행 지시.
  이 문서 이동·추가는 분석 시작 시 미커밋 상태였다. 이를 이번 PR에 포함하거나 과거 snapshot의
  provenance를 현재 HEAD로 덮어쓰지 않는다. 아래 소스 경로는 코드 기준 커밋에 대한 evidence다.
- AS-IS는 관찰 사실, Gap Map은 snapshot 차이, active Architecture 01~12는 목표 경계,
  `DOMAIN_SPECIFICATION.md`는 도메인 oracle로 구분했다. 기존 M3/M5/M6/M7 결과는 과거 기록이다.
- 이번 변경은 이 분석 문서뿐이다. schema/SQL/application code, 운영 DB와 R2를 변경하지 않았다.

### 구조와 schema ownership

```text
RSC → Service → Repository(executor) → Drizzle → PostgreSQL
Client → Query → ky → Route Handler → 같은 Service
이미지 업로드 예외: Feature Server Action → shared/api/r2 → R2
```

| 대상 | 현재 evidence | 판정 |
| --- | --- | --- |
| Runtime schema | `src/server/db/index.ts`가 `./schema`를 Drizzle에 전달 | already-correct |
| Tooling schema | `drizzle.config.ts`: `./src/server/db/schema.ts`, out `./drizzle` | already-correct |
| Migration history | `drizzle/0000`~`0003` SQL, 같은 tag의 journal 4 entries와 snapshot | already-correct: 정적 대조 범위 |
| DB executor | `Database`, transaction callback에서 추출한 `Transaction`, `DbExecutor = Database \| Transaction` | already-correct |
| Connection | postgres.js process singleton, max 10 / idle 20초 / connect 10초 | 구조 일치; 실제 pool 적정성 unknown |
| DB scripts | generate는 schema 기반; migrate/pull/studio는 local hostname guard 선행 | already-correct |
| Local restore | `scripts/restore-local-dump.sh`: 명시적 `.local` dump, 비어 있는 Album/Song에 data-only 복원 | already-correct; 이번 실행 없음 |
| Legacy files | root `drizzle/schema.ts`, `src/shared/api/db/drizzle` 제거됨; 빈 `drizzle/relations.ts`만 잔존 | runtime ambiguity 없음; 잔여 artifact |
| Actual DB | 현재 WSL에서 Docker 사용 불가, DB catalog·migration journal 직접 조회 못 함 | unknown |

`0000`은 빈 DB용 CREATE baseline이다. 기존 운영 Album/Song에 적용할 incremental upgrade SQL로
간주하지 않는다. `LOCAL-DEVELOPMENT-ENVIRONMENT.md`의 baseline reconciliation 보류가 여전히 유효하다.

### Schema ↔ SQL ↔ snapshot 정적 대조

아래는 `src/server/db/schema.ts`, SQL 0000~0003, `meta/0003_snapshot.json`의 7개 table 대조 결과다.
`?`는 nullable, 나머지는 NOT NULL이다. `ts`는 timezone 없는 timestamp, `tstz`는 with time zone이다.
별도 표시가 없는 column에는 default가 없다. PK의 자동 index와 명시적 보조 index를 구분한다.

| Table | Column / type / nullable / default | PK / FK / unique / index / CHECK | 정적 정합성 |
| --- | --- | --- | --- |
| account (5) | id bigint identity always; role/status text; created_at tstz=now(); deleted_at tstz? | PK id; role 3종·status 4종·DELETED iff deleted_at CHECK; FK/별도 index 없음 | 일치 |
| profile (4) | account_id bigint; nickname text; avatar_url text?; updated_at tstz=now() | PK account_id; account FK RESTRICT; nickname unique; CHECK 없음 | 일치 |
| password_credential (6) | account_id bigint; email/password_hash text; email_verified_at/password_changed_at tstz; updated_at tstz=now() | PK account_id; account FK RESTRICT; email unique; 정규화된 비어 있지 않은 email·비어 있지 않은 hash CHECK | 일치 |
| email_verification_challenge (12) | id uuid=gen_random_uuid(); email/otp_hash/status text; failed_attempts int=0; ip_address inet; expires_at/last_sent_at tstz; verified_at/consumed_at/invalidated_at tstz?; created_at tstz=now() | PK id; FK/unique 없음; (email,created_at)·(ip_address,created_at) index; 상태 4종·hash nonempty·attempts 0~5·상태와 각 시각 iff CHECK | 일치하나 consume 동작과 충돌: DATA-001 |
| email_verification_rate_limit (5) | scope/key text; window_started_at tstz; request_count int=0; updated_at tstz=now() | 복합 PK (scope,key,window_started_at); updated_at index; EMAIL/IP·key nonempty·count≥0 CHECK; FK 없음 | 일치 |
| Album (8) | id serial; name/slug/imgUrl/color text; releaseDate ts(3)?; isVisible bool=true; createdAt ts(3)=CURRENT_TIMESTAMP | PK id; Album_slug_key unique; FK/CHECK/별도 index 없음 | 일치 |
| Song (12) | id bigserial; albumId int; title/youtubeId/slug text?; lyrics jsonb?; hasOfficialCheer bool?; isTitle bool=false; isVisible bool=true; order bigint?; createdAt/updatedAt tstz(3)? | PK id; Album FK CASCADE; Song_albumId_idx; slug unique·CHECK 없음 | 일치; slug 결정 이력은 DATA-005 |

FK의 ON UPDATE는 모두 NO ACTION이다. auth id는 bigint 모드, Song id/order는 number 모드다.
정적 정의의 일치는 현재 DB에 적용됐다는 증거도, Service의 상태 전이가 유효하다는 증거도 아니다.

### Legacy content preservation

| 동작 | Legacy → 현재 코드 | 분류 |
| --- | --- | --- |
| Album/Song/lyrics | 두 table과 JSONB 유지. nullable lyrics는 Service에서 `[]`로 정규화하고 잘못된 구조는 unexpected error | 저장 모델 유지; 운영 데이터 round-trip unknown |
| Album 삭제 | `Song.albumId → Album.id ON DELETE CASCADE` 양쪽 존재 | already-correct |
| 공개 목록 | visible Album + visible Song, Album releaseDate DESC, Song order ASC 유지 | already-correct |
| 공개 상세 | Legacy slug read에는 부모/본인 visible 검사가 없었음. 현재 Album/Song repository 및 Song mapper가 비공개를 차단 | 의도된 접근 강화; 단순 behavior-preserved로 기록하지 않음 |
| 곡 상세의 형제 곡 | Legacy/current 모두 relation `songs: true`로 SQL orderBy 없음 | legacy artifact; 새로운 정렬 regression으로 단정하지 않음 |
| 관리자 목록 | Album releaseDate ASC; Song albumId/order ASC 유지 | already-correct |
| 슬러그 조회 | findFirst 기반 조회 유지; Song slug unique 제거 이력 존재 | partial: DATA-005 |
| null/type/default 변화 | Song serial→bigserial, order int→nullable bigint, 일부 필수값 nullable, timestamp timezone 변경 | 과거 baseline 정규화 결정 기록 있음; 새 누락으로 간주하지 않음 |

### Authorization / Repository / Transaction inventory

| Privileged use case | Delivery → 최종 경계 | 실제 검사 |
| --- | --- | --- |
| Album 목록 / 생성 / 수정 / 삭제 | GET/POST `/api/admin/albums`, PATCH/DELETE `/{id}`, Admin RSC → album-service | 모든 use case의 requireAdmin → requireUser + ability manage/all |
| Song 목록 / editor 조회 | GET `/api/admin/songs`, editor RSC → song-service | requireAdmin |
| Song 생성 / 수정 / 삭제 | POST `/api/admin/songs`, PATCH/DELETE `/{id}` → song-service | requireAdmin |
| Lyrics 저장 | PATCH `/api/admin/songs/{id}/lyrics` → saveSongLyrics | requireAdmin |
| Album image upload | uploadAlbumImageAction → uploadPublicAsset → PutObject | **검사 없음**, DATA-002 |

Repository 4개 module은 모두 executor를 첫 인자로 받고 SQL/persistence만 수행한다. HTTP, cookie,
session, CASL, UI, getDatabase 호출, transaction 시작은 없다. App/RSC/Route Handler에서 repository/DB를
직접 import하는 경로와 Client/shared contracts의 Drizzle inferred type import는 검색에서 발견되지 않았다.
`request-context.ts → auth-repository`는 identity facts 로딩 infrastructure로 별도 분류한다.
Service와 DB singleton에는 `server-only`가 있지만 repository/schema 자체에는 없다. 현재 import graph와
marker 범위를 구분하며, “모든 repository에 marker가 있다”는 의미로 완료를 기록하지 않는다.

| Auth flow | 실제 transaction / atomicity | 판정 |
| --- | --- | --- |
| OTP request | Service transaction: 이전 challenge FOR UPDATE → email/IP counter upsert → 이전 PENDING 무효화 → insert; 메일은 commit 이후 발송 | ownership 일치; 동시 최초 요청 cooldown 빈틈 DATA-009 |
| OTP verify | read 후 PENDING/expiry/attempt 조건부 UPDATE; 성공 전이와 실패 횟수 증가는 각각 단일 SQL | 무조건 transaction 추가 불필요; 실제 동시성 테스트 부족 |
| Signup complete | consume + Account/Profile/Credential 생성에 같은 tx 전달; hash는 transaction 밖 | ownership 일치; CHECK 때문에 consume 실패 DATA-001 |

## Findings

### M7-DATA-001 — VERIFIED challenge 소비가 CHECK와 충돌

- **Area / Status / Severity:** Schema·Transaction / needs-fix / high (P0).
- **Current:** consume은 status와 consumed_at만 변경한다. VERIFIED 행의 verified_at은 non-null로 남는다.
- **Expected Architecture:** 06 §14/43과 Domain AUTH-002의 원자적 회원가입. 검증 후 계정 생성이 가능해야 한다.
- **Evidence:** `schema.ts:145`와 `0002_email_verification_challenge.sql`의
  `(status = 'VERIFIED') = (verified_at IS NOT NULL)`; `email-verification-repository.ts:58`;
  `signup-service.ts:21`. CONSUMED 변경 시 `false = true`라 CHECK가 false다.
- **Risk:** 해당 migration이 적용된 DB에서는 정상 인증 후 회원가입 완료가 constraint violation으로 실패한다.
  실제 DB 재현은 미실행이며 SQL과 UPDATE의 논리 충돌로 확정한 finding이다.
- **Required Change:** 최소안은 현재 iff 계약을 유지하면서 consume 시 verified_at을 null로 전이하는 것.
  검증 시각을 소비 후에도 보존하려면 상태/시각 계약을 먼저 확정하고 schema + 새 ALTER migration으로 변경한다.
  기존 SQL을 조용히 수정하거나 CHECK를 무조건 삭제하지 않는다. Credential의 인증 시각 의미도 함께 확인한다.
- **Verification:** PostgreSQL 17에서 PENDING→VERIFIED→CONSUMED 성공, 재소비 거부,
  뒤따르는 profile/credential insert 실패 시 challenge와 account rollback 확인.

### M7-DATA-002 — 이미지 업로드가 최종 security boundary를 우회

- **Area / Status / Severity:** Authorization·Storage / needs-fix / high (P0).
- **Current:** 파일 size/type 검사 후 곧바로 R2 PutObject. context/service authorization이 없다.
- **Expected Architecture:** 06 §17, 11 §8: 관리자 업로드도 Service에서 인증·권한을 강제한다.
- **Evidence:** `src/features/manage-album/api/upload-album-image-action.ts:15`,
  `src/shared/api/r2/upload-public-asset.ts:28`; album form이 이 Action을 직접 호출한다.
- **Risk:** Action을 호출할 수 있는 요청에 대한 application-level 업로드 제한이 없다.
  AdminLayout과 숨겨진 버튼은 Action의 권한 검사를 대체하지 않는다.
- **Required Change:** 작은 upload service에 requireUser/manage-all 검사와 파일 validation을 두고,
  app delivery adapter가 context를 전달한다. R2 credential/client는 `server/storage`로 이동한다.
  이번 checkpoint에서는 제한적 Server Action을 유지할 수 있으며 CRUD transport 전체를 바꿀 필요는 없다.
- **Verification:** guest/USER/REVIEWER는 storage 호출 0회, ADMIN 성공, 잘못된 FormData/MIME/size 거부.
  로컬 서버에서 Action 직접 호출 경로도 확인하며 실제 R2 upload는 필수 테스트로 만들지 않는다.

### M7-DATA-003 — unique conflict가 Drizzle wrapper를 통과하지 못함

- **Area / Status / Severity:** Error contract / needs-fix / medium (P1).
- **Current:** Album/signup service가 outer `error.message.includes(constraintName)`만 검사한다.
- **Expected Architecture:** 03의 expected conflict → AppError → 409. 내부 오류는 그대로 500으로 남긴다.
- **Evidence:** `album-service.ts:104,122`, `signup-service.ts:39,42`;
  설치된 drizzle-orm 0.45.1 `pg-core/session.js:41`는 원인을 DrizzleQueryError.cause에 보관하고
  `errors.js:12`의 outer message는 SQL/params다. synthetic 오류 검사에서 constraint match=false,
  cause.code=23505, cause.constraint_name 보존을 확인했다.
- **Risk:** 실제 중복 Album slug/email/nickname이 409 대신 500이 된다. mock AppError만 던지는 route test로는 검출 불가.
- **Required Change:** 제한된 cause 탐색과 SQLSTATE 23505 + 알려진 constraint_name의 명시적 mapping.
  Generic repository/error framework 대신 작은 server helper로 충분하다.
- **Verification:** 실제 wrapped error shape의 unit test와 PostgreSQL 중복 insert/update → 공개 409 확인.

### M7-DATA-004 — DB 오류의 SQL/params가 로그·capture 경로에 전달됨

- **Area / Status / Severity:** Observability·Sensitive data / needs-fix / high (P0 우선 처리).
- **Current:** unknown error를 logger가 raw console.error/captureException으로 전달한다.
  server structured JSON logger와 명시적 redaction이 없고 instrumentation도 원본 오류를 전달한다.
- **Expected Architecture:** 09 §13~14: structured server logging, password/token/PII/full row capture 금지.
- **Evidence:** `api-response.ts:99`, `src/shared/lib/sentry.ts:15`, `src/instrumentation.ts:17`,
  `sentry.server.config.ts`; 설치된 DrizzleQueryError.message에 params가 포함됨을 synthetic 값으로 확인.
  credential/challenge write의 파라미터에는 email, password hash, OTP hash, IP 등이 포함된다.
- **Risk:** DB 실패 시 민감 값이 application logger에 넘어가는 경로가 있다. 실제 Sentry 저장/노출 여부는 unknown이다.
  단순히 extras에서 password 키만 삭제해서는 message/cause의 SQL payload가 제거되지 않는다.
- **Required Change:** 안전한 error serialization/allowlist와 server logger 경계를 정하고,
  HTTP·RSC instrumentation·Auth.js 실패 경로를 함께 검토한다. SQL/params/raw cause는 전송하지 않는다.
  HTTP의 generic 500와 output-failure 관측은 유지한다.
- **Verification:** synthetic email/hash/token/SQL을 포함한 중첩 오류를 넣어 console/capture payload에
  남지 않는지 확인하고, 안전한 오류 종류·event/source는 유지되는지 검증한다.

### M7-DATA-005 — Song.slug는 의도된 baseline 변경이며 product uniqueness는 미결

- **Area / Status / Severity:** Schema ownership / partial / medium (decision).
- **Current:** nullable, unique/index 없음. runtime/schema/SQL 간 불일치가 아니다.
- **Expected Architecture:** 과거 운영 관찰값, application constraint, 향후 제품 결정을 분리한다.
- **Evidence:** Legacy commit의 runtime schema와 root schema 모두 Song_slug_key를 선언한다.
  `a249a6c`가 root schema를 삭제하고 runtime unique를 제거했다.
  `LOCAL-DEVELOPMENT-ENVIRONMENT.md` §Schema decision은 “repo-only, production 미확인”으로
  baseline에서 제거했다고 명시한다. M3 결과도 운영 재확인을 보류했다.
- **Risk:** 중복 slug를 DB/API가 허용하며 findFirst 결과의 identity가 모호해질 수 있다.
  Gap Map의 root/runtime 설명만으로 원인을 확정하면 실제 Legacy runtime 선언을 놓친다.
- **Required Change:** migration 누락으로 unique를 복원하지 않는다. global/per-album/non-unique 정책과
  기존 중복 처리·URL 호환성을 별도 결정한다. 현재 DB 중복·index·제약 적용 상태는 unknown으로 유지한다.
- **Verification:** 승인된 로컬 snapshot의 중복 집계와 catalog 확인; 결정 후에만 schema migration/충돌 계약 테스트.

### M7-DATA-006 — Query ownership은 단일하지만 mutation invalidation이 불완전

- **Area / Status / Severity:** Cache / needs-fix / medium (P1).
- **Current:** Album/Song CRUD는 자기 adminList만 invalidate. lyrics 저장 성공에는 invalidation이 없다.
- **Expected Architecture:** 07 §20/50: mutation이 바꾼 실제 Query consumer를 명시적으로 무효화한다.
- **Evidence:** `AlbumManagerClient.tsx:88`, `SongManagerClient.tsx:54`,
  `app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.tsx:20`, `entities/song/api/mutations.ts`.
  Song admin list는 album.name, youtubeId, updatedAt을 소비한다.
- **Risk:** album rename/delete와 lyrics의 YouTube ID 변경이 이미 존재하는 song list cache에 stale 값을 남긴다.
  navigation/refetch가 우연히 갱신하더라도 명시적 mutation consistency 보장은 없다.
- **Required Change:** lyrics save → song adminList; album rename/delete → album + song adminList.
  다른 slice 직접 import 대신 필요한 경우 route 조합에서 callback으로 연결한다.
  현재 RSC-only 공개 뷰와 local editor draft에 억지로 Query를 추가하지 않는다.
- **Verification:** 두 list cache를 채운 뒤 mutation하여 영향 key stale/refetch와 draft 보존을 확인한다.

### M7-DATA-007 — 관리자 목록이 명시적 목록 DTO 대신 bare array

- **Area / Status / Severity:** HTTP contract / needs-fix / low (P1).
- **Current:** Album/Song GET 및 client parser가 각각 summarySchema.array()를 사용한다.
- **Expected Architecture:** 사용자 실행 기준 및 03 §4의 명시적 목록 DTO. 성공 generic envelope는 금지.
- **Evidence:** `app/api/admin/{albums,songs}/route.ts`, `entities/{album,song}/api/api.ts`.
- **Risk:** 현재 server/client끼리는 일치하지만 목표 응답 형식과 다르다.
- **Required Change:** 도메인별 list schema를 추가하고 route/client/seed/consumer를 함께 전환한다.
  예: `{ items, nextCursor: null }`. 전체 조회/client pagination은 유지하고 서버 pagination은 별도 요구가 있을 때만 추가.
- **Verification:** 동일 queryKey로 hydration한 DTO와 HTTP refetch shape 일치, output/client parser 테스트.

### M7-DATA-008 — 중요한 DB/security 경로가 mock 위주 테스트로만 보호됨

- **Area / Status / Severity:** Testing / partial / high (P0 보강).
- **Current:** 실제 PostgreSQL repository/rollback 테스트와 반복 가능한 browser E2E suite가 없다.
- **Expected Architecture:** 06 §42~43, 10 §6/14~15: 실제 DB constraint/transaction 검증.
- **Evidence:** `signup-service.test.ts`는 transaction callback과 consume을 mock한다.
  `schema.test.ts`는 CHECK 이름을 확인한다. `public-visibility.test.ts`는 query predicate mock 검사다.
  song-service test의 requireUser는 mock이고, admin route는 service를 mock한다.
- **Risk:** DATA-001/003과 실제 Service authorization 누락이 초록색 unit 결과에 숨을 수 있다.
- **Required Change:** 아래 missing coverage map 순서로 추가하며 전체 테스트 일괄 작성은 하지 않는다.
- **Verification:** 실제 PostgreSQL 17의 signup 성공/rollback, direct privileged service 거부를 먼저 gate로 만든다.

### M7-DATA-009 — OTP 최초 동시 요청은 cooldown 검사 전에 직렬화되지 않음

- **Area / Status / Severity:** Transaction / needs-fix / medium (P0).
- **Current:** 이전 challenge read/lock → cooldown 검사 → rate counter upsert 순서다.
- **Expected Architecture:** Domain AUTH-002와 M5 OTP plan의 60초 cooldown/재발급 무효화가 동시 요청에도 성립.
- **Evidence:** `email-verification-service.ts:61~80`, `email-verification-repository.ts:10,98`.
  두 최초 요청은 모두 이전 challenge 없음으로 통과 가능하다. 뒤의 counter upsert에서 대기하더라도
  이미 끝난 cooldown 검사는 재실행하지 않는다. 두 요청 모두 메일 발송으로 이어질 수 있다.
- **Risk:** 같은 email에 cooldown 내 중복 발송, 먼저 발송한 코드가 곧 무효화되는 UX.
  코드 순서로 확인한 race이며 실제 DB 동시 재현은 미실행이다.
- **Required Change:** 같은 email의 직렬화 지점을 cooldown read보다 앞에 둔다.
  기존 rate-limit row 활용 가능성과 경계 시간의 key 변경을 함께 검토하고, lock framework는 추가하지 않는다.
- **Verification:** 동일 email의 최초/재발급 동시 요청에서 성공 발송 1회, 나머지 cooldown,
  email/IP rate-limit과 transaction rollback을 실제 PostgreSQL에서 확인한다.

## Already Correct

- Auth.js Credentials/JWT는 최소 account id를 session에 두고 RequestContext가 DB ACTIVE/role을 재확인한다.
- Album/Song privileged DB mutation은 Service의 requireUser + CASL 뒤에서만 repository로 간다.
- Repository/DbExecutor/Service transaction ownership을 재설계할 필요가 없다.
- public Album/Song mapper와 shared Zod contract가 있고 bigint account id는 string으로 전달된다.
  `$inferSelect/$inferInsert`는 server persistence 안에만 있다. Song mutation의 `{ id }` returning은
  HTTP schema로 검증되는 최소 projection이므로 그 자체를 full row leakage로 분류하지 않는다.
- 일부 admin Song/sitemap mapper는 spread와 inferred return type을 사용한다. 현재 credential/full row의
  Client 유출 evidence는 없으며, 명시적 DTO return annotation/allowlist는 후속 개선 후보다.
- application Route Handler는 jsonResponse로 output 검증, toErrorResponse로 오류를 통일한다.
  output Zod failure는 Error로 감싸 400과 분리한다. DELETE 204는 JSON validation 대상이 아니다.
- Ky JSON은 unknown → response parser, transport retry 0, query signal 전달을 사용한다.
- `src` 검색에서 use cache/unstable_cache/cacheTag/updateTag/revalidateTag/revalidatePath와
  window.location.reload/location.reload/router.refresh는 발견되지 않았다. Next Data Cache 이중 ownership evidence 없음.
- Public DB-backed 주요 page는 dynamic RSC Service read, Admin 목록은 Service seed → setQueryData →
  가까운 HydrationBoundary. 서버 QueryClient는 React.cache 요청 단위이며 DB singleton과 다르다.
- 기본 Query retry/global mutation UX/local form escape hatch가 구현됐다. editor 초기 song props와
  local draft는 독립적인 편집 상태이며, 저장 후 기존 목록 Query invalidation 누락만 별도로 수정한다.

### 모든 Route Handler 계약 inventory

| Route / method | Path·query·body input | Output / status | Error |
| --- | --- | --- | --- |
| `/api/albums/[slug]`, `/api/songs/[slug]` GET | slug Zod; query/body 소비 없음 | detail DTO / 200 | 공통 mapper |
| `/api/admin/albums` GET / POST | GET 입력 없음; POST JSON+save schema | array / 200; summary / 201 | 공통 mapper |
| `/api/admin/albums/[id]` PATCH / DELETE | id Zod; PATCH JSON+save schema | summary / 200; empty / 204 | 공통 mapper |
| `/api/admin/songs` GET / POST | GET 입력 없음; POST JSON+create schema | array / 200; id / 201 | 공통 mapper |
| `/api/admin/songs/[id]` PATCH / DELETE | id Zod; PATCH JSON+update schema | id / 200; empty / 204 | 공통 mapper |
| `/api/admin/songs/[id]/lyrics` PATCH | id Zod; JSON+lyrics schema | id / 200 | 공통 mapper |
| `/api/auth/ability` GET | 입력 없음; context 획득 | serialized rules / 200 | 공통 mapper |
| `/api/auth/signup/otp` POST | JSON email schema; forwarded IP는 문자열 추출 | challengeId / 201 | 공통 mapper |
| `/api/auth/signup/otp/verify` POST | JSON UUID·6자리 OTP schema | challengeId + verified / 200 | 공통 mapper |
| `/api/auth/signup/complete` POST | JSON UUID·password·nickname schema | string accountId / 201 | 공통 mapper |
| `/api/auth/[...nextauth]` GET / POST | Auth.js 관리 경로 | Auth.js protocol | application DTO와 별도 |

13 route files, application 15 operations + Auth.js 2 exports다. 현재 query parameter를 소비하는
application endpoint는 없다. error 정의는 input 400, auth 401/403, not-found 404, conflict 409,
rate-limit 429, unknown/output failure 500이다. 정의 존재와 실제 DB conflict mapping 성공은 DATA-003처럼 구분한다.
공개 details는 validation fieldErrors뿐이며 raw DB 오류를 HTTP body에 넣지 않는다.

## Migration Debt / Testing coverage

| 분류 | 현재 파일 evidence | Missing coverage / 우선순위 |
| --- | --- | --- |
| Unit | src의 `*.test.ts(x)` 33개: server 11, route 10, entities 3, features 2, shared 7 | 파일 inventory이며 pass/coverage %가 아님 |
| Auth service | authentication 3 cases, signup 2 cases, OTP request 2 cases; DB/일부 hash mock | 실제 verifyOtp 성공·만료·attempts·replay, signup DB rollback / P0 |
| Authorization | ability/request-context tests, route의 mock 401/403 | Album/Song 모든 privileged service에 guest/USER/REVIEWER 및 정지 계정 경로, image service 거부 / P0 |
| Repository integration | visibility predicate mock 1 file; 실제 PG suite 없음 | SQL constraints/FK cascade/order/slug read, transaction rollback / P0 |
| Route Handler | 10 files; path/body/error mapping + api-response unit | ability route, 실제 conflict→409, OTP IP validation / P1 |
| Critical public read | Song mapper/visibility/Album·Song route와 client parser tests | 실제 PG parent visibility·legacy JSONB round-trip / P0 |
| Critical admin mutation | mocked service/HTTP success tests | create/update/delete/lyrics까지 실제 DB 검증 / P0 |
| Component / hook | RTL renderHook: lyrics editor, admin editor, in-app browser | form submission/field error·cache invalidation consumer tests / P1 |
| Browser E2E | Playwright dependency와 과거 수동 smoke 기록; 현재 config/spec suite 없음 | public read, admin mutation, upload authorization / P2 |
| Load | `tests/k6/{load,stress,spike}.js` 존재 | 실제 실행 결과 unknown; package scripts는 staging URL 대상이므로 이번 실행 안 함 |
| Coverage config | Vitest include는 src tests; coverage는 옛 shared/hooks/utils와 feature hook 위주 | server/API/contracts를 포함한 유의미한 report scope 재검토 / P2 |

## Unknown

- Actual local DB의 table/column/default/constraint/index, migration 적용 journal, 승인된 dump의 데이터 상태.
  Docker Compose 조회가 실패해 catalog evidence를 얻지 못했다. 운영 DB credential은 사용하지 않았다.
- 운영 schema·Song slug 중복/unique·timestamp precision·Song_albumId_idx·RLS/policy 및 기존 DB baseline reconcile.
- 검증 완료 challenge의 유효기간과 재발급 후 기존 VERIFIED challenge 처리. 현재 consume은 expiry를 검사하지
  않고 resend는 PENDING만 무효화한다. OTP 입력 TTL과 signup 완료 proof TTL을 임의로 동일시하지 않는다.
- OTP route가 신뢰하는 x-forwarded-for/x-real-ip의 proxy overwrite 정책. IP 문법을 검증하지 않아
  비정상 값은 inet DB 오류가 될 수 있다. trusted proxy와 malformed IP 정책을 함께 확정해야 한다.
- challenge/rate-limit의 email/IP 보존·cleanup 기간; 현재 삭제 작업 없음. future domain table 추가와 별개 운영 결정.
- 실제 Sentry 수신·scrubbing·runtime env·로그 보존 정책과 production incident 발생 여부.

### Runtime / Deployment 별도 checkpoint

| 대상 | 실제 파일 상태 | 판정 |
| --- | --- | --- |
| Next standalone | package scripts next dev/build, start standalone; next.config output standalone | repo 설정 already-correct; artifact 실행 unknown |
| Cloudflare runtime | src/package/config에서 Vinext/Workers/Hyperdrive binding 미발견; wrangler/worker runtime 파일 미발견 | 기존 runtime 결합 제거 evidence 있음 |
| Storage | AWS S3 SDK → R2; canonical assets URL | 의도된 R2 유지. Cloudflare 완전 제거로 표시하지 않음 |
| Image | next.config images.unoptimized=true | 현 경로 확정; 목표 optimization 성능 검증 partial |
| Docker/Caddy | Dockerfile.dev + compose.dev.yml만 존재. production Dockerfile/Compose/Caddyfile 없음 | 배포 구현 partial |
| CI/CD | `.github/workflows/verify.yml`: pnpm verify + format:check | build/PG integration/E2E/GHCR deploy gate 없음; 실제 운영 topology unknown |
| UI runtime debt | radix-ui dependency 유지 | Base UI 전환 상태는 별도 UI foundation 결정; 이번 data PR에 혼합하지 않음 |

`drizzle/relations.ts`는 삭제된 `./schema`를 가리키는 빈 import artifact다. runtime/tooling consumer는
확인되지 않으며 tsconfig include 밖이다. unused 분석만으로 삭제하지 않고 별도 소규모 정리 후보로 남긴다.

## Proposed Changes — 코드 수정 전 중간 보고

1. **이미 일치:** 단일 schema ownership, executor와 transaction 소유권, DB privileged service 권한,
   HTTP parser/error boundary, Query 단일 cache, reload 제거. 재구현하지 않는다.
2. **반드시 수정:** DATA-001/002/004/009를 P0로, DATA-003/006/007을 P1로 진행한다.
   DATA-008의 필요한 회귀 테스트를 각 수정과 함께 추가한다. 민감 로그 경로는 P2 observability보다 앞당긴다.
3. **개선 후보:** 명시적 admin DTO mapper, 잔여 relations artifact, coverage include/structured logging 운영성.
4. **미결:** Song slug 제품 정책/Actual DB/verified proof TTL/proxy/PII retention/최종 배포.
5. **비범위:** 아래 future domain. 현재 table이 없다는 이유로 migration failure로 분류하지 않는다.

| 독립 checkpoint | 예상 수정 파일 | 예상 검증 |
| --- | --- | --- |
| Signup state 정합성 | email-verification-repository.ts, signup-service.test.ts, 새 repository integration test; 시각 보존 결정을 바꾸면 schema.ts + 새 SQL/meta + M5 상태 문서 | 실제 PG 성공·재소비·rollback |
| Upload security | 기존 upload Action/R2 helper/consumer, app의 전달 adapter, 새 server/services/album-image-service.ts 및 server/storage helper와 tests | direct service/Action 권한·파일 검증, build |
| Safe error boundary | api-response.ts, shared/lib/sentry.ts, instrumentation.ts, server logger helper/config와 tests | SQL/PII redaction + unexpected/output capture |
| OTP concurrency | email-verification-service.ts, repository, integration test | 같은 email 병렬 요청/cooldown/rollback |
| Conflict mapping | album-service.ts, signup-service.ts, 작은 server error helper와 tests | wrapper cause + 실제 23505 → 409 |
| Invalidation | AdminLyricsEditor.tsx, AdminAlbumManager.tsx, AlbumManagerClient.tsx의 callback 및 consumer tests | lyrics/rename/cascade 후 관련 Query 상태 |
| List DTO | shared/contracts/album.ts·song.ts, 두 GET route, entity adapters, Admin seed/consumer와 tests | HTTP/hydration/cache 같은 DTO shape |

구현은 concern별 PR로 분리한다. 20 files/400 lines 목표를 넘는 경우 계약/전환의 결합 이유와 리뷰 순서를
PR에 적는다. 분석 단계에서는 위 최소안을 확정 구현으로 표시하거나 production migration을 적용하지 않는다.

## Verification

- 수행: `git status`, `git show`, `git log`, `git diff`, `git fetch origin migration_develop`, `gh pr status`,
  `rg` source scans, schema/SQL/journal/snapshot와 test/config 정적 대조.
- Node synthetic DrizzleQueryError 진단: outer constraint match=false, cause SQLSTATE/constraint 보존,
  outer message의 synthetic parameter 포함=true. DB에 연결하지 않았다.
- Python inventory: 33 Vitest files와 snapshot 7 tables/52 columns 확인. 테스트 실행 결과가 아니다.
- `docker compose -f compose.dev.yml ps --format json`: 실패. WSL Docker 사용 불가로 실제 DB 검증 미실행.
- 문서 checkpoint이므로 별도 lint/typecheck/test/build를 계획·실행하지 않는다.
  commit/push hook이 실행하는 검증은 실행 후 PR에 실제 명령·결과를 별도로 기록한다.
- 후속 코드 수정의 기본 gate: `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`, `pnpm format:check`; runtime/storage boundary 변경 시 `pnpm build` 추가.
  PG/E2E는 승인된 로컬 데이터와 격리된 테스트 환경에서 실행하고 production credential을 쓰지 않는다.

판정에 사용한 공식 근거: PostgreSQL [CHECK constraints](https://www.postgresql.org/docs/17/ddl-constraints.html)
및 [SQLSTATE](https://www.postgresql.org/docs/17/errcodes-appendix.html),
Next.js [Server Action authorization](https://nextjs.org/docs/app/guides/data-security).
라이브러리 오류 wrapper는 설치된 drizzle-orm 0.45.1 소스를 직접 확인했다.

## Out of Scope

`CheerGuide`, `Revision`, `Contribution`, `Discussion`, `Comment`, `Cue`, `PerformanceSchedule`,
Contributor profile, FAN/FESTIVAL guide, waveform, Melon 연동의 신규 schema/feature는 future-domain이다.
기존 cheer-guide 이름의 가사 parser/contract consumer는 보존한다. DI/Generic Repository/CRUD framework,
event bus, custom ORM, Next cache abstraction을 추가하지 않는다.
