# M7-DATA-006

## Status

PLANNED

## PLAN

### Finding

`M7-DATA-006 — Query ownership은 단일하지만 mutation invalidation이 불완전`

- 분류: Cache / needs-fix / medium (P1)
- 목표: mutation 성공으로 실제 값이 달라지는 Query consumer만 명시적으로 invalidate한다.
- 현재 escalation: 없음. 도메인 정책, schema, migration 결정이 필요하지 않다.

### Selected Model / Effort

- 레지스트리 권고: **PLAN: Sol High**
- 후속 권고: **IMPLEMENT: Terra**, **REVIEW: Sol Medium**
- 실제 실행 모델/effort: 런타임 메타데이터가 제공되지 않아 확인할 수 없으며 추론하지 않는다.

### Confirmed Cause

확인된 증거는 다음과 같다.

1. `src/features/manage-album/ui/AlbumManagerClient.tsx`는 create/update/delete 성공 후
   `albumQueryKeys.adminList()`만 invalidate한다.
2. `src/features/manage-song/ui/SongManagerClient.tsx`는 Song CRUD 성공 후
   `songQueryKeys.adminList()`를 invalidate한다. 이 경로 자체에는 이번 finding의 누락이 없다.
3. `src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.tsx`의 `saveLyrics` mutation에는
   권한 오류 처리만 있고 성공 invalidation이 없다.
4. `AdminSongSummary`는 `album.name`, `youtubeId`, `updatedAt`을 포함한다.
   `saveSongLyrics()`는 `youtubeId`와 `updatedAt`을 갱신하므로 가사 저장은 이미 캐시된 Song 관리자
   목록의 projection을 변경한다.
5. Album 이름 변경은 Song 관리자 목록의 중첩 `album.name`을 변경하며, Album 삭제는 FK cascade로
   해당 Album의 Song을 제거한다. 따라서 두 mutation 모두 Song 관리자 목록에 영향을 준다.
6. 관리자 Song route는 Album/Song 관리자 목록을 같은 browser QueryClient에 seed한다. browser
   QueryClient는 application lifecycle 동안 유지되므로, route navigation 또는 우연한 refetch가
   누락된 consistency 규칙을 대체하지 못한다.
7. 공개 Album/Song detail query option은 정의되어 있지만 현재 Client Query consumer가 없다. 공개 화면은
   RSC-only이고, 가사 편집기는 RSC에서 받은 `SongEditor` snapshot을 로컬 editor state의 초기값으로
   사용한다.
8. `.local/M7-POSTGRES-VERIFICATION.md`는 실제 PostgreSQL에서 Album→Song CASCADE를 확인했지만 cache
   invalidation과 Browser UI는 검증 범위 밖이라고 명시한다.

따라서 root cause는 query key나 ownership의 불일치가 아니다. mutation orchestration이 자기 feature의
목록만 갱신하고 cross-resource projection dependency를 조합 경계에서 연결하지 않은 것, 그리고 lyrics
save 성공 경로에 invalidation 자체가 없는 것이다.

### Invariant to Preserve

다음을 보존한다.

- mutation 성공 후에만 실제 영향을 받는 query identity를 TanStack Query의
  `invalidateQueries()`로 명시적으로 invalidate한다.
- Album create와 이름 외 필드만 바뀐 update는 Song 관리자 목록을 invalidate하지 않는다.
- Album 이름 변경과 삭제는 Album 관리자 목록과 Song 관리자 목록을 모두 invalidate한다.
- lyrics save는 Song 관리자 목록만 invalidate한다. Album 관리자 목록과 현재 Query consumer가 없는
  public detail key는 건드리지 않는다.
- Album feature는 Song entity/query key를 직접 import하지 않는다. cross-resource invalidation은
  `app`의 route-private composition boundary에서 callback으로 연결한다.
- `entities/*/api`는 현재 query/mutation key와 HTTP adapter 소유권을 유지한다. mutation metadata,
  global registry, event bus 또는 custom cache dependency graph를 추가하지 않는다.
- 공개 RSC 조회를 TanStack Query로 이동하지 않고 `router.refresh()`나 Next Data Cache invalidation을
  일반 consistency 수단으로 추가하지 않는다.
- 가사 editor의 lyrics/YouTube ID draft는 현재 로컬 state가 계속 소유한다. invalidation 때문에 editor를
  remount/reset하거나 query data로 draft를 덮어쓰지 않는다.
- 기존 403 발생 시 ability query invalidation과 mutation error UX를 보존한다.

### Options

#### Option A — Album feature에서 Song query key를 직접 invalidate

`AlbumManagerClient`가 `songQueryKeys.adminList()`를 import하여 Album/Song 목록을 함께 invalidate한다.

- 장점: 변경 줄 수가 가장 적다.
- 단점: manage-album use case가 별도 Song resource의 cache identity를 직접 알아야 한다. 레지스트리가
  요구한 route composition 경계를 우회하고 향후 cross-resource 의존을 feature 내부에 누적시킨다.
- 판단: 채택하지 않는다.

#### Option B — 의미 기반 callback을 route composition에서 연결

`AlbumManagerClient`는 성공한 Album mutation이 `name change` 또는 `delete`였다는 의미만 callback으로
알린다. `AdminAlbumManager`가 callback을 받아 `songQueryKeys.adminList()`를 invalidate한다. lyrics save는
이미 Song mutation과 auth/편집 feature를 조합하는 `AdminLyricsEditor`에서 Song 관리자 목록을
invalidate한다.

- 장점: 실제 영향 범위를 가장 좁게 표현하고 FSD 의존 방향과 route-private composition 책임을 지킨다.
- 단점: callback contract와 이를 연결하는 작은 테스트가 추가된다.
- 판단: 최소 권고안으로 채택한다.

#### Option C — mutation metadata 또는 전역 invalidation registry

mutation option의 `meta` 또는 별도 registry에 영향 key를 선언하여 자동 invalidation한다.

- 장점: 호출부의 반복은 줄일 수 있다.
- 단점: 현재 두 누락을 해결하기 위해 새로운 cache dependency framework를 만들며 active architecture가
  명시적으로 금지한다. 불필요 key까지 넓게 invalidate할 위험도 있다.
- 판단: 채택하지 않는다.

### Recommended Minimal Change

1. `AlbumManagerClient`에 Song이라는 이름이나 query key를 노출하지 않는 의미 기반 callback
   (예: `onNameChangeOrDelete`)을 추가한다.
2. Album update가 성공하면 mutation의 authoritative response에 있는 `name`을 기존
   `editingAlbum.name`과 비교한다. 실제 이름이 달라진 경우에만 callback을 호출한다. create 및 이름이
   동일한 update에서는 호출하지 않는다.
3. Album delete가 성공하면 Album 목록 invalidation과 함께 같은 callback을 호출한다. callback은
   persistence 성공 전이나 mutation failure 경로에서는 호출하지 않는다.
4. `AdminAlbumManager`가 callback을 구성하여 정확히 `songQueryKeys.adminList()`를 invalidate한다.
   Album 목록 invalidation은 기존처럼 `AlbumManagerClient`가 소유한다.
5. `AdminLyricsEditor`의 `saveLyrics` mutation 성공 callback에서 정확히
   `songQueryKeys.adminList()`를 invalidate한다. 기존 403 ability invalidation은 그대로 둔다.
6. secondary cache invalidation 때문에 성공한 persistence를 실패 UX로 바꾸거나 editor 저장 완료를
   불필요하게 지연하지 않도록 기존 비동기 처리 의미를 보존한다. invalidation 호출 자체는 테스트가
   관찰할 수 있어야 한다.
7. 현재 key factory를 그대로 사용하고 문자열 query key, broad `songQueryKeys.all`, optimistic update,
   cache 직접 수정은 도입하지 않는다.

### Files Expected to Change

예상 수정 파일:

- `src/features/manage-album/ui/AlbumManagerClient.tsx`
  - 성공한 name change/delete를 알리는 callback contract와 호출 지점
- `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.tsx`
  - callback을 Song 관리자 목록 invalidation에 연결
- `src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.tsx`
  - lyrics save 성공 후 Song 관리자 목록 invalidation

예상 추가 테스트 파일:

- `src/features/manage-album/ui/AlbumManagerClient.test.tsx`
- `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.test.tsx`
- `src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.test.tsx`

구현 중 같은 관찰을 더 작은 테스트 수로 완전히 증명할 수 있으면 테스트 파일은 병합할 수 있지만,
production file scope는 위 세 파일을 넘기지 않는다.

명시적 제외 파일/범위:

- `src/entities/album/api/*`, `src/entities/song/api/*`: 현재 key와 mutation option은 원인이 아니다.
- public Album/Song page와 detail query: 현재 RSC-only 경로에 Query를 추가하지 않는다.
- `src/features/manage-lyrics/model/useAdminEditor.ts`와 editor UI: draft ownership을 변경하지 않는다.
- API route, contract, service, repository, DB schema, migration, seed/dump
- QueryClient 공통 설정, generic invalidation helper/framework, package/config
- active architecture와 Domain Specification
- DATA-001~005 및 DATA-007~009

### Tests Required

실제 `QueryClient`와 seed된 cache를 사용하는 focused Vitest를 추가한다. TanStack Query 자체가 아니라
우리 orchestration이 선택한 target과 callback 연결을 검증한다.

Album 경로:

- Album/Song 관리자 목록 cache를 먼저 fresh 상태로 채운다.
- create 성공: Album 목록만 invalidated/refetched되고 Song 목록은 fresh이며 fetch가 호출되지 않는다.
- 이름이 같은 update 성공: Album 목록만 invalidated/refetched되고 Song 목록은 unaffected다.
- name change 성공: Album과 Song 관리자 목록이 모두 invalidated된다. active observer가 있는 대상은
  refetch되고 inactive 대상은 invalidated/stale 상태가 된다.
- delete 성공: Album과 Song 관리자 목록이 모두 invalidated/refetched된다.
- mutation failure: 추가 Song invalidation callback이 실행되지 않는다.
- route-private `AdminAlbumManager`가 전달한 callback이 문자열 재작성이나 broad key가 아니라 정확히
  `songQueryKeys.adminList()`를 대상으로 삼는다.

Lyrics 경로:

- Album/Song 관리자 목록 cache를 먼저 fresh 상태로 채운다.
- lyrics save 성공: Song 관리자 목록만 invalidated/stale 또는 active observer 기준 refetch되고 Album
  목록은 fresh하며 불필요 fetch가 없다.
- lyrics save failure: Song 관리자 목록을 invalidate하지 않고 기존 403 ability 처리 의미를 보존한다.
- 수정한 lyrics/YouTube ID를 로컬 draft에 둔 상태에서 save를 실행하고 invalidation 완료 후에도 동일
  editor instance와 draft 값이 유지되는지 검증한다.

focused test 명령 후보:

```bash
pnpm exec vitest run \
  'src/features/manage-album/ui/AlbumManagerClient.test.tsx' \
  'src/app/(admin)/admin/albums/_ui/AdminAlbumManager.test.tsx' \
  'src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.test.tsx'
```

구현 완료 후 repository gate:

```bash
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
```

### Actual PostgreSQL Verification

- 이 finding은 browser QueryClient orchestration만 변경하며 schema, SQL, repository, transaction,
  authorization 또는 persistence 결과를 변경하지 않는다. 따라서 구현 단계의 신규 actual PostgreSQL
  verification은 **해당 없음**이다.
- 기존 `.local/M7-POSTGRES-VERIFICATION.md`에서 PostgreSQL 17.11을 대상으로 Album→Song CASCADE가
  실제 확인되었다. 같은 기록은 cache invalidation과 Browser UI가 검증 범위 밖이라고 명시하므로,
  이번 결함의 통과 근거로 재사용하지 않는다.
- 실제 cache 검증은 mock QueryClient가 아니라 production dependency의 `QueryClient`와 실제 query key
  factory를 사용하는 Vitest로 수행한다. HTTP persistence 함수만 deterministic test double로 격리한다.
- 구현이 DB/schema/service/repository 변경으로 확대되거나 기존 cascade 관찰과 충돌하면 작업을 멈추고
  isolated local Docker Compose PostgreSQL 절차를 새로 승인받아야 한다. production credential은 사용하지
  않는다.

### Risks / Unknowns

- 현재 `AdminSongSummary`가 Album에서 소비하는 필드는 `album.name`뿐이다. 구현 시 다른 Album 필드가
  projection에 새로 추가되었거나 별도 Client Query consumer가 발견되면 invalidation 조건을 임의로
  넓히지 말고 escalation한다.
- TanStack Query는 active/inactive query에 대해 invalidation 후 refetch 시점이 다르다. 테스트는
  `isInvalidated`/stale 상태와 active observer의 fetch를 구분해 검증하고, inactive cache의 즉시 fetch를
  잘못 요구하지 않는다.
- mutation success callback에서 invalidation promise를 await하는 방식은 form close, save toast,
  `isSaving` 시간에 영향을 줄 수 있다. 기존 UX를 바꾸지 않는 secondary invalidation 처리로 유지한다.
- Album update의 영향 판정은 제출 전 raw input보다 서버가 반환한 authoritative Album name을 기존
  summary와 비교해야 trim/normalization으로 인한 불필요 invalidation을 줄일 수 있다.
- editor를 Song Query consumer로 바꾸거나 query 결과 변경에 맞춰 reset하면 사용 중 draft가 사라질 수
  있다. 이 접근은 금지하며 필요해지는 경우 별도 정책 결정으로 escalation한다.
- focused regression을 위해 공통 QueryClient 설정, 전역 test setup 또는 public API를 바꿔야 한다면
  계획 범위를 벗어나므로 먼저 escalation한다.

### Implementation Prompt

`DATA-006`만 구현한다. 승인 invariant는 다음과 같다: mutation 성공으로 실제 값이 변하는 기존 Query
consumer만 query key factory를 사용해 invalidate하고, Album feature와 Song cache의 cross-resource
연결은 app route-private callback에서 구성하며, 공개 RSC 조회와 editor local draft ownership은 그대로
둔다.

선택한 Option B를 적용한다.

1. `src/features/manage-album/ui/AlbumManagerClient.tsx`에 의미 기반 callback을 추가한다. 성공한 Album
   update의 authoritative response name이 기존 name과 실제로 달라진 경우와 성공한 delete에서만 이를
   호출한다. 기존 Album 관리자 목록 invalidation과 error 처리도 유지한다.
2. `src/app/(admin)/admin/albums/_ui/AdminAlbumManager.tsx`에서 callback을 정확히
   `songQueryKeys.adminList()` invalidation으로 연결한다.
3. `src/app/(admin)/admin/edit/[slug]/_ui/AdminLyricsEditor.tsx`에서 lyrics save 성공 후 정확히
   `songQueryKeys.adminList()`를 invalidate한다. 기존 403 ability invalidation과 editor save/draft UX를
   유지한다.
4. production 변경은 위 세 파일로 제한한다. entity API/query key, public RSC, editor model, server/DB,
   shared QueryClient, architecture 문서를 변경하지 않는다. custom invalidation metadata/registry, broad
   invalidation, optimistic cache write를 만들지 않는다.
5. actual `QueryClient`에 Album/Song 목록을 seed하는 focused tests를 추가한다. create/동일-name update의
   Song cache unaffected, rename/delete의 두 목록 invalidation, lyrics save의 Song-only invalidation,
   failure 시 no invalidation, active refetch와 inactive stale 의미, editor draft 보존을 검증한다.
6. focused Vitest 후 `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`,
   `pnpm test:unit:run`, `pnpm format:check`, `pnpm build`를 실행하고 실제 결과만 기록한다.
7. 신규 PostgreSQL 검증은 필요하지 않다. 다만 구현에 schema/SQL/service/repository 변경이 필요해지거나,
   새로운 Query consumer/DTO dependency가 발견되거나, callback/test를 위해 공통 framework 또는 config
   변경이 필요하면 즉시 중단하고 발견한 증거와 필요한 결정을 `ESCALATION`으로 보고한다.

이 문서는 `PLANNED` 상태이며 별도의 사용자 승인 없이 범위나 정책을 확대하지 않는다.

## IMPLEMENTATION

pending

## VERIFICATION

pending

## REVIEW

pending
