---
title: "Rendering / Query / Cache Architecture"
document_id: "07"
version: "1.1"
status: "active"
authority: "architecture"
updated_at: "2026-08-26"
depends_on:
  - "01"
  - "02"
  - "03"
  - "05"
  - "06"
related:
  - "04"
tags:
  - "nextjs"
  - "rsc"
  - "tanstack-query"
  - "cache"
  - "hydration"
---

# oioi-bwg Rendering / Query / Cache Architecture v1.1

## 1. 목적

이 문서는 oioi-bwg에서 다음을 결정한다.

- RSC를 언제 사용하는가
- Client Component를 언제 사용하는가
- TanStack Query를 언제 사용하는가
- 서버에서 데이터를 어떻게 가져오는가
- 서버에서 가져온 데이터를 Client Query로 어떻게 이어주는가
- Query cache를 어떻게 seed / dehydrate / hydrate 하는가
- Query key와 cache policy의 소유권은 어디에 있는가
- Mutation 이후 cache consistency를 어떻게 유지하는가
- 사용자별 데이터의 cache isolation을 어떻게 보장하는가
- Next.js Data Cache를 사용하지 않는다는 결정이 어떤 의미인가

이 문서는 페이지 종류를 기준으로 rendering strategy를 고정하지 않는다.

핵심 기준은:

> route category가 아니라 data access pattern, freshness requirement, client lifecycle 필요 여부다.

---

# 2. 최상위 원칙

oioi-bwg는 application server-state cache로 TanStack Query를 사용한다.

```text
Application server-state cache
= TanStack Query
```

Next.js Data Cache는 사용하지 않는다.

```text
Next Data Cache
= 사용하지 않음
```

RSC는 rendering boundary다.

```text
RSC
= server rendering / initial data acquisition boundary
```

Query cache가 실제 필요한 경우에만 서버에서 TanStack Query cache를 seed한다.

---

# 3. 사용하지 않는 Next Data Cache 기능

Application data consistency를 위해 다음 기능을 사용하지 않는다.

```text
unstable_cache
use cache
cacheTag
revalidateTag
updateTag
revalidatePath
```

현재 staging의 다음 패턴은 migration 시 제거 대상이다.

```text
DB write
→ updateTag(...)
→ revalidatePath(...)
```

Mutation 이후 consistency는 TanStack Query invalidation을 기본으로 한다.

---

# 4. React cache()는 별도 개념이다

다음은 서로 다르다.

```text
Next Data Cache
≠ React cache()
≠ TanStack Query cache
```

예:

```ts
export const getRequestContext =
  cache(async () => {
    ...
  });
```

처럼 동일 request 안의 중복 실행을 줄이기 위한 request-level memoization은 사용할 수 있다.

이것을 application server-state cache로 취급하지 않는다.

---

# 5. 서버 데이터 접근의 Application SSOT는 Service다

서버 내부에서는 데이터를 얻기 위해 자기 HTTP API를 다시 호출하지 않는다.

기본:

```text
RSC
 ↓
Service
 ↓
Repository
 ↓
Drizzle
```

사용하지 않는 기본 패턴:

```text
RSC
 ↓
ky
 ↓
Route Handler
 ↓
Service
```

이 원칙은 06 Server / Data Access Architecture를 따른다.

---

# 6. Client data access는 HTTP boundary를 사용한다

Client Component에서는 server service를 직접 호출할 수 없다.

기본 흐름:

```text
Client
 ↓
TanStack Query
 ↓
ky
 ↓
Route Handler
 ↓
Service
 ↓
Repository
```

Client queryFn은 HTTP contract를 통해 데이터를 얻는다.

---

# 7. Query Options의 역할

`queryOptions()`는 client-side server-state lifecycle의 SSOT다.

예:

`songQueries`와 `queryOptions()` factory의 실제 구현과 key hierarchy는 `02-frontend-architecture.md` §7/§13이 SSOT다.

07은 `queryOptions()`가 client-side server-state lifecycle의 SSOT라는 semantics만 정의한다.


`queryOptions()`가 소유하는 것:

```text
queryKey
queryFn
staleTime
기타 client Query lifecycle option
```

서버가 반드시 동일 queryFn을 사용할 필요는 없다.

---

# 8. 서버와 클라이언트가 공유하는 것은 Query Identity다

서버와 클라이언트는 동일한 data acquisition path를 공유하지 않는다.

서버:

```text
Service 직접 호출
```

클라이언트:

```text
ky → Route Handler → Service
```

둘을 연결하는 공통 identity는 Query key다.

```text
Service
= server data access의 application SSOT

queryOptions
= client server-state lifecycle의 SSOT

queryKey
= server-seeded data와 client Query를 연결하는 identity
```

---

# 9. 서버에서 queryOptions의 queryFn을 기본 실행하지 않는다

기본적으로 다음을 사용하지 않는다.

```ts
await queryClient.prefetchQuery(
  songQueries.detail(id),
);
```

그 이유는 `songQueries.detail(id).queryFn`이 client HTTP API를 호출하는 경우:

```text
RSC
 ↓
TanStack Query
 ↓
ky
 ↓
Route Handler
 ↓
Service
```

라는 불필요한 내부 HTTP round-trip이 생기기 때문이다.

06의 서버 내부 호출 원칙을 유지한다.

---

# 10. 기본 서버 패턴은 Service Fetch → Query Cache Seeding이다

Client에서도 같은 데이터를 계속 Query로 소비해야 한다면:

```text
RSC
 ↓
Service
 ↓
DTO
 ↓
queryClient.setQueryData(queryKey, dto)
 ↓
dehydrate
 ↓
HydrationBoundary
 ↓
Client useQuery / useSuspenseQuery
```

를 기본으로 한다.

예:

```tsx
export default async function SongPage({
  params,
}: Props) {
  const { id } = await params;

  const queryClient = getQueryClient();
  const ctx = await getRequestContext();

  const song = await getSong(ctx, { id });

  queryClient.setQueryData(
    songQueries.detail(id).queryKey,
    song,
  );

  return (
    <HydrationBoundary
      state={dehydrate(queryClient)}
    >
      <SongViewer id={id} />
    </HydrationBoundary>
  );
}
```

Client:

```tsx
const { data } = useSuspenseQuery(
  songQueries.detail(id),
);
```

---

# 11. RSC에서만 사용하는 데이터는 Query cache에 넣지 않는다

서버에서만 필요한 데이터라면:

```ts
const song = await getSong(ctx, input);
```

로 끝낸다.

사용하지 않는다:

```text
Service fetch
→ setQueryData
→ dehydrate
```

Client가 해당 데이터를 이어서 사용할 필요가 없다면 hydration은 불필요하다.

---

# 11.1. Mutable data는 Query-owned를 기본으로 한다

RSC-only 데이터는 해당 화면 lifecycle 동안 변경되지 않는 read에 한정하는 것을 기본으로 한다.

Client mutation이 화면에 표시 중인 데이터를 변경한다면 그 데이터는 가능한 한 Query-owned hydrated state로 둔다.

```text
mutable displayed server-state
→ Query-owned
→ mutation
→ invalidateQueries
→ refetch
```

RSC-only 데이터를 반드시 mutation과 함께 사용해야 하는 예외가 있다면 `router.refresh()`를 명시적으로 사용할 수 있다.
하지만 `router.refresh()`를 일반 mutation consistency mechanism으로 삼지 않는다.

판단 원칙:

```text
세션 중 변경될 가능성이 있고 Client mutation의 영향을 받는다
→ Query-owned hydrated data 우선

세션 중 사실상 불변이며 Client lifecycle이 필요 없다
→ RSC-only 가능
```

---

# 12. Client에서만 필요한 데이터는 서버에서 미리 가져오지 않는다

예:

```tsx
const { data } = useQuery(
  someQueries.interactiveState(...)
);
```

초기 HTML이나 RSC rendering에 필요하지 않고,
Client interaction 이후에만 필요한 데이터라면
RSC fetch를 강제하지 않는다.

---

# 13. 데이터 사용 패턴별 기본 결정

| 데이터 사용 패턴 | 서버 접근 | Query cache |
|---|---|---|
| RSC에서만 사용 | Service 직접 호출 | 사용 안 함 |
| RSC 초기 렌더 + Client에서 계속 사용 | Service 직접 호출 | `setQueryData` + dehydrate/hydrate |
| Client에서만 사용 | 서버 fetch 없음 | Client Query |
| Client mutation | Route Handler → Service | mutation 성공 후 `invalidateQueries` |

이 표가 기본 decision matrix다.

---

# 14. 페이지 종류로 전략을 고정하지 않는다

사용하지 않는 규칙:

```text
Public = RSC
Admin = TanStack Query
```

실제 페이지 안에서는 여러 전략이 섞일 수 있다.

예:

```text
Admin Song Editor

RSC
├─ initial shell
├─ auth/context
└─ initial song Service fetch

Hydrated Client
├─ useSuspenseQuery(song detail)
├─ RHF
├─ mutation
└─ invalidateQueries
```

Public viewer에서도 interactive server-state가 필요하면 Client Query를 사용할 수 있다.

---

# 15. Rendering strategy 판단 질문

데이터마다 다음을 확인한다.

```text
1. 초기 HTML에 필요한가?
2. SEO에 필요한가?
3. 서버에서만 소비되는가?
4. Client에서도 동일 데이터를 계속 소비하는가?
5. Client에서 refetch / stale / retry lifecycle이 필요한가?
6. mutation 이후 즉시 consistency가 필요한가?
7. 사용자별 데이터인가?
8. 같은 Query identity로 여러 컴포넌트가 재사용하는가?
```

RSC/Query 선택은 이 질문에 따라 결정한다.

---

# 16. Client가 이어서 소비한다면 Hydration을 고려한다

다음 조건이면 hydration 후보:

```text
RSC initial render에 데이터 필요
+
Client에서도 동일 server state를 계속 Query로 사용
```

예:

```text
song detail
album detail
editor resource
```

단, hydration 자체를 architecture ceremony로 강제하지 않는다.

Client에서 이후 동일 데이터를 사용하지 않으면 seed하지 않는다.

---

# 17. QueryClient 서버 lifecycle

서버에서는 request별 QueryClient isolation을 보장해야 한다.

사용하지 않는다:

```text
process-global shared QueryClient
```

이유:

```text
user A query cache
+
user B request
```

가 섞이면 사용자별 데이터 leak 위험이 있다.

서버에서는 request/render lifecycle에 맞는 QueryClient를 생성한다.

---

# 17.1. getQueryClient() 소유권

서버 hydration용 `getQueryClient()`는 request/render lifecycle마다 격리된 QueryClient를 제공한다.
TanStack Query의 공식 Next.js integration pattern을 따른다.

개념적으로:

```ts
export const getQueryClient =
  cache(() => new QueryClient());
```

여기서 `cache()`는 동일 server render/request 안에서 QueryClient 인스턴스를 재사용하기 위한 것이며 process-global cache가 아니다.

소유 위치는 전용 Query infrastructure module로 둔다.

```text
shared/api/query/
├─ query-client.ts
└─ get-query-client.ts
```

---

# 18. Client QueryClient lifecycle

브라우저에서는 application lifecycle 동안 동일 QueryClient instance를 유지한다.

QueryClient를 render마다 새로 만들지 않는다.

정확한 provider 구현은 TanStack Query 공식 Next.js integration pattern을 따른다.

프로젝트 전용 QueryClient wrapper framework는 만들지 않는다.

---

# 19. 사용자별 데이터 Cache Isolation

다음 데이터는 사용자 context에 종속된다.

```text
/api/me
permissions
admin resource
editor assignment
user-specific capability/rule
```

이 데이터는 public/shared cache로 취급하지 않는다.

TanStack Query key에는 resource identity를 포함하고,
서버 hydration 시 request별 QueryClient를 사용한다.

사용자별 query를 process-global QueryClient에 넣지 않는다.

---

# 20. Authz Rules Query

CASL rules / permissions는 사용자별 server-state다.

예:

```text
['me', 'permissions']
```

로그인/로그아웃/권한 변경 시 invalidate 대상이다.

403 self-healing 시:

```text
403
 ↓
permissions query invalidate
 ↓
refetch
 ↓
Ability 재생성
```

04 Auth/Authz Architecture를 따른다.

---

# 21. staleTime

`staleTime`은 데이터 종류별 freshness requirement를 표현한다.

프로젝트 전체에 하나의 magic staleTime을 강제하지 않는다.

예:

```text
거의 정적인 공개 metadata
→ 길게

관리 화면 목록
→ 중간

사용자 권한
→ 비교적 짧게

실시간에 가까운 상태
→ 짧게 또는 명시적 refetch
```

구체 수치는 각 queryOptions에 둔다.

---

# 22. gcTime

`gcTime`도 필요에 따라 Query option에 둔다.

기본값을 과하게 재정의하지 않는다.

실제 memory pressure 또는 navigation UX 문제가 확인될 때 조정한다.

---

# 23. Query key hierarchy

Query key는 02 Frontend Architecture의 규칙을 따른다.

예:

```text
['songs']
['songs', 'detail', id]
['songs', 'list', params]
```

Query key는 client cache identity다.

Server hydration 시 동일 key를 사용해야 한다.

---

# 24. Mutation key

Mutation key는 mutation identity / observability 용도다.

예:

```text
['song-mutation', 'update', id]
```

Mutation key를 Query invalidation source로 사용하지 않는다.

---

# 25. Mutation 이후 consistency

기본:

```text
mutation success
 ↓
queryClient.invalidateQueries(...)
 ↓
refetch
 ↓
cache convergence
```

예:

```ts
const mutation = useMutation({
  ...songMutations.update(song.id),

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey:
        songQueries.detail(song.id).queryKey,
    });
  },
});
```

Invalidation 대상은 mutation이 실제로 영향을 준 Query identity를 기준으로 명시한다.

---

# 26. Invalidation automation framework를 만들지 않는다

사용하지 않는다:

```text
meta.invalidates
InvalidationRegistry
MutationEventBus
custom cache dependency graph
```

TanStack Query의 기본 API를 사용한다.

```text
onSuccess
invalidateQueries
setQueryData
```

---

# 27. Optimistic Update

기본값은 invalidation/refetch다.

Optimistic update는 UX 이득이 명확한 경우에만 사용한다.

고려 조건:

```text
network latency가 체감되는가
rollback logic이 단순한가
conflict 가능성이 낮은가
UI 즉시 반응이 중요한가
```

Editor의 revision/conflict가 중요한 write에서는
optimistic update를 무조건 사용하지 않는다.

---

# 28. setQueryData 사용 원칙

`setQueryData`는 두 용도로 사용할 수 있다.

1. RSC Service result를 Client Query cache에 seed
2. mutation 결과가 authoritative하고 즉시 cache 반영이 안전한 경우

단순히 refetch를 피하기 위해 무조건 사용하지 않는다.

---

# 29. Server Query prefetchQuery 예외

기본 패턴은 Service fetch + `setQueryData`다.

다만 queryFn 자체가 서버에서도 자연스럽고
내부 HTTP round-trip이 없으며
server/client 양쪽에서 동일한 acquisition path를 공유하는 query가 실제 생기면
`prefetchQuery()`를 사용할 수 있다.

현재 architecture의 기본값은 아니다.

예외는 evidence가 있을 때만 추가한다.

---


# 29.1. Query Retry Policy

Query retry는 client server-state lifecycle의 일부이므로 07이 소유한다.

기본 정책:

```text
4xx ApiError
→ retry 하지 않음

ClientContractError
→ retry 하지 않음

network failure
→ 제한적 retry

5xx
→ 제한적 retry
```

다음은 기본적으로 retry 대상이 아니다.

```text
400 validation
401 unauthenticated
403 forbidden
404 not found
409 conflict
ClientContractError
```

retry 가능한 대표 후보:

```text
transient network failure
502 / 503 / 504
일시적 upstream failure
```

`ky`와 TanStack Query가 동일 요청을 각각 반복 재시도해
retry 횟수가 곱연산으로 늘어나지 않게 한다.

기본 원칙:

```text
HTTP transport retry
→ ky에서 최소화하거나 명시적으로 제한

server-state lifecycle retry
→ TanStack Query가 소유
```

특정 endpoint의 idempotency / upstream 특성 때문에 ky retry가 필요한 경우
그 endpoint에서 명시적으로 결정한다.

Mutation은 side effect 특성상 automatic retry를 기본값으로 삼지 않는다.
idempotency가 명확하고 실제 요구가 있을 때만 별도로 허용한다.

09는 retry 가능 여부를 재정의하지 않고 이 정책을 참조해 UX만 결정한다.

---

# 29.2. Ky transport 구현 제약

M4의 `shared/api` Ky instance는 Client Component의 `/api/*` HTTP transport만 담당한다.
RSC와 server service는 Ky 또는 localhost HTTP를 사용하지 않고 service를 직접 호출한다.

```text
Client Query의 queryFn signal
→ Ky request의 signal로 그대로 전달
→ 더 이상 필요한 request를 취소할 수 있어야 함
```

취소 lifecycle을 가리는 별도 `AbortController`를 만들거나, signal을 받지 않는 wrapper를 만들지
않는다. timeout, credentials, prefix URL 같은 transport option은 암묵적 기본값에 기대지 말고
요청 성격과 보안 요구가 확인된 위치에서 명시한다.

Ky hook은 실제로 반복되는 transport concern이 확인된 경우에만 작고 투명하게 사용한다.
domain rule, authorization 판단, response DTO mapping, 전역 token-refresh/retry framework를 hook에
넣지 않는다. M5 auth 경계가 확정되기 전에는 authorization header나 refresh retry를 선제 도입하지
않는다.

일반 JSON API용 Ky instance에 waveform source 등 대용량 파일 upload/download 정책을 섞지 않는다.
progress, object storage, resumable upload, retry/idempotency가 필요한 경우 해당 전송 protocol과
사용자 경험을 별도 설계한 뒤 전용 adapter를 둔다.

---

# 30. Suspense Query

초기 hydration 데이터가 있고
컴포넌트가 loading branch를 직접 관리할 필요가 없다면
`useSuspenseQuery()`를 우선 고려한다.

예:

```tsx
const { data } = useSuspenseQuery(
  songQueries.detail(id),
);
```

하지만 모든 Query를 Suspense로 강제하지 않는다.

interaction 이후 fetch나 optional panel에서는 `useQuery()`가 더 자연스러울 수 있다.

---

# 31. Error Boundary와 Query

Query error UX는 03 API/Error Architecture와 09 Error UX/Observability 문서의 규칙을 따른다.

대략:

```text
ApiError
→ expected HTTP/application failure

ClientContractError
→ system failure

unexpected network/runtime failure
→ generic failure
```

Query ErrorBoundary 사용 여부는 화면 UX 요구에 맞춘다.

---

# 32. RSC error semantics

RSC Service 호출에서:

```text
NOT_FOUND
→ notFound()

UNAUTHENTICATED
→ login redirect

FORBIDDEN
→ forbidden/error boundary 정책

unexpected
→ server error boundary + Sentry
```

03 / 04의 의미를 그대로 사용한다.

RSC에서 Query cache seeding 전에 Service가 실패하면
실패한 data를 hydrate하지 않는다.

---

# 33. Hydration과 DTO contract

서버가 seed하는 data는 external/shared DTO contract를 사용한다.

```text
Repository Row
 ↓
Service
 ↓
DTO
 ↓
setQueryData
 ↓
dehydrate
```

Drizzle row를 그대로 Query cache에 넣지 않는다.

05 Contract / Validation Architecture를 따른다.
Hydration을 위해 seed하는 DTO는 **JSON-serializable value**여야 한다.

기본적으로 다음을 Query hydration payload에 넣지 않는다.

```text
Date instance
Map
Set
BigInt
class instance
function
DB driver object
```

날짜는 contract에서 정한 string/number representation으로 전달한다.


---

# 34. 서버에서 client HTTP queryFn을 재사용하지 않는 이유

Client queryFn은 다음 책임을 가진다.

```text
HTTP request
HTTP error normalization
response contract validation
```

서버 Service 호출에는 이 HTTP boundary가 필요 없다.

따라서 acquisition path를 억지로 통일하지 않는다.

```text
same query identity
≠
same acquisition path
```

---

# 35. Query option code ownership

`queryOptions()` 구현은 Entity API layer가 소유한다.

예:

```text
entities/song/api/queries.ts
```

RSC는 이 options 객체의 `.queryKey`를 사용할 수 있다.

하지만 RSC용 별도:

```text
songServerQueries
songRscQueries
```

같은 duplicate factory를 만들지 않는다.

---

# 36. Data mapping ownership

서버 Service 결과와 Client HTTP response는 동일 DTO contract를 만족해야 한다.

서버:

```text
Service → SongDto
```

클라이언트:

```text
HTTP unknown
→ parseClientResponse(songDtoSchema)
→ SongDto
```

Query cache에는 결과적으로 동일한 `SongDto` shape가 들어간다.

---

# 37. Server seed helper를 만들 것인가

초기에는 다음을 직접 사용한다.

```ts
queryClient.setQueryData(
  songQueries.detail(id).queryKey,
  song,
);
```

다음과 같은 generic abstraction은 만들지 않는다.

```text
seedQuery()
hydrateEntity()
prefetchServiceQuery()
serverQueryBridge()
```

반복이 실제로 충분히 생기면 작은 helper를 재검토한다.

---

# 38. Hydration boundary 위치

HydrationBoundary는 가능한 한 해당 hydrated data를 실제로 소비하는 subtree 가까이에 둔다.

무조건 root layout 전체를 dehydrate/hydrate하지 않는다.

목적:

```text
불필요한 serialized cache 최소화
사용자별 cache 범위 명확화
data ownership 명확화
```

---

# 39. 여러 Query seed

한 페이지에서 여러 Client Query가 initial data를 필요로 하면
같은 request QueryClient에 여러 data를 seed할 수 있다.

```ts
queryClient.setQueryData(
  albumQueries.detail(albumId).queryKey,
  album,
);

queryClient.setQueryData(
  songQueries.list(albumId).queryKey,
  songs,
);
```

그 후 한 번 dehydrate할 수 있다.

---

# 40. Waterfall 방지

서로 독립적인 Service read는 필요하면 병렬로 수행한다.

예:

```ts
const [album, songs] =
  await Promise.all([
    getAlbum(ctx, input),
    getSongs(ctx, input),
  ]);
```

단 transaction consistency가 필요한 read를 무조건 병렬화하지 않는다.

---

# 41. Query dependency

Query A 결과가 Query B input에 필요한 경우
Client에서는 `enabled`, component composition, Suspense boundary 등을 사용한다.

프로젝트 전용 dependency scheduler를 만들지 않는다.

---

# 42. Public data와 user-specific data

Public data:

```text
song
album
published lyrics
```

User-specific data:

```text
permissions
editor workspace
draft state
assignment
```

둘 다 TanStack Query cache를 사용할 수 있지만
서버 hydration에서는 user-specific data의 request isolation이 특히 중요하다.

---

# 43. SEO

SEO가 필요하다는 이유만으로 Query를 금지하지 않는다.

초기 HTML에 필요한 데이터를 RSC Service fetch로 확보하면 된다.

Client에서도 동일 data lifecycle이 필요하면 hydrate한다.

```text
SEO
→ RSC initial data acquisition

Client lifecycle
→ TanStack Query hydration
```

둘은 양립할 수 있다.

---

# 44. Navigation

Client navigation 이후 Query cache가 fresh하면
동일 queryKey data를 재사용할 수 있다.

freshness는 `staleTime`이 결정한다.

navigation 자체 때문에 Query를 강제로 invalidate하지 않는다.

---

# 45. Refresh

브라우저 hard refresh에서는 Client Query cache는 새로 시작한다.

필요한 초기 data는 RSC가 Service를 통해 다시 읽고
필요하면 hydrate한다.

Next Data Cache를 사용하지 않으므로
서버 shared application cache에 의존하지 않는다.

---

# 46. Route Rendering Mode

v1에서는 **DB 데이터를 렌더링하는 route를 dynamic rendering으로 처리하는 것을 기본값**으로 한다.

이 결정은 Next Data Cache를 사용하지 않는다는 상위 원칙의 직접적인 귀결이다.

```text
DB 변경
→ TanStack Query invalidate
```

는 Client Query cache만 갱신한다. Static/ISR로 prerender된 HTML은 자동으로 갱신되지 않는다.

따라서 public route라고 해서 자동으로 static/ISR을 선택하지 않는다.

기본:

```text
DB-backed page
→ dynamic rendering
→ request 시 Service 직접 read
```

이 프로젝트는 OCI 단일 서버 환경에서 v1 트래픽 규모 동안 per-request SSR 비용을 수용한다.

향후 실제 트래픽/성능 측정 결과 ISR이 필요해진다면 별도 architecture decision으로 재검토한다. 그 경우 먼저 time-based revalidate와 허용 가능한 staleness window를 명시적으로 선택하는 방식을 검토한다. 현재 금지한 `revalidatePath()` / `revalidateTag()` 기반 application consistency를 기본 전략으로 되돌리지 않는다.

`getRequestContext()`나 cookie 접근 때문에 route가 결과적으로 dynamic이 되는 것은 구현상의 부수효과일 뿐, 이 architectural decision을 대체하지 않는다.

외부 `fetch()`가 추가되는 경우 해당 fetch cache semantics는 별도 검토한다.

---



# 46.1. ISR 확장 규칙

v1에서는 DB-backed route의 dynamic rendering을 기본값으로 유지한다.

ISR은 기본 전략이 아니라 **실제 SSR 비용이 병목으로 확인된 뒤 선택하는 확장 전략**이다.

ISR 도입 조건은 다음을 모두 만족하는 경우를 우선한다.

```text
public data
+
read-heavy route
+
일정 시간 stale 허용 가능
+
per-request SSR 비용이 실제 병목
```

첫 도입은 **time-based ISR**을 우선한다.

예:

```ts
export const revalidate = 60;
```

이 선택은 다음 제품 의미를 가진다.

```text
해당 route는 최대 약 60초의 staleness를 허용한다.
```

ISR을 도입해도 다음 구조는 바뀌지 않는다.

```text
RSC
 ↓
Service
 ↓
Repository
 ↓
DB
```

바뀌는 것은 RSC output을 Next.js가 얼마나 오래 재사용하느냐뿐이다.

## 46.1.1. ISR 우선 후보

가장 단순한 ISR 후보는 다음 성질의 route다.

```text
public
+
read-heavy
+
RSC-only
+
client Query lifecycle 불필요
+
staleness 허용
```

예:

```text
Public Song Viewer
Public Album Detail
```

단 실제 route classification에서 data lifecycle을 확인한 뒤 결정한다.

## 46.1.2. ISR + Hydration

ISR route에서 hydrated Query를 함께 사용하면
ISR snapshot과 TanStack Query freshness가 겹친다.

```text
ISR HTML snapshot
+
dehydrated Query snapshot
+
client staleTime
```

따라서 ISR route에서 Query hydration을 사용한다면
route revalidation window와 query `staleTime`을 함께 설계해야 한다.

예:

```text
ISR window = 60s
Query staleTime = 5m
```

처럼 두 freshness window를 무심코 겹치지 않는다.

Hydrated client Query가 최신성 회복 경로라면
짧은 `staleTime` 또는 immediate background refetch를 고려한다.

가능하다면 ISR 대상 public read-only route는
Query hydration 없이 RSC-only로 유지하는 것을 우선한다.

## 46.1.3. On-demand Revalidation

다음 요구가 생기기 전에는 on-demand revalidation을 도입하지 않는다.

```text
admin publish/update 직후
public prerendered route도 즉시 최신 상태가 되어야 함
```

이 요구가 실제로 생기면 별도 architecture decision으로:

```text
TanStack Query invalidation
= interactive client state consistency

Next route revalidation
= public prerender consistency
```

역할을 분리한다.

그때에만 다음 API 도입을 재검토한다.

```text
revalidatePath
revalidateTag
```

이 경우에도 Query invalidation과 Next route invalidation을
하나의 custom invalidation framework로 합치지 않는다.

## 46.1.4. ISR 도입 원칙

1. ISR은 성능 문제에 대한 evidence가 있을 때만 도입한다.
2. public + read-heavy + stale 허용 route를 우선한다.
3. 최초 도입은 time-based ISR을 우선한다.
4. staleness window를 제품 요구로 명시한다.
5. ISR + hydration 시 freshness window를 함께 설계한다.
6. 가능하면 ISR route는 RSC-only read로 유지한다.
7. 즉시 반영 요구가 생길 때만 on-demand revalidation을 추가한다.
8. Query invalidation과 route revalidation의 역할을 섞지 않는다.
9. on-demand revalidation 도입은 별도 architecture decision으로 기록한다.
10. 현재 v1의 dynamic rendering 기본값은 유지한다.

---

# 47. Route Classification은 문서 후반부에 둔다

07의 원칙을 먼저 정의한 뒤
실제 oioi-bwg route를 data usage 기준으로 분류한다.

예:

```text
Home
Song Viewer
Album Detail
Admin Song List
Admin Song Editor
Translation Workspace
Login
```

각 route에서:

```text
RSC-only data
Hydrated Query data
Client-only Query data
Mutation
```

를 구분한다.

---


## 47.1. Route Classification의 지위

§47~48의 route classification은 **active architecture의 적용 부록**이다.

다음 상위 원칙은 이미 active decision으로 사용한다.

```text
Next Data Cache 미사용
DB-backed route dynamic 기본
RSC → Service 직접 호출
mutable displayed data → Query-owned 우선
Service fetch → setQueryData → hydrate
mutation → invalidateQueries
```

개별 route classification은 migration 과정에서 실제 data lifecycle을 확인하며 채운다.

따라서 route classification이 미완성이라는 이유로
이 문서의 active status 또는 구현 착수를 막지 않는다.

반대로 구현 중 특정 route가 상위 원칙의 예외를 필요로 한다면
그 예외를 먼저 architecture decision으로 기록한 뒤 classification에 반영한다.

---

# 48. 초기 route 적용 예시

## Public Song Viewer

가능한 패턴:

```text
RSC
→ getSong(Service)

Client에서도 동일 SongDto 필요
→ setQueryData
→ hydrate

Client
→ useSuspenseQuery(songQueries.detail(id))
```

단 viewer가 서버 렌더 결과만으로 충분하면 hydration을 생략할 수 있다.

---

## Admin Song Editor

가능한 패턴:

```text
RSC
→ auth context
→ getEditableSong(Service)
→ setQueryData
→ hydrate

Client
→ useSuspenseQuery
→ RHF
→ mutation
→ invalidate detail/list query
```

Admin이라는 이유가 아니라
Client server-state lifecycle이 필요하기 때문에 Query를 사용한다.

---

# 49. 금지 패턴

기본적으로 피한다.

```text
RSC → localhost HTTP → Route Handler

RSC → client ky queryFn via prefetchQuery

Repository → updateTag/revalidatePath

Mutation → Next cache invalidation + Query invalidation 이중 관리

process-global server QueryClient

Drizzle row → setQueryData

페이지 종류만으로 RSC/Query 결정

queryOptions duplicate server factory
```

---

# 50. 최종 헌법

1. Application server-state cache는 TanStack Query 하나로 통일한다.
2. Next Data Cache는 사용하지 않는다.
3. React `cache()` request memoization은 별개로 사용할 수 있다.
4. 서버 데이터 접근의 application SSOT는 Service다.
5. RSC는 자기 HTTP API를 호출하지 않는다.
6. Client Query는 HTTP boundary를 사용한다.
7. `queryOptions()`는 client server-state lifecycle의 SSOT다.
8. 서버와 클라이언트는 동일 queryFn이 아니라 동일 query identity를 공유한다.
9. Query key가 server-seeded data와 client Query를 연결한다.
10. 서버에서 client HTTP queryFn을 실행하는 `prefetchQuery()`는 기본 패턴이 아니다.
11. Client가 이어서 소비할 data는 Service fetch 후 `setQueryData()`로 seed한다.
12. Seed된 cache는 `dehydrate()` / `HydrationBoundary`로 Client에 전달한다.
13. RSC에서만 쓰는 data는 Query cache에 넣지 않는다.
14. Client에서만 필요한 data는 RSC에서 미리 fetch하지 않는다.
15. route category가 아니라 data access pattern으로 rendering strategy를 결정한다.
16. 서버 QueryClient는 request별로 격리한다.
17. 브라우저 QueryClient는 application lifecycle 동안 유지한다.
18. 사용자별 data를 process-global cache에 저장하지 않는다.
19. `staleTime`은 query별 freshness requirement를 표현한다.
20. Mutation success 이후 `invalidateQueries()`로 consistency를 맞춘다.
21. Mutation key는 invalidation source가 아니다.
22. Cache invalidation framework를 새로 만들지 않는다.
23. Optimistic update는 UX 이득이 명확한 경우에만 사용한다.
24. Query cache에는 external DTO contract를 넣는다.
25. Drizzle row를 Query cache에 직접 넣지 않는다.
26. HydrationBoundary는 필요한 subtree 가까이에 둔다.
27. 같은 request에서 여러 Query를 seed할 수 있다.
28. 독립적인 Service read는 필요하면 병렬화한다.
29. SEO와 TanStack Query는 대립 관계가 아니다.
30. 초기 HTML은 RSC, 이후 server-state lifecycle은 Query가 담당할 수 있다.
31. Server-only, hydrated, client-only data를 명시적으로 구분한다.
32. `setQueryData()` bridge를 generic helper로 먼저 감싸지 않는다.
33. 동일 queryOptions factory를 server/client용으로 복제하지 않는다.
34. 실제 route classification은 이 원칙에 대입해 결정한다.
35. 한 문제에 두 cache vocabulary를 만들지 않는다.
36. DB-backed route는 v1에서 dynamic rendering을 기본으로 한다.
37. Static/ISR은 실제 성능 요구와 허용 staleness window가 확인된 뒤 별도 결정으로 도입한다.
38. Client mutation의 영향을 받는 화면 데이터는 Query-owned hydrated state를 우선한다.
39. `router.refresh()`는 RSC-only mutable data의 예외적 동기화 수단이지 기본 consistency mechanism이 아니다.
40. 서버 hydration용 QueryClient는 request/render lifecycle마다 격리한다.
41. Hydration seed DTO는 JSON-serializable value만 사용한다.
42. ISR은 실제 SSR 병목과 staleness 허용이 확인된 뒤 도입한다.
43. ISR 최초 도입은 time-based revalidation을 우선한다.
44. ISR + Query hydration은 route revalidation window와 query staleTime을 함께 설계한다.
45. On-demand revalidation은 즉시 public prerender 반영 요구가 생길 때만 별도 architecture decision으로 추가한다.
46. Query invalidation과 Next route revalidation은 서로 다른 consistency mechanism으로 유지한다.
47. Route classification은 구현 과정에서 채우는 적용 부록이며 active 원칙의 선행 조건이 아니다.
