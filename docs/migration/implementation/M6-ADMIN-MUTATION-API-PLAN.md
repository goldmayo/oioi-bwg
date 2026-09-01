# M6 관리자 Mutation API 전환 계획

## 목적

기존 관리자 앨범·곡 Server Action을 다음의 단일 mutation 경로로 전환한다.

```text
Admin Client
  → TanStack Query mutation
  → ky
  → /api/admin/* Route Handler
  → server service
  → repository
  → PostgreSQL
```

M5에서 적용한 `RequestContext`와 CASL service security boundary를 재사용한다. Route Handler나
client UI의 검사만으로 write 권한을 보장하지 않는다.

## M4에서 전환하지 않은 이유

M4는 공개 Album/Song **read** API contract와 client HTTP 기반을 먼저 확정한 checkpoint였다.
`M4-API-CONTRACT-PLAN.md`와 `M4-API-CONTRACT-RESULT.md`는 admin mutation contract를 M5
authentication/CASL authorization 및 revision/discussion/moderation lifecycle과 함께 의도적으로
제외했다.

당시 관리자 write를 Route Handler로 먼저 전환했다면 다음 보안 경계가 없는 상태에서 API contract를
만들고, M5 후에 다시 고쳐야 했다.

```text
Auth.js identity
RequestContext의 ACTIVE account fact
CASL ability
UNAUTHENTICATED / FORBIDDEN AppError → 401 / 403 변환
```

현재 M5가 이 경계를 제공하므로, M6에서 기존 Server Action을 동일 service security boundary를 쓰는
HTTP mutation으로 전환한다. revision/discussion/moderation lifecycle은 여전히 이 Album/Song CRUD
전환과 분리된 후속 도메인 작업이다.

## 현재 inventory

| 영역 | 현재 delivery adapter | service | 전환 대상 |
| --- | --- | --- | --- |
| Album create/update/delete | `app/(admin)/admin/_lib/album-actions.ts` | `createAlbum` / `editAlbum` / `deleteAlbum` | `/api/admin/albums` 및 `/api/admin/albums/[id]` |
| Song create/update/delete | `app/(admin)/admin/_lib/song-actions.ts` | `createSong` / `editSong` / `deleteSong` | `/api/admin/songs` 및 `/api/admin/songs/[id]` |
| Song lyric save | route-local Server Action | `saveSongLyrics` | song update contract와 병합 여부를 별도 판단 |

현재 Server Action은 Zod parse, LRC parse, error string 변환, `router.refresh()` 기반 갱신을 함께
소유한다. 이는 M4 이후의 HTTP/`ApiError`/Query invalidation 계약과 병행하지 않는다.

## Album client API 소유권

### 최초 결정 — superseded

PR #41 계획과 PR #43 구현에서는 관리자 endpoint와 단일 browser consumer를 근거로 Album browser API를
`features/manage-album/api`에 배치했다. 이 결정은 다음 상위 active architecture 규칙보다 endpoint의
권한 성격을 과도하게 우선했으므로 superseded한다.

```text
domain-specific browser API adapter / queryOptions / mutationOptions
→ entities/*/api
```

또한 `AdminAlbumSummary`는 Album manager뿐 아니라 Song manager의 앨범 선택에서도 이미 사용되고 있어
안정된 Album projection과 복수 상위 consumer라는 승격 evidence가 존재했다.

### 후속 정정

Album browser API는 다음 파일이 소유한다.

```text
src/entities/album/api/
├─ api.ts         # ky 호출과 response contract parse
├─ query-keys.ts  # RSC service seed와 CSC Query가 공유하는 cache identity
├─ queries.ts     # public detail 및 admin list queryOptions
└─ mutations.ts   # create/update/delete mutationOptions와 mutation key
```

M4의 `client-only` Ky 경계를 RSC module graph에 넣지 않도록 `query-keys.ts`는 server-safe module로
분리한다. RSC는 key만, CSC는 같은 key를 포함하는 `queryOptions()`를 소비한다. 관리자 인증·인가는
Route Handler와 service의 security policy이며 FSD browser API 소유권을 feature로 바꾸지 않는다.

slice root `index.ts`는 server-safe key를 공개하고, client-only Query/Mutation options는 같은 slice의
`api/index.ts` public entry로 공개한다. 이를 통해 RSC가 사용하는 Album model/UI public API에서 Ky
transport를 추적하지 않는다.

`features/manage-album`에는 Album 관리 폼·dialog·mutation orchestration과 R2 이미지 업로드 행동만
남긴다.

## 확정 원칙

- request body와 path param은 Route Handler에서 Zod로 한 번 검증한다.
- 성공 생성은 `201`, update/delete는 실제 response DTO 또는 `204`를 명시적으로 선택한다.
- service는 `RequestContext`를 받고 `UNAUTHENTICATED`/`FORBIDDEN`을 유지한다.
- client는 `ApiError.code`로 401/403을 처리하며, 403은 ability 재조회 후 UI를 self-heal한다.
- Server Action의 `{ success, error }` result 관례와 `console.error` 기반 error 변환은 새 경로에
  복제하지 않는다.
- Query mutation 성공 후 관련 admin query key를 명시적으로 invalidate한다. `router.refresh()`와
  Next Data Cache invalidation을 대체 수단으로 사용하지 않는다.
- production DB migration, revision/discussion/moderation lifecycle, UI foundation(Base UI) 전환은 이
  API 전환 PR에 넣지 않는다.

## PR 분할 순서

1. **이 PR — mutation API 계획**: 현재 Server Action·service·client 연결을 기록하고 route/contract
   분할을 고정한다.
2. **Album HTTP contract + Route Handler**: admin list GET와 create/update/delete input·response contract,
   path param, 401/403/validation/expected error test를 추가한다. 기존 Server Action consumer는 유지한다.
3. **Album client transport 전환**: 최초에는 `features/manage-album/api/{api,queries,mutations}.ts`를 추가하고
   Album manager가 `queryOptions`/`mutationOptions`를 직접 소비하게 한다. query invalidation 및 403
   ability revalidation을 적용한 뒤 album Server Action을 제거한다.
4. **Album API 소유권 정정**: 상위 architecture와 실제 복수 consumer evidence에 맞춰 Album browser
   API와 Query options를 `entities/album/api`로 이동한다. 동작과 HTTP contract는 바꾸지 않는다.
5. **Song mutation contract + Route Handler**: LRC parsing의 service 소유 경계를 정리한 뒤 song
   create/update/delete API와 테스트를 추가한다.
6. **Song client transport 전환**: song manager 및 lyric editor consumer를 전환하고 기존 Server Action을
   제거한다.

Album과 Song을 한 PR에 함께 전환하지 않는다. Song의 LRC parsing과 lyric editor는 별도 reviewable
concern이다.

## 구현 전 확인 항목

- Album/Song delete의 not-found 및 FK conflict 공개 error code가 기존 `AppError` 계약에 충분한지
  확인한다. 부족하면 먼저 API/Error 계약을 작은 변경으로 확장한다.
- 현재 admin read query key와 manager hydration 범위를 확인해 mutation invalidation target을 정한다.
- client Ability의 403 self-healing은 최초 Album transport 전환에서 실제 `ApiError` consumer와 함께
  적용한다. 별도 추상화나 전역 retry hook은 만들지 않는다.

## 비범위 및 보류

- OCI Compute 배포 및 Instance Principal 실발송 smoke
- isolated PostgreSQL integration test lifecycle 및 CI service container(M7)
- 일반 사용자 회원가입 UI와 자동 로그인 UX
- 관리자 template CMS
