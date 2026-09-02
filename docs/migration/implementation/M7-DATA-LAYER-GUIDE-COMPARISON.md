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
