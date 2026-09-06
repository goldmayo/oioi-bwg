# M7-DATA-007

## Status

CLOSED

## PLAN

### Finding

- 식별자: `M7-DATA-007 — Admin list DTO`
- 영역 / 상태 / 심각도: HTTP contract / needs-fix / low (P1)
- 현재 `/api/admin/albums`, `/api/admin/songs`의 GET 응답과 browser parser, RSC hydration seed,
  Query cache가 도메인 summary의 bare array를 사용한다.
- 목표는 성공 응답에 generic `{ success, data }` envelope를 도입하지 않으면서, 관리자 Album/Song
  목록마다 명시적인 domain-specific list DTO를 사용하는 것이다.

### Selected Model / Effort

- Registry 권고: PLAN `Sol Medium`, IMPLEMENT `Terra`, REVIEW `Sol Medium`.
- 실제 실행 모델과 reasoning effort는 현재 런타임 메타데이터에서 확인할 수 없으므로 특정 모델을
  사용했다고 추정하거나 주장하지 않는다.

### Confirmed Cause

- `src/shared/contracts/album.ts`와 `song.ts`에는 각각 summary item schema만 있고 관리자 목록
  response schema가 없다.
- 두 관리자 GET Route Handler는 각각 `albumSummarySchema.array()`와
  `adminSongSummarySchema.array()`로 Service의 배열을 그대로 직렬화한다.
- 두 Entity browser API도 같은 array schema로 HTTP payload를 parse하므로 현재 server/client끼리는
  일치하지만 active API architecture의 명시적 목록 DTO와 맞지 않는다.
- `listAdminAlbums()`와 `listAdminSongs()`가 배열을 반환하고 관리자 RSC가 그 결과를 동일 query key에
  그대로 seed한다. Client의 `useSuspenseQuery()` consumer도 cache data 자체를 배열로 취급한다.
- 관련 cache orchestration 테스트 fixture도 bare array를 seed/refetch 결과로 사용한다.
- 현재 branch `migration_M7_DATA-007`의 HEAD와 local/origin `migration_develop`은 모두
  `3e5b7393672eaaa5978a61d39f653e389ad40655`로 같고, 계획 시점 작업 트리는 깨끗하다.

### Invariant to Preserve

- 성공 응답은 domain DTO 자체이며 generic success envelope를 사용하지 않는다.
- Album/Song 목록은 각각의 명시적 contract가 소유한다. 공용 `CommonResponse<T>`나 generic pagination
  abstraction을 만들지 않는다.
- 현재 전체 조회, 정렬, 관리자 authorization, client-side 검색/필터/페이지 나누기 동작을 유지한다.
- 실제 server pagination이나 cursor 입력을 추가하지 않는다. `nextCursor`는 현재 더 가져올 page가 없음을
  나타내는 `null`만 허용한다.
- RSC Service 결과, hydration `setQueryData`, HTTP Route output, client parser, Query cache는 동일한
  domain list DTO shape를 사용한다.
- 기존 query key와 invalidation 범위, mutation 성공/실패 동작, editor draft 보존을 변경하지 않는다.
- Service → Repository와 Client → Query → ky → Route Handler → Service 경계를 유지한다.

### Options

1. 선택: 각 관리자 list Service가 domain-specific `{ items, nextCursor: null }` DTO를 반환한다.
   Route는 같은 schema로 그 결과를 검증하고, RSC는 같은 결과를 그대로 seed하며, browser API와 UI
   consumer를 함께 전환한다. Service 결과와 HTTP/cache DTO가 한 shape로 고정된다.
2. Route Handler와 각 RSC page에서 Service 배열을 별도로 포장한다. Service 변경은 줄지만 같은 변환이
   delivery 경계마다 중복되고 hydration과 HTTP refetch drift 가능성이 남으므로 선택하지 않는다.
3. generic cursor-page schema factory를 도입한다. 두 도메인밖에 없는 현재 범위에서 불필요한 추상화이며
   실제 cursor pagination을 지원한다는 잘못된 의미를 만들 수 있어 선택하지 않는다.
4. 실제 server pagination을 추가한다. repository query, request query contract, 정렬/cursor 정책까지
   확대되며 finding의 명시적 제외 조건과 충돌하므로 선택하지 않는다.

### Recommended Minimal Change

- Album contract에 `adminAlbumListSchema`와 여기서 추론한 `AdminAlbumList`를 추가한다. shape는
  `{ items: albumSummarySchema.array(), nextCursor: z.null() }`다.
- Song contract에 `adminSongListSchema`와 여기서 추론한 `AdminSongList`를 추가한다. shape는
  `{ items: adminSongSummarySchema.array(), nextCursor: z.null() }`다.
- `listAdminAlbums()`와 `listAdminSongs()`가 기존 item mapping/order를 그대로 유지하면서
  `{ items, nextCursor: null }`을 반환하도록 바꾼다.
- 두 GET Route Handler의 output validation을 각 domain list schema로 바꾼다.
- 두 browser API의 response parser를 각 domain list schema로 바꾼다.
- 관리자 Album/Song client는 Query data의 `items`만 presentation 검색, 필터, client pagination 및
  form option에 전달한다.
- 관련 route/client API/service/cache orchestration 테스트의 fixture와 assertion을 새 DTO shape로
  원자적으로 전환한다.

### Files Expected to Change

예상 application/contract 파일:

- `src/shared/contracts/album.ts`
- `src/shared/contracts/song.ts`
- `src/server/services/album-service.ts`
- `src/server/services/song-service.ts`
- `src/app/api/admin/albums/route.ts`
- `src/app/api/admin/songs/route.ts`
- `src/entities/album/api/api.ts`
- `src/entities/song/api/api.ts`
- `src/features/manage-album/ui/AlbumManagerClient.tsx`
- `src/features/manage-song/ui/SongManagerClient.tsx`

예상 test 파일:

- `src/server/services/album-service.test.ts`
- `src/server/services/song-service.test.ts`
- `src/app/api/admin/albums/route.test.ts`
- `src/app/api/admin/songs/route.test.ts`
- `src/entities/album/api/api.test.ts`
- `src/entities/song/api/api.test.ts`
- `src/features/manage-album/ui/AlbumManagerClient.test.tsx`
- `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.test.tsx`
- `src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.test.tsx`

필요한 경우 type inference가 드러내는 직접 consumer/test만 위 범위 안에서 추가한다. RSC page는 Service의
반환값을 이미 그대로 같은 query key에 seed하므로 코드 변경 없이 새 DTO shape를 받는다.

### Excluded Files / Scope

- Drizzle schema, repository query, migration SQL 및 migration metadata
- active architecture/constitution 및 Domain Specification
- 공개 Album/Song API와 상세 DTO
- mutation response DTO와 mutation/invalidation 정책
- query key, stale time, QueryClient lifecycle
- 실제 server pagination, cursor request/encoding, 정렬 정책 변경
- generic response/pagination helper 또는 새 abstraction
- production/local application DB와 `.local` 검증 artifact
- DATA-001~006, DATA-008~009 및 무관한 UI/refactor

### Tests Required

- Service unit test: 각 관리자 list가 기존 item mapping/nullable normalization을 보존하면서 정확히
  `{ items: [...], nextCursor: null }`을 반환한다.
- Route contract test: 각 GET의 정상 body가 domain list schema를 통과하고 bare array가 아니며 Service
  DTO와 같다. 기존 auth/error mapping도 유지한다.
- Client API test: 정상 domain list DTO가 parse되고 `AbortSignal`이 전달되며, bare array 또는 깨진 item은
  `ClientContractError`로 거부된다.
- Query/cache consumer test: 새 DTO를 seed한 manager가 `items`를 렌더링하고 Album mutation refetch 뒤
  cache가 같은 DTO shape를 유지한다.
- Cache invalidation regression fixture: Album rename/delete와 lyrics save 관련 admin list seed를 새 DTO로
  바꾸고 기존 affected/unaffected key 및 editor draft assertion이 그대로 통과한다.
- Repository gates: `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`, `pnpm format:check`.
- 이 변경은 serializable contract와 client rendering/query cache shape를 바꾸므로 `pnpm build`도 실행한다.

### Actual PostgreSQL Verification

- `.local/M7-POSTGRES-VERIFICATION.md`를 확인했다. 해당 기록은 실제 PostgreSQL의 schema, constraint,
  transaction, authorization 및 기존 DTO read를 검증하지만 DATA-007의 HTTP/hydration 목록 shape는
  검증 범위 밖이다.
- DATA-007은 DB schema, SQL, repository query, transaction 또는 concurrency를 변경하지 않는다.
  따라서 별도의 actual PostgreSQL 실행은 요구하지 않는다. Service unit, Route output, browser parser,
  hydrated Query cache와 repository gate가 이 finding의 직접 검증이다.
- 구현 중 DB 관련 변경 필요성이 새로 발견되면 계획 범위를 벗어나므로 즉시 `ESCALATE`한다.

### Risks / Unknowns

- HTTP/cache shape는 breaking change이므로 Route, parser, hydration seed, 모든 직접 consumer와 fixture가
  한 변경 단위에서 전환되지 않으면 runtime contract error 또는 UI 오류가 난다.
- `nextCursor: null`은 현재 전체 결과임을 명시할 뿐 future pagination 지원 약속이 아니다.
- 저장소 밖에서 관리자 endpoint의 bare array를 직접 소비하는 비공개 client가 있는지는 확인할 수 없다.
  현재 repository 내 consumer는 전부 함께 전환한다.
- 현재 관련 RSC page 전용 test는 없다. Service가 list DTO를 소유하고 page가 그 반환값을 변환 없이 같은
  query key에 seed하는 구조, consumer cache test와 production build로 이 경계를 검증한다.

### Escalation Conditions

- 현재 source가 계획의 bare-array 가정과 달라졌거나 DATA-007 evidence file에 충돌하는 구현/review 이력이
  생긴 경우
- `{ items, nextCursor: null }` 이외의 product/API policy 선택이 필요한 경우
- 실제 cursor pagination, repository 정렬/query 변경, schema/migration/DB 변경이 필요한 경우
- 외부 consumer 호환을 위한 versioning 또는 병행 응답이 필요하다는 evidence가 발견된 경우
- 다른 finding, architecture/domain 문서 개정, 새 공용 abstraction 없이는 구현할 수 없는 경우

### Implementation Prompt

`M7-DATA-007`만 구현한다. 승인된 invariant와 선택지 1을 따른다. Album/Song shared contract에 각각
domain-specific admin list schema/type을 추가하고 정확한 shape를 `{ items: <summary>[], nextCursor: null }`로
고정한다. 두 관리자 list Service가 기존 authorization, repository 호출, item mapping/order/nullable
normalization을 유지한 채 이 DTO를 반환하게 한다. 각 GET Route는 동일 schema로 output을 검증하고,
browser API는 동일 schema로 unknown response를 parse한다. RSC page가 Service DTO를 변환 없이 기존
admin-list query key에 seed하는 구조를 유지한다. Album/Song manager는 Query data의 `items`를 사용한다.
관련 service, route, client API, manager/cache invalidation 테스트 fixture와 assertion을 새 DTO로 함께
전환한다.

허용 범위는 `Files Expected to Change`에 열거한 파일과 type-check가 드러내는 직접 DATA-007 consumer/test다.
공개 detail/mutation 계약, query key/invalidation 정책, repository/schema/migration, server pagination,
generic response/pagination abstraction, 다른 finding은 변경하지 않는다. targeted test 후
`pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`,
`pnpm format:check`, `pnpm build`를 실행한다. actual PostgreSQL 검증은 DB 경계를 바꾸지 않아 불필요하다.
계획 가정이 stale하거나 DB/repository/pagination/product/architecture 결정 또는 범위 밖 변경이 필요하면
해당 영역을 수정하지 말고 `ESCALATE`한다.

## IMPLEMENTATION

### Changed Files

Contract and implementation:

- `src/shared/contracts/album.ts`
- `src/shared/contracts/song.ts`
- `src/server/services/album-service.ts`
- `src/server/services/song-service.ts`
- `src/app/api/admin/albums/route.ts`
- `src/app/api/admin/songs/route.ts`
- `src/entities/album/api/api.ts`
- `src/entities/song/api/api.ts`
- `src/features/manage-album/ui/AlbumManagerClient.tsx`
- `src/features/manage-song/ui/SongManagerClient.tsx`

Regression coverage:

- `src/server/services/album-service.test.ts`
- `src/server/services/song-service.test.ts`
- `src/app/api/admin/albums/route.test.ts`
- `src/app/api/admin/songs/route.test.ts`
- `src/entities/album/api/api.test.ts`
- `src/entities/song/api/api.test.ts`
- `src/features/manage-album/ui/AlbumManagerClient.test.tsx`
- `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.test.tsx`
- `src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.test.tsx`

Evidence:

- `docs/migration/m7-foundation-fixes/DATA-007.md`

### Implemented Decision

- Album과 Song에 각각 domain-specific `adminAlbumListSchema` / `adminSongListSchema`와 추론 타입을
  추가했다. 두 contract는 `{ items: <summary>[], nextCursor: null }`을 요구하며 generic response 또는
  pagination helper를 도입하지 않는다.
- `listAdminAlbums()`와 `listAdminSongs()`가 기존 authorization, repository 호출, item mapping 및 nullable
  normalization을 유지하면서 list DTO를 반환하도록 바꿨다.
- 두 관리자 GET Route는 Service DTO를 domain list schema로 output validation한다.
- 두 Entity browser API는 HTTP `unknown` payload를 같은 domain list schema로 parse한다.
- 기존 관리자 RSC page는 Service 결과를 변환 없이 같은 admin-list query key에 seed한다. Manager
  consumer는 Query DTO의 `items`만 client-side 검색, 필터, 페이지 나누기 및 폼 option에 사용한다.
- 기존 query key, stale time, invalidation 범위, mutation 동작 및 editor draft 소유권은 변경하지 않았다.

### Plan Deviations

- 없음. 예상한 application/contract 10개 파일과 test 9개 파일만 변경했다.
- RSC page는 계획대로 코드 변경이 필요하지 않았다. Service의 반환 shape 변경이 기존
  `setQueryData(queryKey, serviceResult)`에 그대로 반영된다.

### Tests Added or Changed

- Album/Song Service test에 domain list DTO와 기존 item mapping/nullable normalization 검증을 추가했다.
- 두 Route contract test를 list DTO output schema와 Service DTO equality assertion으로 전환했다.
- 두 browser API test를 정상 list DTO parse, AbortSignal 전달, bare array 및 잘못된 item 거부 검증으로
  전환했다.
- Album manager cache orchestration test를 hydration과 같은 list DTO seed/refetch/cache assertion으로
  전환했다.
- Album rename/delete와 lyrics save invalidation regression fixture를 list DTO로 전환했고 기존 affected /
  unaffected key 및 local editor draft assertion을 유지했다.

## VERIFICATION

### Commands Run / Actual Results

1. `pnpm exec prettier --write <DATA-007 evidence 및 변경 파일 19개>`
   - exit 0. 변경된 source/test 파일은 모두 이미 Prettier 형식과 일치했다. evidence 문서는 repository
     ignore 정책으로 출력 목록에 나타나지 않았다.
2. `pnpm exec vitest run src/server/services/album-service.test.ts src/server/services/song-service.test.ts src/app/api/admin/albums/route.test.ts src/app/api/admin/songs/route.test.ts src/entities/album/api/api.test.ts src/entities/song/api/api.test.ts src/features/manage-album/ui/AlbumManagerClient.test.tsx 'src/app/(admin)/admin/albums/_ui/AdminAlbumManager.test.tsx' 'src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.test.tsx' --reporter=verbose`
   - exit 0. 9 files passed, 34 tests passed.
3. `pnpm type-check`
   - exit 0. TypeScript `tsc --noEmit` passed.
4. `pnpm test:harness`
   - exit 0. 7 tests passed.
5. `pnpm lint`
   - exit 0. ESLint passed.
6. `pnpm lint:fsd`
   - exit 0. Steiger reported `No problems found`.
7. `pnpm format:check`
   - exit 0. All matched files use Prettier code style.
8. `pnpm test:unit:run`
   - exit 0. 44 files passed, 164 tests passed.
9. `pnpm build`
   - exit 0. Next.js 16.3.3 production build compiled, type-checked, collected page data and generated 23/23
     static pages successfully.
10. `git diff --check`
    - exit 0. whitespace errors 없음.
11. `rg`로 `albumSummarySchema.array()`, `adminSongSummarySchema.array()` 및 admin-list query key에 bare array를
    직접 seed하는 패턴을 재검색했다.
    - 관련 source에서 잔여 패턴 없음.

### PostgreSQL Evidence

- 계획에서 확인한 `.local/M7-POSTGRES-VERIFICATION.md` 외에 PostgreSQL 명령을 실행하지 않았다.
- 이번 diff는 DB schema, SQL, repository query, transaction 및 concurrency를 변경하지 않으므로 별도 actual
  PostgreSQL 검증은 적용 대상이 아니다. local application DB와 production DB 모두 변경하지 않았다.

### Failures

- 없음.

### Remaining Unknowns

- 저장소 밖에서 관리자 endpoint의 기존 bare array를 직접 소비하는 비공개 client 존재 여부는 확인할 수
  없다. 저장소 내 Route, RSC hydration, browser Query와 UI consumer는 모두 한 DTO로 전환했다.
- `nextCursor: null`은 현재 전체 조회의 끝을 나타내며 future server pagination 구현 여부와 정책은 이
  finding에서 결정하지 않았다.

## REVIEW

### Verdict

APPROVE

### Findings by Severity

- Critical: 없음.
- High: 없음.
- Medium: 없음.
- Low: 없음.

Root cause가 해소됐다. Album/Song domain-specific list contract가 각각
`src/shared/contracts/album.ts:43`과 `src/shared/contracts/song.ts:61`에 정의됐고, Service 결과
(`src/server/services/album-service.ts:90`, `src/server/services/song-service.ts:160`), Route output
validation (`src/app/api/admin/albums/route.ts:11`, `src/app/api/admin/songs/route.ts:11`), browser parser
(`src/entities/album/api/api.ts:17`, `src/entities/song/api/api.ts:19`)가 같은 DTO를 사용한다. RSC는 Service
결과를 기존 query key에 그대로 seed하고 manager consumer는 `items`를 사용하므로 hydration과 HTTP
refetch의 Query cache shape도 일치한다.

### Blocking Issues

- 없음. 계획에 요구된 targeted regression, repository gate, 전체 unit suite와 production build가 모두
  통과했다.

### Minor Issues

- 없음.

### Remaining Risks

- 저장소 밖의 비공개 관리자 API consumer 존재 여부는 확인할 수 없다. 이 DTO 변경은 해당 consumer가
  있다면 함께 전환해야 하는 breaking change다.
- 관리자 RSC page 전용 browser E2E는 없지만, Service DTO test, Route/client contract test, hydrated
  QueryClient consumer test, type-check와 production build가 계획된 경계를 검증했다.
- DB 경계를 변경하지 않아 actual PostgreSQL 재실행은 필요하지 않았고, 이 finding에 대한 DB 검증 공백으로
  보지 않는다.

### Reviewer Recommendation

- DATA-007을 `CLOSED`로 종료한다.
- 현재 diff는 승인된 계획과 파일 범위를 지키며 authorization, transaction/concurrency, sensitive-data,
  cache ownership, API error/mutation contract 또는 FSD 경계를 변경하지 않았다.
- 추가 수정 없이 commit/push 후 `migration_develop` 대상 PR로 검토·병합할 수 있다.
