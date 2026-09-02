# M-07 데이터 레이어 분석 — 가이드·Active Architecture 비교

## 분석 상태

- 기준 브랜치: `migration_develop` (PR #50 merge 이후 `a92959d`)
- 비교 대상: `docs/guide/Next.js + TanStack Query Data Layer Refactoring Prompt.md`
- 우선순위: Architecture Constitution 및 active architecture 문서가 가이드보다 우선한다.
- 이번 문서는 분석 결과만 기록하며, M-07 구현 범위와 변경 순서는 후속 checkpoint에서 확정한다.

## 결론

현재 코드는 가이드의 핵심 방향과 대체로 일치한다. Public RSC는 service를 직접 호출하고, 실제
client server-state lifecycle이 있는 Admin CRUD는 TanStack Query와 HTTP contract를 사용한다.
다만 가이드의 `Next server cache` 예시는 active `07-rendering-query-cache-architecture.md`와
충돌하므로 적용하지 않는다. M-07의 우선 분석 대상은 새로운 cache 도입이 아니라, 현재 Query
ownership·hydration·error lifecycle의 일관성 검토다.

## 정합성 비교

| 주제 | 가이드 | 현재 구현 | 판정 |
| --- | --- | --- | --- |
| Public 조회 | RSC → service → props | 홈/찬트/Album/Song RSC가 service 직접 호출 | 일치 |
| Public Client Component | lifecycle이 없으면 props | `AlbumDetailModal`, `LyricsViewerClient`에 최소 DTO 전달 | 일치 |
| Admin CRUD | Query + Ky + Route Handler + service | Album/Song/Lyrics Query·Mutation과 API route 사용 | 일치 |
| 초기 Admin 데이터 | service 조회 후 Query cache seed/hydrate | request QueryClient에 `setQueryData` 후 가까운 `HydrationBoundary` 사용 | 일치 |
| Query identity | query key를 transport와 분리 | `entities/*/api/query-keys.ts`가 key 소유 | 일치 |
| 서버 QueryClient | request/render 단위 격리 | `getQueryClient()`가 React `cache()`로 생성 | 일치 |
| Query retry | Query가 retry 소유, Ky retry 금지 | Query retry 정책과 Ky transport 분리 | 일치 |
| Next Data Cache | 가이드는 server-owned에 사용 가능하다고 설명 | active architecture는 application data consistency에 사용 금지 | **충돌: active 우선** |
| Global mutation error | `MutationCache` global toast 제안 | 현재는 각 mutation의 `onError`/route-local 처리 | 후속 검토 |
| `prefetchQuery` | client lifecycle이 있을 때 검토 | 현재는 service → `setQueryData` 기본 경로 | 일치 |

## 가이드와 Active Architecture의 충돌

가이드는 Public server-owned data에 `Next server cache`, `use cache`, `cacheTag`를 선택지로
제시하고, 후반부에 `cacheTag` 예시도 포함한다. 그러나 active 문서는 다음을 명시적으로 금지한다.

```text
unstable_cache
use cache
cacheTag
revalidateTag
updateTag
revalidatePath
```

따라서 M-07에서는 가이드의 해당 예시를 프로젝트 convention으로 승격하지 않는다. Public 데이터의
freshness/consistency는 현재 dynamic RSC service read를 기본으로 하며, Client lifecycle이 필요한
경우에만 TanStack Query ownership을 사용한다.

## 현재 데이터 ownership inventory

| 영역 | 데이터 | 소유권 | 현재 경로 |
| --- | --- | --- | --- |
| Public | album/song/lyrics/cheer | RSC/server-owned | service → DTO → props |
| Admin album | album list + ability | Query-owned | service seed → hydration → Query mutation/invalidation |
| Admin song | song/album list + ability | Query-owned | service seed → hydration → Query mutation/invalidation |
| Admin editor | initial song DTO + ability, form draft | 혼합 | service props + ability Query + RHF/local editor state |
| Public report | 외부 iframe 상태 | browser-local | Client Component local state |

## M-07 후속 분석 항목

1. `MutationCache` global error policy가 필요한지, 현재 per-mutation `onError`와 중복되는지 확인한다.
2. Admin 페이지의 `Suspense` fallback이 실제 독립 streaming UX를 제공하는지 확인한다.
3. Admin editor의 song data를 Query-owned로 승격할 필요가 있는지 mutation/refetch lifecycle 기준으로
   판단한다. 현재는 RSC initial DTO + form draft가 단순한 경로다.
4. Query key, response parser, DTO contract가 각 entity public API에서 단일 소유되는지 재검토한다.
5. 사용자별 ability cache가 request QueryClient와 browser QueryClient 양쪽에서 격리되는지 검증한다.
6. 운영 smoke는 M-06에서 보류했으므로 M-07 분석 범위에 자동 포함하지 않는다.

## 범위 경계

- Base UI 실제 전환은 폐기된 M-06 범위이며 M-07 분석 대상이 아니다.
- Revision, Discussion, moderation lifecycle은 M-07 이후 도메인 작업으로 별도 계획한다.
- 새로운 generic query wrapper, DI framework, Next Data Cache abstraction은 도입하지 않는다.

## `setQueryData`와 `prefetchQuery + Reader DI`

두 방식은 모두 서버에서 Client Query cache를 채울 수 있지만, 공유하는 대상이 다르다.

| 항목 | `setQueryData` seeding | `prefetchQuery + Reader DI` |
| --- | --- | --- |
| 서버 조회 | RSC가 service를 직접 호출 | reader를 queryFn에 주입해 prefetch |
| Query 옵션 공유 | query key만 공유 | query key + query policy + reader 계약 공유 |
| 서버 HTTP round-trip | 없음 | queryFn이 Ky면 발생 가능 |
| 적합한 경우 | 서버 DTO를 이미 얻었고 Client가 같은 cache를 이어 사용 | 동일 acquisition policy를 server/client가 실제로 공유 |
| 비용 | 낮음, 명시적 | DI/reader/factory 복잡성 증가 |

현재 Admin 목록은 `service → DTO → setQueryData → dehydrate`가 맞다. RSC에서 얻은 DTO를 이미
보유하고, Client는 hydration 이후 refetch/invalidation을 HTTP Query로 수행하기 때문이다. `prefetchQuery`
로 바꾸면 현재 client-only queryFn이 내부 Route Handler를 다시 호출할 수 있어 이점 없이 round-trip과
추상화가 늘어난다. Reader DI는 동일 query policy를 공유해야 하는 실제 도메인이 생길 때만 별도
checkpoint에서 검토한다.

## Query key 소유권 정정

Query key는 HTTP response DTO는 아니지만 RSC seed와 Client Query를 연결하는 직렬화 가능한 cache
identity 계약이지만 HTTP DTO contract와는 변경 이유가 다르다. 따라서 shared contract로 승격하지
않고 각 domain API slice가 key의 SSOT를 소유한다.

- `src/entities/album/api/query-keys.ts` → `albumQueryKeys`
- `src/entities/song/api/query-keys.ts` → `songQueryKeys`
- `src/features/auth/api/query-keys.ts` → `authAbilityQueryKeys`

Entity/feature API는 같은 slice의 key를 재수출하고, `queryOptions`는 key와 browser HTTP queryFn만
결합한다. Query key에는 server-only, DB, repository, service 의존성을 넣지 않는다.

## `useQuery`와 `useSuspenseQuery` 소비자 선택

현재 Admin 소비자가 `useSuspenseQuery`를 사용하는 이유는 초기 데이터가 선택적 보조 데이터가 아니라
화면 본문을 구성하는 필수 목록이기 때문이다. RSC가 service 결과를 Query cache에 seed하고, Client
subtree는 `HydrationBoundary` 아래에서 데이터를 소비한다. loading/error 분기를 각 컴포넌트에
반복하지 않고 route의 Suspense/Error Boundary로 위임하는 구조다.

TanStack Query 공식 동작상 `useSuspenseQuery`는 `data`가 정의됨을 보장하지만 `enabled`,
`placeholderData`, `throwOnError`를 지원하지 않고 cancellation caveat가 있다. `useQuery`는
`isPending`/`isError`/`data`를 컴포넌트가 직접 처리하며 조건부 조회와 placeholder UX를 표현할 수 있다.

다음이면 `useQuery`가 더 적합하다.

- query가 선택적이거나 `enabled` 조건이 필요한 경우
- 화면 일부만 늦게 갱신되고 나머지는 계속 보여줘야 하는 경우
- stale/background refetch 상태를 inline UX로 표시해야 하는 경우
- placeholder/previous data를 이용한 pagination·filter 전환이 필요한 경우

현재 Admin Album/Song 화면처럼 필수 목록을 Suspense boundary 안에서 함께 준비하는 경우에는
`useSuspenseQuery`가 적절하다. 같은 컴포넌트에서 독립 suspense query를 여러 개 추가할 때는
waterfall을 피하기 위해 서버 병렬 조회 또는 `useSuspenseQueries`를 검토한다.

## Global mutation error 설계 (구현 전)

active error architecture와 가이드의 공통 방향에 따라 다음 정책을 먼저 확정한다.

1. `QueryClient`의 `MutationCache.onError`가 기본 global mutation UX를 담당한다.
2. `ApiError`의 공개 `code`를 기준으로 사용자 메시지를 매핑한다. 내부 DB/stack/details는 노출하지 않는다.
3. validation 및 feature-specific conflict는 global toast 대신 local UX가 우선이다.
4. mutation options의 `meta.skipGlobalError`로 global 처리를 건너뛸 수 있게 한다.
5. `meta.errorMessage`는 정말 필요한 feature의 명시적 문구 override로만 허용한다.
6. global handler는 mutation을 재시도하거나 invalidate하지 않는다. consistency는 mutation consumer가
   명시적으로 처리한다.
7. 중복 toast 방지를 위해 local `onError`와 global handler의 책임을 하나의 mutation에서 동시에
   사용하지 않는다.

구현 시점에는 먼저 `MutationMeta` 타입과 toast presentation adapter의 위치를 정하고, `createQueryClient`
단위 테스트로 `ApiError`/contract error/unknown error 및 `skipGlobalError`를 검증한다. 현재 각
관리자 화면의 `onMutationError`는 이 설계로 이전하기 전까지 유지한다.

## Admin SPA-like와 Public RSC 중심 비교

| 기준 | Admin | Public |
| --- | --- | --- |
| 기본 경계 | RSC auth/layout + Client Query 화면 | RSC service read + 필요한 Client props |
| 데이터 ownership | mutable server-state는 Query | lifecycle 없는 공개 read는 RSC/server |
| mutation | Ky → Route Handler → service | 일반적으로 없음; server write는 service 직접 호출 |
| hydration | 초기 목록/ability처럼 Client가 계속 소비할 때 사용 | Client refetch/invalidation이 없으면 사용하지 않음 |
| navigation | SPA-like 상호작용 허용 | 서버 렌더/SEO/단순 전환 우선 |

이는 route 이름으로 강제하는 대칭 규칙이 아니다. Admin editor의 초기 DTO와 form draft처럼 한 화면에
RSC props, Query state, RHF state가 섞일 수 있고, Public도 향후 댓글처럼 mutation lifecycle이 생기면
Query-owned hydration을 선택할 수 있다. 판단 기준은 페이지 종류가 아니라 데이터 lifecycle이다.
