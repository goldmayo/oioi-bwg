# M7-DATA-002

## Status

VERIFIED

## PLAN

### Finding

M7-DATA-002 — Album image upload authorization bypass

현재 앨범 관리 폼은 `src/features/manage-album/api/upload-album-image-action.ts`의 Server Action을
직접 호출한다. 이 Action은 파일 존재 여부, 5 MiB 제한, MIME을 검사한 뒤
`src/shared/api/r2/upload-public-asset.ts`를 호출하지만 `RequestContext`, `requireUser()`, CASL 권한
검사가 없다. Admin layout과 숨겨진 UI는 직접 호출 가능한 Server Action의 최종 보안 경계가 아니다.

### Selected Model / Effort

- Registry recommendation: PLAN `Sol High`, IMPLEMENT `Terra`, REVIEW `Sol High`.
- 이 PLAN 실행의 실제 runtime model/effort는 노출된 증거가 없어 추정하거나 별도 모델을 사용했다고
  주장하지 않는다. 구현·리뷰 시에도 실제 선택값만 보고한다.

### Confirmed Cause

- 분석 registry와 현재 코드가 같은 우회 경로를 보여 준다:
  `AlbumFormDialog -> uploadAlbumImageAction -> uploadPublicAsset -> R2 PutObject`.
- `uploadAlbumImageAction()`은 파일을 검사하고 storage를 호출하지만 현재 요청 context를 얻지 않는다.
- `uploadPublicAsset()`은 `server-only` marker는 가지지만 application authorization을 알지 못하며, R2
  credential/client와 PutObject를 `shared/api`에 소유한다.
- 기존 PostgreSQL 검증은 Album/Song의 DB privileged Service 10개에 대해 guest/USER/REVIEWER 거부를
  확인했지만, 이미지 업로드 Service 자체가 없어 실제 R2/업로드 권한은 검증 범위 밖이었다.
- 역할 정책은 이미 정해져 있다. Domain Specification과 DB schema의 role은
  `USER | REVIEWER | ADMIN`뿐이고 `ROOT`는 존재하지 않는다. 현재 `buildAbilityRules()`는 ADMIN에게만
  `manage/all`을 부여한다. finding registry 역시 guest/USER/REVIEWER 거부와 ADMIN 성공을 요구한다.
- 근본 원인은 업로드 use case의 authorization과 application validation이 Service에 없고, delivery
  Action이 storage infrastructure를 직접 호출하도록 책임이 결합된 것이다.

### Invariant to Preserve

```text
Server Action
  -> RequestContext
  -> album image Service
     -> requireUser
     -> ability manage/all
     -> file validation
     -> server/storage
     -> R2 PutObject
```

- 업로드 허용 범위는 기존 정책대로 `ADMIN`만이다. Guest는 `UNAUTHENTICATED`, USER와 REVIEWER는
  `FORBIDDEN`이며 세 경우 모두 storage 호출은 0회여야 한다.
- 새 `ROOT` role, 별도 root flag, allowlist, 복수 role 또는 업로드 전용 정책 저장소를 만들지 않는다.
- Service는 역할 문자열을 직접 비교하지 않고 `requireUser(ctx)` 다음
  `ctx.ability.cannot("manage", "all")`로 현재 CASL 정책을 사용한다.
- authorization은 파일 유효성 검사와 byte materialization보다 먼저 수행한다. 권한 없는 요청이 파일
  내용이나 오류 차이를 이용해 storage 경계에 접근해서는 안 된다.
- 기존 허용 MIME(`image/avif`, `image/jpeg`, `image/png`, `image/webp`), 최대 크기 5 MiB, UUID 기반
  `images/albums/*` object key, 1년 immutable cache header, `assets.oioibawige.com` canonical URL을
  유지한다.
- 현재 Action의 `{ success, url? } | { success: false, error }` consumer 계약과 안전한 실패 메시지를
  유지한다. 브라우저에는 R2 credential이나 raw storage 오류를 노출하지 않는다.
- R2 provider를 유지하고 container filesystem, Supabase Storage, OCI Object Storage로 전환하지 않는다.

### Options

1. **ADMIN + 기존 `manage/all`, Service 최종 검사 — 채택.** 이미 정해진 domain/schema/CASL/registry
   정책과 Album/Song 관리자 use case가 쓰는 경계를 그대로 재사용한다. 정책 변경 없이 우회만 막는다.
2. **ROOT 전용 role을 새로 도입 — 기각.** 현재 제품 role에 ROOT가 없으므로 Domain Specification,
   authorization architecture, DB CHECK/schema/migration, ability와 관리 UX까지 바꾸는 별도 정책
   변경이다. 사용자가 “이미 정한 것이 있다면 그대로 수행”을 요청했고 기존 결정은 ADMIN 허용이다.
3. **REVIEWER와 ADMIN에 허용 — 기각.** registry의 REVIEWER 거부 계약과 REVIEWER의 검수자 역할을
   약화하며, 운영 asset 변경 권한을 불필요하게 넓힌다.
4. **Action에서만 권한 검사 — 기각.** UI/Handler/Action 검사는 Service 최종 security boundary를
   대체할 수 없다.
5. **이번에 Route Handler/ky transport로 전환 — 보류.** 업로드는 client Query cache lifecycle과
   무관한 제한적 Server Action으로 유지할 수 있으며, 전체 CRUD transport 재구성은 finding 범위가 아니다.

### Recommended Minimal Change

1. route-private Server Action을
   `src/app/(admin)/admin/albums/_actions/upload-album-image-action.ts`에 둔다. Action은
   `getRequestContext()`를 얻고 FormData의 `file` entry를 추출해 Service로 전달하는 delivery adapter만
   맡는다. 입력 validation, object key 생성, byte 변환, storage 호출을 Action에 남기지 않는다.
2. `src/server/services/album-image-service.ts`를 추가한다. Service는 context와 raw file entry를 받아
   다음 순서를 고정한다.
   - `requireUser(ctx)`
   - `ctx.ability.cannot("manage", "all")`이면 `AppError("FORBIDDEN")`
   - 파일 존재/`File` 타입, 5 MiB 이하, 허용 MIME validation
   - MIME별 확장자와 `crypto.randomUUID()`로 object key 구성
   - validation이 끝난 파일만 `Uint8Array`로 변환해 storage helper 호출
   - canonical URL 반환
3. 파일 validation은 Service-private Zod schema 또는 동등한 작은 typed validation으로 표현한다. Action은
   그 안전한 고정 메시지만 기존 result shape로 변환한다. 인증/인가 실패와 unknown storage 실패는
   credential·cause를 노출하지 않는 일반 업로드 실패로 반환하고 기존 safe logger 경계를 유지한다.
   새로운 API-wide Result, 공개 HTTP envelope, generic validation/error framework는 만들지 않는다.
4. R2 구현을 `src/shared/api/r2/upload-public-asset.ts`에서
   `src/server/storage/upload-public-asset.ts`로 이동한다. credential 해석, S3 client 생성, PutObject와
   canonical URL 생성만 담당하고 authorization이나 UI 메시지는 알지 않는다. 기존 storage 단위 테스트도
   같은 server boundary로 이동한다.
5. feature Client Component가 `src/server`나 route-private Action을 import하지 않도록 업로드 callback을
   app route-private 조합 경계에서 주입한다. `AdminAlbumManager -> AlbumManagerClient -> AlbumFormDialog`
   prop으로 기존 Action result shape를 전달하고, 기존 feature Action 파일은 제거한다.
6. schema, migration, Account role, `buildAbilityRules()`, Album/Song CRUD transport, storage provider는
   변경하지 않는다.

### Files Expected to Change

Expected:

- `src/app/(admin)/admin/albums/_actions/upload-album-image-action.ts` — 새 route-private delivery adapter.
- `src/app/(admin)/admin/albums/_actions/upload-album-image-action.test.ts` — Action 직접 호출/위임/안전한
  result 검증.
- `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.tsx` — upload callback 조합.
- `src/features/manage-album/ui/AlbumManagerClient.tsx` — upload callback 전달.
- `src/features/manage-album/ui/AlbumFormDialog.tsx` — 내부 Action import 제거 및 주입된 callback 사용.
- `src/server/services/album-image-service.ts` — ADMIN authorization, file validation, upload orchestration.
- `src/server/services/album-image-service.test.ts` — 권한/validation/storage 호출 회귀 테스트.
- `src/server/storage/upload-public-asset.ts` — 기존 R2 infrastructure 이동.
- `src/server/storage/upload-public-asset.test.ts` — 기존 storage 테스트 이동 및 경로 갱신.
- `src/features/manage-album/api/upload-album-image-action.ts` — 새 app adapter로 대체 후 제거.
- `src/shared/api/r2/upload-public-asset.ts`와
  `src/shared/api/r2/upload-public-asset.test.ts` — server/storage 이동 후 제거.

구현 중 파일명은 repository naming과 test import가 요구하는 범위에서만 조정할 수 있다. 위 범위를 넘는
새 production 파일이 필요하면 먼저 escalation한다.

Explicitly excluded:

- `src/server/db/schema.ts`, `drizzle/**`, DB migration과 production/local DB data.
- `src/server/auth/ability.ts`, `src/shared/contracts/authorization.ts`,
  `docs/migration/DOMAIN_SPECIFICATION.md`, active architecture 문서.
- Album/Song CRUD Route Handler, TanStack Query/ky contract, cache invalidation.
- R2 bucket policy/IAM 변경, 실제 R2 object write/delete, provider migration.
- 이미지 magic-byte 검사, 리사이징/재인코딩, orphan object cleanup, rate limit, audit log는 별도 요구가
  없으므로 이번 보안 우회 수정에 추가하지 않는다.

### Tests Required

Focused automated tests:

- 실제 `buildAbility()`로 guest, USER, REVIEWER, ADMIN context를 구성한다. guest는
  `UNAUTHENTICATED`, USER/REVIEWER는 `FORBIDDEN`, ADMIN은 성공해야 한다.
- 권한 없는 세 role 각각에 invalid/valid file을 주어도 storage mock이 0회인지 확인하고, 최소 한
  case에서는 invalid file보다 authorization 오류가 먼저 발생함을 확인한다.
- ADMIN에 대해 file 없음/문자열 entry/5 MiB 초과/각 unsupported MIME을 거부하고 storage 0회를
  확인한다.
- 허용 MIME 4종의 extension mapping, UUID object key prefix, content type, byte body, canonical URL과
  storage 1회 호출을 확인한다. 5 MiB 정확히는 허용하고 초과만 거부하여 기존 경계를 고정한다.
- route-private Action을 export 함수로 직접 호출해 `getRequestContext()`와 Service로 위임되는지,
  기존 success/validation/unknown failure result가 유지되는지 확인한다. raw AppError/storage error나
  credential이 result/log payload에 포함되지 않아야 한다.
- 이동한 storage 테스트에서 R2 env, Bucket/Key/Body/ContentType/CacheControl과 trailing slash 제거 URL
  동작을 유지한다. 외부 R2 network는 mock한다.
- callback prop 전환으로 form의 성공 URL 반영과 실패 message 동작이 바뀌지 않았는지는 기존 component
  coverage가 없으면 최소한 type-check/build로 확인하고, 작은 prop test가 필요할 때만 추가한다.

Required repository gates after implementation:

```bash
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
```

문서 PLAN 단계에서는 위 명령을 실행하지 않는다. 구현 단계는 실제 실행한 명령과 결과만 기록한다.

### Actual PostgreSQL Verification

- 이 finding은 schema, repository, SQL, transaction을 변경하지 않으므로 새 PostgreSQL 검증은
  **해당 없음**이다. DATA-002만을 위해 DB를 시작하거나 migration을 적용하지 않는다.
- 기존 2026-09-05 PostgreSQL 기록은 Album/Song의 다른 privileged Service에 대한 실제 CASL 거부를
  확인했지만 이미지 업로드와 실제 R2는 범위 밖이었다. 이를 업로드 검증 완료 증거로 과장하지 않는다.
- 실제 R2 write는 필수 자동 테스트가 아니다. storage client는 mock하고 Service 최종 권한 및
  storage call count를 검증한다. production credential은 사용하지 않는다.

### Risks / Unknowns

- Server Action의 transport-level 호출을 브라우저에서 끝까지 검증하는 현재 Playwright suite가 없다.
  route-private Action 직접 호출 test와 Next build로 경계를 검증하되 실제 browser protocol은 residual gap으로
  기록한다.
- MIME은 client가 제공한 `File.type` 기준이라는 기존 계약이다. 파일 signature 검증이 제품/보안 요구라면
  별도 정책과 dependency/성능 검토가 필요하며 이번 변경에서 임의로 추가하지 않는다.
- 업로드 성공 후 앨범 저장이 실패하면 orphan R2 object가 남을 수 있다. 현재 finding은 authorization
  bypass이며 cleanup/transactional storage 설계는 별도 concern이다.
- ADMIN 업로드 audit/rate limit 요구는 현재 registry와 Domain Specification에 없다. 발견 시 별도 정책
  결정으로 올리고 구현 범위를 자동 확장하지 않는다.
- Action을 app 경계로 옮기는 동안 callback wiring이 누락되면 UI upload가 깨질 수 있으므로 type-check,
  focused Action test와 build를 필수로 한다.

Escalation conditions:

- ADMIN보다 좁은 root-only 운영자를 실제 제품 role로 추가해야 한다는 새 요구가 확정되는 경우. 이때는
  DATA-002 구현을 멈추고 Domain Specification/authorization/schema migration을 별도 계획한다.
- REVIEWER 업로드 허용, album별 scoped permission, 복수 role/allowlist가 필요하다는 근거가 발견되는 경우.
- 새 공개 AppError/API contract, Route Handler 전환, bucket policy 변경 또는 실제 R2 destructive 검증이
  필요해지는 경우.
- 현재 허용 MIME/5 MiB/canonical URL 또는 provider 정책을 바꿔야 하는 충돌 증거가 발견되는 경우.

### Implementation Prompt

`M7-DATA-002`만 구현한다. canonical plan의 invariant대로 앨범 이미지 업로드 권한은 기존
`USER | REVIEWER | ADMIN` 정책 중 ADMIN에게만 허용한다. ROOT role은 만들지 않는다. route-private Server
Action은 `getRequestContext()`와 FormData extraction/result mapping만 담당하고, 새
`src/server/services/album-image-service.ts`가 `requireUser -> ability manage/all -> file validation ->
server/storage` 순서를 강제하도록 한다. R2 credential/client/PutObject helper와 기존 테스트는
`src/server/storage`로 이동한다. feature는 app/server를 import하지 않도록 Action callback을
`AdminAlbumManager -> AlbumManagerClient -> AlbumFormDialog`로 주입하고 기존 feature Action은 제거한다.

허용 범위는 위 `Files Expected to Change`의 production/test 파일뿐이다. role/schema/migration/ability rule,
CRUD transport, public HTTP error contract, R2 provider/bucket, architecture/domain 문서는 변경하지 않는다.
guest/USER/REVIEWER storage 0회, ADMIN 성공, authorization 우선순위, invalid file/MIME/size 거부, 기존 R2
payload/URL, Action 직접 호출을 focused test로 검증하고 repository gate 7개와 build를 실행한다. PostgreSQL과
실제 R2/production credential은 사용하지 않는다. root-only나 REVIEWER 허용, 새 contract/provider 변경,
scope 밖 파일이 필요하면 구현을 중단하고 근거와 필요한 결정을 `ESCALATION`으로 보고한다.

## IMPLEMENTATION

### Changed Files

- 추가: `src/app/(admin)/admin/albums/_lib/upload-album-image-action.ts`
- 추가: `src/app/(admin)/admin/albums/_lib/upload-album-image-action.test.ts`
- 수정: `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.tsx`
- 삭제: `src/features/manage-album/api/upload-album-image-action.ts`
- 수정: `src/features/manage-album/ui/AlbumManagerClient.tsx`
- 수정: `src/features/manage-album/ui/AlbumFormDialog.tsx`
- 추가: `src/server/services/album-image-service.ts`
- 추가: `src/server/services/album-image-service.test.ts`
- 이동: `src/shared/api/r2/upload-public-asset.ts` →
  `src/server/storage/upload-public-asset.ts`
- 이동·보강: `src/shared/api/r2/upload-public-asset.test.ts` →
  `src/server/storage/upload-public-asset.test.ts`
- 갱신: `docs/migration/m7-foundation-fixes/DATA-002.md`

### Implemented Decision

- 업로드 권한은 기존 정책대로 ADMIN의 CASL `manage/all`만 허용했다. 새 ROOT role이나 직접 role 비교를
  추가하지 않았다.
- 새 `uploadAlbumImage()` Service가 `requireUser()` → `ability.cannot("manage", "all")` → 파일
  validation → byte 변환 → storage 호출 순서를 소유한다.
- 파일 없음/비-File entry, 5 MiB 초과, AVIF/JPEG/PNG/WebP 외 MIME은 Service-private Zod validation으로
  거부한다. UUID object key, MIME별 확장자, canonical URL 계약은 유지했다.
- route-private Server Action은 `getRequestContext()`, FormData entry 추출, Service 호출, 기존
  `{ success, url? | error }` 결과 매핑만 담당한다. Zod 메시지만 안전한 validation 실패로 반환하고,
  authorization/storage 오류는 고정된 일반 메시지와 원본 cause를 포함하지 않는 safe error로 처리한다.
- Client feature가 `src/server`나 app-private 파일을 import하지 않도록 app 조합 경계가 Action callback을
  `AdminAlbumManager → AlbumManagerClient → AlbumFormDialog`로 전달한다.
- R2 credential/client/PutObject 구현은 `shared/api`에서 `server/storage`로 이동했다. provider, bucket,
  cache header와 URL 생성 동작은 바꾸지 않았다.

### Plan Deviations

- 계획의 route-private `_actions` 폴더는 실제 repository architecture rule이 허용하는 private segment
  (`_ui/_model/_lib/_config`)가 아니어서 첫 lint에서 거부됐다. 계획이 허용한 naming 조정 범위 안에서
  Action과 테스트를 `_lib`에 배치했다. delivery/Service/storage 책임과 허용 파일 범위의 의미상 변경은
  없다.
- 그 외 정책·contract·schema·provider·검증 범위 deviation은 없다.

### Tests Added or Changed

- `album-image-service.test.ts`: 실제 `buildAbility()`와 `requireUser()`로 guest/USER/REVIEWER가 invalid와
  valid file 모두 storage 호출 0회로 거부되는지, ADMIN만 성공하는지 검증한다.
- 같은 Service test에서 file 없음/문자열 entry/5 MiB 초과/unsupported MIME 거부, 5 MiB 정확한 경계,
  허용 MIME 4종의 확장자, UUID key, byte body와 content type을 검증한다.
- `upload-album-image-action.test.ts`: exported Action 직접 호출, RequestContext/File 위임, validation
  message, authorization/storage 원본 오류 비노출을 검증한다.
- 이동한 `upload-public-asset.test.ts`: R2 endpoint/region/credential config와
  Bucket/Key/Body/ContentType/CacheControl, trailing slash가 제거된 canonical URL을 검증한다.

### Selected Model / Effort

- Registry IMPLEMENT recommendation은 `Terra`다.
- 실제 runtime model/effort 선택값은 노출되지 않아 추정하지 않았으며 별도 model override를 사용하지
  않았다.

## VERIFICATION

### Commands Run and Actual Results

1. 최초 focused test:

   ```bash
   pnpm exec vitest run src/server/services/album-image-service.test.ts \
     src/server/storage/upload-public-asset.test.ts \
     'src/app/(admin)/admin/albums/_actions/upload-album-image-action.test.ts' \
     --reporter=verbose
   ```

   결과: 3 files, 17 tests 통과.

2. 최초 static gate:

   ```bash
   pnpm type-check
   pnpm lint
   pnpm lint:fsd
   pnpm format:check
   ```

   결과: type-check와 lint:fsd 통과. lint는 허용되지 않는 `_actions` segment 2건과 import order 1건으로
   실패했다. format:check는 Service test formatting 1건으로 실패했다.

3. 실패 수정:

   ```bash
   pnpm exec prettier --write src/server/services/album-image-service.test.ts
   ```

   `_actions`를 `_lib`로 옮기고 import order를 수정한 뒤 formatting command가 완료됐다.

4. 최종 focused/static gate:

   ```bash
   pnpm exec vitest run src/server/services/album-image-service.test.ts \
     src/server/storage/upload-public-asset.test.ts \
     'src/app/(admin)/admin/albums/_lib/upload-album-image-action.test.ts' \
     --reporter=verbose
   pnpm type-check
   pnpm lint
   pnpm lint:fsd
   pnpm format:check
   ```

   결과: focused 3 files/18 tests, type-check, lint, lint:fsd, format:check 모두 통과.

5. 전체 runtime/repository gate:

   ```bash
   pnpm test:harness
   pnpm test:unit:run
   pnpm build
   ```

   결과: harness 7 tests, Vitest 41 files/154 tests 통과. Next.js 16.3.3 production build와 23개 static
   page generation이 성공했고 `/admin/albums` route가 정상 compile됐다.

### PostgreSQL / External Storage Evidence

- DATA-002는 schema/repository/transaction을 변경하지 않으므로 PostgreSQL 검증은 해당 없음이다. local
  application DB와 production DB를 사용하거나 변경하지 않았다.
- 실제 R2 network write는 계획상 필수가 아니며 수행하지 않았다. AWS SDK client를 mock해 storage 호출
  여부와 payload/config를 검증했고 production credential을 사용하지 않았다.

### Failures

- 최초 lint/format 실패는 위 Plan Deviations와 Commands에 기록한 대로 수정했으며 최종 재실행은 모두
  통과했다.
- 미해결된 test, lint, type, FSD, format, build 실패는 없다.

### Remaining Unknowns

- 실제 browser의 Server Action transport-level round trip은 현재 Playwright suite가 없어 검증하지 않았다.
  exported Action 직접 호출과 production build까지만 확인했다.
- MIME validation은 기존대로 `File.type`을 신뢰하며 magic-byte 검사는 범위 밖이다.
- 앨범 저장 실패 후 orphan R2 object cleanup, upload audit/rate limit은 별도 concern으로 남는다.

### Diff Review Packet

```text
finding: DATA-002 — Album image upload authorization bypass
plan 핵심: ADMIN manage/all만 허용하고 Service에서 authn/authz → file validation → storage 순서를 강제
changed files: code/test 10개 diff + canonical evidence 1개
git diff summary: route-private Action 추가, feature callback 주입, upload Service 추가, R2 helper server 이동
test results: focused 18, harness 7, full unit 154, type/lint/FSD/format/build 최종 통과
known risks: browser Action E2E 없음, File.type 신뢰, orphan cleanup·audit·rate limit 비범위
```

## REVIEW

pending
