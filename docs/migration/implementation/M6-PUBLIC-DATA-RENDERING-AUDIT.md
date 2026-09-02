# M6 페이지 렌더링·공개 데이터 경계 감사

## 목적과 기준

API 레이어를 수정하기 전에 현재 App Router의 모든 페이지와 layout, loading/error 경계를 확인했다.
판정 우선순위는 Architecture Constitution과 active architecture 문서이며, 입력 가이드와 충돌하는
항목은 active 문서를 따른다.

- RSC는 같은 프로세스의 service를 직접 호출한다.
- Client Query만 Ky와 Route Handler를 사용한다.
- 브라우저의 refetch/mutation/invalidation lifecycle이 없으면 RSC data를 props로 전달한다.
- Client에서도 계속 관리할 server-state만 Query cache에 seed하고 hydrate한다.
- DB-backed page는 v1에서 dynamic rendering을 기본으로 한다.
- Next Data Cache는 application consistency에 사용하지 않는다.
- React `cache()`는 metadata/page가 공유하는 request render 내 DB read dedupe에만 사용할 수 있다.

입력 가이드의 공개 콘텐츠 `cacheTag` 및 write-triggered Next cache invalidation 제안은 active
`07-rendering-query-cache-architecture.md`의 Next Data Cache 미사용 결정과 충돌하므로 이번 구현에서
적용하지 않는다.

## 전체 페이지 분류

| Route | 현재 렌더링·데이터 경계 | 소유권 판정 | 감사 결과 |
| --- | --- | --- | --- |
| `/` | RSC shell → Album service → props → animated Client island | server-owned | 정적 header 뒤 목록만 stream하므로 Suspense 유지, dynamic 명시 |
| `/chants` | RSC shell → Album service → props → client filter | server-owned | 검색은 전달받은 props의 local form state이므로 Query 불필요, Suspense 유지, dynamic 명시 |
| `/albums/[slug]` | RSC service read → 전체 modal Client island | server-owned | client server-state lifecycle 없음, Hydration 불필요, 전체 화면 Suspense는 route loading으로 이동 |
| `/songs/[slug]` | RSC service read → interactive lyrics Client island | server-owned | player/scroll/animation은 local interaction이며 refetch 없음, Query 불필요, 전체 화면 Suspense는 route loading으로 이동 |
| `/more` | 정적 RSC | static content | API/Query 불필요 |
| `/more/notice` | 정적 RSC → accordion Client island | static props | API/Query 불필요 |
| `/more/policy` | 정적 RSC | static content | API/Query 불필요 |
| `/more/policy/[slug]` | params 기반 정적 RSC | static content | API/Query 불필요 |
| `/more/report` | iframe load state를 가진 Client page | browser-local | 외부 iframe이며 application Query 대상 아님 |
| `/more/updates` | 정적 RSC | static content | API/Query 불필요 |
| `/admin-login` | RSC session check → lazy Client form | auth + client form | 인증 redirect는 server, form interaction은 client에 유지 |
| `/admin` | RSC redirect | 없음 | 데이터 계층 없음 |
| `/admin/albums` | RSC auth/service → Album·Ability Query seed → hydrated Client CRUD | client-owned mutable server-state | Hydration과 Query mutation/invalidation 유지 |
| `/admin/songs` | RSC auth + 병렬 Song/Album service → Query seed → hydrated Client CRUD | client-owned mutable server-state | 병렬 read, Hydration, Query mutation/invalidation 유지 |
| `/admin/edit/[slug]` | RSC auth/editor snapshot props + Ability seed → client draft/mutation | server initial snapshot + client mutation | editor draft는 feature state, Ability는 Query-owned; 현재 별도 Song refetch lifecycle이 없어 song hydration은 추가하지 않음 |

## 공통 경계

- Root layout의 QueryClientProvider는 browser application lifecycle 동안 QueryClient 한 개를 유지한다.
- Admin layout은 request context로 인증·인가하고 service가 실제 security boundary를 유지한다.
- User layout은 navigation/footer shell이며 server-state를 소유하지 않는다.
- 전역 `loading.tsx`와 `global-error.tsx`가 fallback을 제공한다. Album/Song 상세의 기존 전용
  skeleton은 각 route의 `loading.tsx`로 이동해 페이지 구현에서 불필요한 Promise 전달 계층을 제거한다.
- 공개 Album/Song Route Handler와 Entity browser API는 현재 페이지의 RSC acquisition path가 아니다.
  향후 실제 Client Query consumer를 위한 HTTP entry point이며 RSC가 이를 호출하지 않는다.

## 확인된 문제와 변경 범위

### 공개 Song DTO

기존 service는 Drizzle relation row를 spread해 persistence field를 application projection에 포함했고,
RSC page는 `lyrics as unknown as LyricLine[]`로 저장 데이터 계약을 우회했다. 또한 Song 상세의 Album
relation에 포함된 비공개 곡을 걸러내지 않았다.

이번 checkpoint에서는 service mapper가 allow-list 방식의 `SongDetail` DTO를 반환하고, nullable legacy
lyrics는 빈 배열로 정규화하며, 비-null malformed lyrics는 unexpected contract failure로 처리한다.
RSC는 검증된 lyrics를 직접 소비하고 Client island에는 실제 사용하는 Song field만 직렬화한다. 관리자
editor의 초기 snapshot도 같은 service parser를 통과시켜 feature model의 `unknown`과 Client 타입 단언을
제거한다.

### Album view model

Album DTO를 동일한 UI model로 바꾸는 매핑이 홈, Album 상세, Song 상세에 반복돼 있었다. 세 consumer가
동일한 변화 이유를 공유하므로 Entity의 작은 `toAlbumViewModel()` 순수 mapper로 모은다. generic mapper나
server/client adapter 계층은 추가하지 않는다.

### Metadata/Page dedupe

Album/Song 상세의 `generateMetadata()`와 page는 같은 slug로 같은 DB service read를 수행한다. Next.js
공식 Metadata 문서는 `fetch`를 사용할 수 없는 DB client에 React `cache()`를 사용할 수 있다고 명시한다.
각 route module에서 같은 memoized function을 공유해 server request/render 범위에서만 dedupe한다.
이는 persistent Next Data Cache가 아니다.

## Contract·DTO 이름 목록

HTTP 경계의 Zod schema가 입력·출력 계약과 TypeScript 타입의 SSOT다. 타입은 schema의 `z.infer`로
파생하며, service는 persistence row를 직접 노출하지 않고 아래 DTO만 반환한다.

| 계약 파일 | Schema | DTO/타입 |
| --- | --- | --- |
| `album.ts` | `albumSummarySchema`, `albumDetailSchema`, `renderableAlbumSongSchema` | `AlbumSummary`, `AlbumDetail`, `RenderableAlbumSong` |
| `album.ts` | `saveAdminAlbumSchema` | `SaveAdminAlbum` |
| `song.ts` | `songDetailSchema`, `adminSongSummarySchema`, `adminSongMutationResultSchema` | `SongDetail`, `AdminSongSummary`, `AdminSongMutationResult` |
| `song.ts` | `createAdminSongSchema`, `updateAdminSongSchema`, `saveAdminSongLyricsSchema` | `CreateAdminSong`, `UpdateAdminSong`, `SaveAdminSongLyrics` |
| `song.ts` | `lyricsDataSchema`, `lyricLineSchema`, `lyricSegmentSchema` | `LyricsData`, `LyricLine`, `LyricSegment` |
| `signup.ts` | request/complete schemas | `RequestSignupOtp`, `VerifySignupOtp`, `CompleteSignup` |
| `signup.ts` | response schemas | `SignupOtpResponse`, `VerifySignupOtpResponse`, `CompleteSignupResponse` |
| `authorization.ts` | `serializedAbilityRuleSchema`, `serializedAbilityResponseSchema` | `SerializedAbilityRule`, `SerializedAbilityResponse` |
| `error.ts` | `apiErrorResponseSchema` | `ApiErrorResponse` |

`AdminAlbumSummary`는 별도 구조체가 아니라 `AlbumSummary`의 entity public alias다. `SaveAlbumInput`,
`CreateSongInput`, `EditSongInput`처럼 contract와 동일 구조를 재선언하는 service 전용 이름은 제거했다.
반면 `SongEditInput`/`SongEditValues`, `AlbumFormInput`/`AlbumFormValues`는 React Hook Form의 input·parsed
form state 경계이므로 HTTP DTO와 혼동하지 않도록 feature 내부에 유지한다.

## 유지하거나 보류한 항목

- 공개 페이지에 TanStack Query, prefetch, dehydrate, HydrationBoundary를 추가하지 않는다.
- 관리자 Query/Hydration 흐름은 실제 mutation lifecycle이 있으므로 유지한다.
- 공개 `cacheTag`, `revalidateTag`, `revalidatePath`는 active architecture 변경 없이 도입하지 않는다.
- Revision, Discussion, CheerGuide mode 등 `DOMAIN_SPECIFICATION.md`의 목표 도메인은 현재 legacy
  Album/Song API와 섞어 선제 구현하지 않는다.
- Production DB와 credential은 사용하지 않는다.

## 검증 결과

- `pnpm type-check`: 통과
- `pnpm test:harness`: 7개 통과
- `pnpm lint`: 오류 0개, 기존 max-lines warning 5개
- `pnpm lint:fsd`: 통과
- `pnpm test:unit:run`: 31 files, 99 tests 통과
- `pnpm format:check`: 통과
- `pnpm build`: Next.js 16.3.3 production build 통과
  - `/`, `/chants`, `/albums/[slug]`, `/songs/[slug]`가 dynamic route로 확인됨
  - 정적 More 페이지와 SSG policy 상세은 기존 rendering mode 유지
- Song service mapper unit test로 allow-list DTO, lyric normalization/contract failure, public visibility를
  검증했다.
