# Next.js + TanStack Query Data Layer Refactoring Prompt

현재 프로젝트는 **Next.js 16 App Router + RSC + FSD + TanStack Query + Ky + Zod**를 사용한다.

이번 리팩터링의 목적은 **Next.js와 TanStack Query의 기능을 최대한 사용하는 것이 아니라, 서버/클라이언트 데이터 레이어의 역할을 명확히 나누고 각 페이지와 데이터의 실제 lifecycle에 맞춰 가장 단순한 데이터 흐름을 선택하는 것​**이다.

최종 목표는 가장 추상적인 구조를 만드는 것이 아니다.

> 코드베이스를 처음 보는 개발자가 프레임워크와 라이브러리의 표준 지식만으로 데이터 흐름을 최대한 쉽게 이해할 수 있게 만든다.

아키텍처적 대칭성을 만들기 위해 서버와 클라이언트의 데이터 레이어를 억지로 통합하지 않는다.

기본 경로는 가장 단순하게 유지한다.

`prefetch`, `dehydrate`, `HydrationBoundary`, `Suspense`, streaming, DI 등의 복잡성은 실제 유즈케이스가 그 비용을 정당화할 때만 추가한다.

---

# 1. 핵심 개발 원칙

다음 원칙을 최우선으로 적용하라.

1. 바퀴를 재발명하지 않는다.
2. KISS를 우선한다.
3. DRY는 코드 중복이 아니라 **지식 중복을 줄이는 방향**으로 적용한다.
4. SSOT가 필요한 정보만 단일 원천으로 관리한다.
5. SOLID는 경계를 명확히 하기 위한 수단으로만 사용한다.
6. 추상화는 실제 반복과 변경 패턴이 확인된 뒤 도입한다.
7. 프레임워크와 라이브러리의 공식 API와 실행 모델을 우선한다.
8. 프로젝트 전용 framework, generic executor, provider hierarchy를 만들지 않는다.
9. 기능적으로 동일해 보여도 변화 이유가 다르면 억지로 공유하지 않는다.
10. 복잡성을 추가할 때는 그 복잡성이 해결하는 실제 문제를 설명할 수 있어야 한다.
11. server/client 대칭성을 목표로 하지 않는다.
12. 필요한 데이터 lifecycle에 맞는 가장 단순한 경로를 선택한다.
13. 실제 문제가 없는 코드는 구조적 미학만을 위해 변경하지 않는다.
14. hydration / prefetch / Suspense / streaming은 opt-in으로 취급한다.
15. 변경 전후 behavior와 타입 안정성을 테스트한다.

추상화를 추가하기 전에 반드시 다음 질문을 한다.

> 이 구조를 제거하고 평범한 코드 몇 줄을 중복하면 실제로 더 나쁜가?

답이 명확하지 않다면 추상화를 추가하지 않는다.

---

# 2. 프로젝트의 두 가지 주요 영역

프로젝트 페이지는 크게 두 종류로 나눈다.

## Public `(user)`

특징:

- SEO 중요
- 앨범, 곡, 가사, 응원법 등의 공개 콘텐츠
- 대부분 read-heavy
- 수정 빈도 낮음
- 일부 UI는 매우 interactive함
- 로그인하지 않은 사용자도 접근

기본 전략:

```text
RSC
 ↓
server service
 ↓
repository
 ↓
DB / external API
```

데이터가 Client Component에서도 필요하지만 브라우저에서 별도의 server-state lifecycle은 없다면:

```text
RSC
 ↓
server service
 ↓
props
 ↓
Client Component
```

Client Component라는 이유만으로 TanStack Query를 사용하지 않는다.

Public 영역에서는 대체로:

```text
server-owned data
+
RSC
+
필요한 경우 Next server cache
```

를 우선한다.

---

## Admin `(admin)`

특징:

- 로그인 이후 접근
- role / permission 기반
- SEO 불필요
- CRUD와 사용자 상호작용이 많음
- mutation 이후 refetch / invalidation이 빈번함
- client-side server-state lifecycle이 존재

기본 전략:

```text
Client Component
 ↓
TanStack Query
 ↓
Ky
 ↓
Route Handler / Backend API
 ↓
server service
 ↓
repository
 ↓
DB
```

Admin 영역은 SPA-like application으로 취급해도 된다.

RSC는 주로 다음 서버 경계에 사용한다.

- 인증
- 권한 확인
- redirect
- layout
- shell

Admin의 CRUD 데이터는 기본적으로 TanStack Query가 ownership을 가진다.

---

# 3. 데이터 소유권 판단 기준

각 데이터마다 먼저 다음 질문을 한다.

```text
1. 이 데이터는 서버에서 조회 후 렌더링하면 끝나는가?
2. SEO 또는 초기 HTML에 포함되어야 하는가?
3. 첫 서버 렌더에 반드시 데이터가 필요한가?
4. Client Component에서 단순 표시/상호작용에만 사용하는가?
5. 브라우저에서 refetch가 필요한가?
6. mutation 이후 invalidation이 필요한가?
7. polling이 필요한가?
8. pagination / infinite query가 필요한가?
9. optimistic update가 필요한가?
10. 사용자별로 달라지는 client server-state인가?
11. client-side server-state lifecycle이 실제로 존재하는가?
```

판단 결과에 따라 아래 중 가장 단순한 방식을 선택한다.

---

## RSC-only 데이터

```text
RSC
 ↓
server service
 ↓
repository / external API
```

TanStack Query를 사용하지 않는다.

예:

```ts
const song = await getSongDetailBySlug(slug);
```

서버에서 조회한 뒤 렌더링하면 끝나는 데이터라면 이것으로 끝낸다.

---

## Client Component가 필요하지만 client data lifecycle은 없는 데이터

```text
RSC
 ↓
server service
 ↓
props
 ↓
Client Component
```

예:

```tsx
const song = await getSongDetailBySlug(slug);

return (
  <LyricsViewerClient
    song={song}
  />
);
```

Client Component라는 사실과 Client Data Fetching은 같은 개념이 아니다.

---

## Client lifecycle이 있는 데이터

```text
Client Component
 ↓
TanStack Query
 ↓
Ky
 ↓
Backend API / Route Handler
```

다음 경우에 TanStack Query 사용을 우선한다.

- refetch
- invalidation
- mutation
- polling
- pagination
- infinite query
- optimistic update
- 브라우저에서 지속적으로 관리되는 server state
- 사용자별 server-state

---

## Server initial render + Client lifecycle이 모두 필요한 데이터

이 경우에만 다음 패턴을 검토한다.

```text
RSC
 ↓
prefetchQuery
 ↓
dehydrate
 ↓
HydrationBoundary
 ↓
useQuery / useSuspenseQuery
 ↓
client lifecycle
```

이 패턴을 기본값으로 만들지 않는다.

Hydration을 사용하는 경우 RSC는 가능하면 loader / prefetch 역할만 담당하고, 동일 데이터를 RSC와 Client Component 양쪽에서 중복 렌더링하지 않는다.

---

# 4. Cache Ownership

같은 데이터에 Next cache와 TanStack Query cache를 동시에 적용하기 전에 **누가 해당 데이터의 lifecycle을 소유하는지 먼저 결정한다.**

## Server-owned

예:

```text
CMS content
SEO content
앨범 정보
곡 정보
가사
응원법
read-heavy public data
```

사용:

```text
RSC
+
Next server cache
```

브라우저에서 지속적인 server-state lifecycle이 없다면 TanStack Query를 추가하지 않는다.

---

## Client-owned

예:

```text
Admin CRUD
댓글
좋아요
필터
pagination
polling
mutation lifecycle
사용자별 데이터
```

사용:

```text
TanStack Query
```

---

## Client-owned + initial server render 필요

예:

```text
SEO가 필요한 목록
무한 스크롤 첫 페이지
초기 검색 결과
공개 댓글
```

사용:

```text
RSC prefetch
 ↓
hydrate
 ↓
TanStack Query ownership
```

단, 실제로 이후 client refetch / mutation / invalidation 등의 lifecycle이 존재할 때만 적용한다.

---

# 5. TanStack Query 사용 원칙

TanStack Query는 기본적으로 **Client Component의 server-state 관리 도구**로 본다.

주요 사용처:

- Admin CRUD
- mutation
- mutation 이후 invalidation
- client refetch
- polling
- infinite query
- pagination
- 사용자별 server-state
- optimistic update

단순 RSC 조회에는 TanStack Query를 넣지 않는다.

다음과 같은 흐름을 만들지 않는다.

```text
RSC에서 데이터가 필요함
 ↓
TanStack Query를 쓰고 싶음
 ↓
server queryOptions 필요
 ↓
client/server queryFn 분리
 ↓
factory
 ↓
DI
 ↓
prefetch
 ↓
dehydrate
 ↓
HydrationBoundary
```

실제 client query lifecycle이 없다면:

```ts
const song = await getSongDetailBySlug(slug);
```

로 끝낸다.

TanStack Query를 서버 application layer로 사용하지 않는다.

---

# 6. queryOptions / mutationOptions

현재 `entities/*/api`의 TanStack Query vocabulary를 유지한다.

예:

```ts
songQueries.detail(slug)

songQueries.adminList()

songMutations.create()

songMutations.update()
```

TanStack Query를 특별한 가치 없이 프로젝트 전용 custom hook으로 감추지 않는다.

피해야 할 형태:

```ts
useSong()
useSongDetail()
useAdminSongs()
prefetchSong()
```

특별한 abstraction value가 없다면 TanStack Query의 공식 vocabulary를 그대로 사용한다.

---

# 7. queryOptions 공유 원칙

Next.js의 Client Component가 import한 모듈은 client module graph에 포함된다.

따라서 공용 query module에 server runtime dependency가 들어가면 안 된다.

다음 패턴은 금지한다.

```ts
export const postQuery = (id: string) =>
  queryOptions({
    queryKey: postKeys.detail(id),
    queryFn: () => serverPostService.getDetail(id),
  });
```

공용 query module에서 다음 의존성을 직접 import하지 않는다.

```text
server-only
next/headers
cookies
DB
repository
server service
browser-only API
```

Ky client 역시 universal query definition에 무조건 끼워 넣지 않는다.

실제 사용 runtime과 ownership을 기준으로 분리한다.

---

# 8. 기본 공유 단위

다음 항목은 공유 가치가 높다.

```text
Zod schema
schema-derived domain type
query key
domain contract
business rule
validation rule
필요한 경우 query policy
```

예:

```ts
export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type Post =
  z.output<typeof PostSchema>;

export const postKeys = {
  all: ['posts'] as const,

  detail: (id: string) =>
    [...postKeys.all, 'detail', id] as const,
};
```

공유해야 하는 것은 단순히 동일하게 생긴 코드가 아니라 **동일한 지식과 동일한 변화 이유**다.

---

# 9. Query Key

Query Key는 transport와 분리된 **TanStack Query cache identity 계약**으로 유지한다.

예:

```ts
export const songQueryKeys = {
  all: ['songs'] as const,

  detail: (slug: string) =>
    ['songs', 'detail', slug] as const,

  adminList: ['songs', 'admin', 'list'] as const,
};
```

`query-keys.ts`는 universal module이어도 된다.

다만 universal module이라는 이유로 server에서도 반드시 사용해야 하는 것은 아니다.

주 사용처는 TanStack Query client cache다.

역할:

```text
browser server-state identity
cache lookup
partial invalidation
refetch
```

---

# 10. TanStack Query key와 Next cache identity는 분리한다

다음은 동일한 개념이 아니다.

```text
TanStack Query queryKey
≠
Next.js server cache key
≠
cacheTag
≠
HTTP route
≠
DB key
```

TanStack Query key 예:

```ts
['posts', 'detail', id]
```

Next.js `use cache`의 실제 cache identity는 프레임워크가 함수와 arguments 등을 기반으로 관리한다.

개발자가 직접 관리할 것은 주로:

```text
cacheTag
cacheLife
function arguments
```

이다.

예:

```ts
async function getPost(id: string) {
  'use cache';

  cacheTag(
    'posts',
    `post:${id}`,
  );

  return postService.getDetail(id);
}
```

Query Key와 Next cache tag의 vocabulary는 유사하게 유지할 수 있다.

예:

```ts
export const postKeys = {
  all: ['posts'] as const,

  detail: (id: string) =>
    ['posts', 'detail', id] as const,
};

export const postTags = {
  all: 'posts',

  detail: (id: string) =>
    `post:${id}`,
};
```

하지만 구현 형식은 각 캐시 시스템에 맞춘다.

다음 패턴은 금지한다.

```ts
cacheTag(
  JSON.stringify(
    postKeys.detail(id),
  ),
);
```

TanStack Query key schema를 애플리케이션 전체 cache protocol로 승격시키지 않는다.

`CacheKeyFactory` 같은 abstraction으로 두 시스템을 억지로 통합하지 않는다.

---

# 11. Mutation

Mutation은 현재 구조에서는 기본적으로 client-only다.

```text
Client
 ↓
mutationOptions
 ↓
Ky
 ↓
Route Handler / Backend API
 ↓
server service
```

RSC에 대응되는 `mutationOptions`를 만들지 않는다.

Server Action, Route Handler 또는 다른 서버 코드에서 write가 필요하다면 server use case / service를 직접 호출한다.

```text
Server Action / Route Handler
 ↓
service
 ↓
repository
```

TanStack Query를 서버 application layer로 사용하지 않는다.

---

# 12. Global Error Handling

Client QueryClient는 기존 정책을 유지한다.

```text
MutationCache
 ↓
global error toast
```

개별 mutation에서 다른 UX가 필요하면 `meta` escape hatch를 사용한다.

예:

```ts
meta: {
  skipGlobalError: true,
}
```

또는:

```ts
meta: {
  errorMessage: '...',
}
```

프로젝트 전용 Result / neverthrow / error wrapper hierarchy를 새로 추가하지 않는다.

현재 다음 vocabulary를 우선한다.

```text
ApiError
contract error
native Promise throw
TanStack Query native error flow
```

라이브러리가 이미 제공하는 error lifecycle을 프로젝트 전용 framework로 다시 만들지 않는다.

---

# 13. Public 페이지의 Client Component

중요:

> Client Component와 Client Data Fetching은 같은 개념이 아니다.

Client Component가 다음 이유로 필요할 수 있다.

- local state
- event handler
- animation
- browser API
- YouTube API
- clipboard
- analytics
- scrolling
- media playback
- interactive UI

이 경우 서버 데이터는 props로 전달하는 것을 기본값으로 한다.

```tsx
const song = await getSongDetailBySlug(slug);

return (
  <LyricsViewerClient
    song={song}
  />
);
```

다음 구조로 만들 필요가 없다.

```text
RSC fetch
→ prefetch
→ dehydrate
→ HydrationBoundary
→ useQuery
→ Client Component
```

Client Component가 데이터를 다시 fetch / refetch / invalidate할 필요가 없다면 props가 기본값이다.

---

# 14. 곡 상세 페이지의 현재 판단

현재 곡 상세 페이지는 다음 데이터 흐름이 가장 적절하다.

```text
DB
 ↓
song repository
 ↓
song service
 ↓
SongDetailPage (RSC)
 ↓
props
 ↓
LyricsViewerClient
```

`LyricsViewerClient`는 큰 Client Component지만 현재 기능 특성상 합리적이다.

내부 기능이 강하게 결합되어 있다.

```text
YouTube Player
      ↓
currentTime
      ↓
active lyric
      ↓
active segment
      ↓
automatic scrolling
      ↓
GSAP animation
```

추가로:

- lyric click → YouTube seek
- clipboard share
- analytics
- ad detection
- accordion
- browser state

등이 하나의 interaction unit을 구성한다.

따라서 단순히 Client Component가 크다는 이유로 Server Component와 여러 Client Component로 억지로 분해하지 않는다.

컴포넌트 분리는 실제 책임 분리, 독립적인 lifecycle, 유지보수 이점이 있을 때 수행한다.

---

# 15. 곡 상세 페이지에서 제거/검토할 것

현재 구조:

```text
SongDetailPage
 ↓
songPromise
 ↓
Suspense
 ↓
LyricsViewerLoader
 ↓
LyricsViewerClient
```

는 기술적으로 가능하지만 현재 화면에서는 얻는 이득이 크지 않은 것으로 판단한다.

Suspense boundary 밖에 의미 있는 UI가 거의 없기 때문이다.

따라서 기본적으로 다음처럼 단순화하는 방향을 검토한다.

```tsx
export default async function SongDetailPage({
  params,
}: SongPageProps) {
  const { slug } = await params;

  const song =
    await getSongDetailBySlug(slug);

  if (!song?.album) {
    notFound();
  }

  return (
    <LyricsViewerClient
      song={...}
      album={...}
    />
  );
}
```

검토 대상:

- 불필요한 `Suspense`
- `LyricsViewerLoader`
- Promise 전달 구조

기본 목표:

```text
RSC fetch
→ validate / normalize / map
→ LyricsViewerClient props
```

페이지 전환 loading UX가 필요하면 route-level:

```text
songs/[slug]/loading.tsx
```

를 우선 검토한다.

---

# 16. Suspense / Streaming 사용 기준

Suspense는 Client Component가 많거나 페이지가 크다는 이유로 사용하지 않는다.

다음 질문으로 판단한다.

> 페이지의 독립적인 일부 데이터가 느리며, 그 부분을 기다리는 동안 나머지 콘텐츠를 먼저 보여주는 것이 실제 UX 개선인가?

예:

```tsx
<AlbumHeader album={album} />

<Suspense fallback={<RelatedSongsSkeleton />}>
  <RelatedSongs albumId={album.id} />
</Suspense>
```

좋은 구조:

```text
중요 콘텐츠 즉시 렌더
+
느린 독립 subtree streaming
```

가치가 낮은 구조:

```text
<Suspense>
  전체 페이지
</Suspense>
```

단순히:

```text
전체 skeleton
→
전체 페이지
```

전환만 일어난다면 route-level `loading.tsx`나 일반 `await`가 더 단순할 수 있다.

Suspense는 독립된 느린 subtree와 실제 streaming UX가 있을 때 사용한다.

---

# 17. Hydration 사용 기준

Hydration은 다음 질문으로 판단한다.

> 서버에서 조회한 동일한 데이터가 브라우저에서도 TanStack Query server-state로 계속 살아야 하는가?

YES인 경우에만 검토한다.

예:

- 초기 SEO 필요
- 이후 client refetch 필요
- mutation 이후 동일 query invalidate 필요
- polling 필요
- infinite query
- optimistic update와 동일 cache 사용

예:

```text
공개 댓글

RSC에서 초기 댓글 필요
+
사용자가 댓글 작성
+
작성 후 목록 invalidate/refetch
```

이런 경우 hydration은 정당화될 수 있다.

반면 곡 가사는:

```text
RSC 조회
→ LyricsViewerClient에 props
→ local interaction
```

이면 충분하므로 hydration하지 않는다.

---

# 18. 얕은 DI를 적용해야 하는 경우

server/client가 동일한 query identity와 query policy를 공유할 가치가 **실제로 있는 경우에만** 도메인별 shallow DI를 사용할 수 있다.

대표적인 경우:

```text
RSC initial fetch
+
HydrationBoundary
+
Client useQuery
+
이후 refetch / invalidation
```

예:

```ts
export interface PostReader {
  getDetail(id: string): Promise<Post>;
}
```

```ts
export const createPostQueries = (
  reader: PostReader,
) => ({
  detail: (id: string) =>
    queryOptions({
      queryKey: postKeys.detail(id),
      queryFn: () => reader.getDetail(id),
    }),
});
```

Server implementation:

```ts
export const serverPostReader = {
  getDetail: postService.getDetail,
} satisfies PostReader;
```

Client implementation:

```ts
export const clientPostReader = {
  async getDetail(
    id: string,
  ): Promise<Post> {
    const raw = await http
      .get(`posts/${id}`)
      .json();

    return PostSchema.parse(raw);
  },
} satisfies PostReader;
```

이 방식은 **기본 구조가 아니다.**

다음 조건이 모두 명확할 때만 검토한다.

```text
동일 query key 공유 가치가 있음
+
동일 staleTime / retry / select 등 query policy 공유 가치가 있음
+
server prefetch와 client query가 실제로 동일 cache lifecycle을 이어감
```

단순히 server와 client에서 비슷한 조회 코드가 있다는 이유로 DI를 추가하지 않는다.

---

# 19. 금지할 추상화

다음과 같은 generic abstraction을 새로 만들지 않는다.

```ts
interface QuerySource<TParams, TResult>
interface DataProvider<TEntity, TId, TFilter>
interface QueryExecutor<TDefinition>
interface QueryDefinition<TParams, TResult>
```

또한 다음 종류의 프로젝트 전용 framework를 만들지 않는다.

```text
createUniversalQueries
createServerQueries
createClientQueries
QueryTransport
QueryAdapter
ServerQueryProvider
ClientQueryProvider
CacheKeyFactory
QueryRepository
HydrationService
custom query runtime
generic fetch executor
generic repository abstraction
query DI container
server/client runtime detector
queryFn registry
```

단순한 RSC 조회를 위해 다음 체인을 만들지 않는다.

```text
queryFn injection
→ factory
→ DI
→ prefetch
→ dehydrate
→ HydrationBoundary
```

도메인 이름이 사라지고 generic 타입 파라미터가 앞에 나오기 시작하면 과잉 추상화로 의심한다.

필요한 경우 다음처럼 도메인이 직접 드러나는 이름을 우선한다.

```text
PostReader
AlbumReader
UserReader
```

단, 이것조차 실제 공유 가치가 있을 때만 만든다.

---

# 20. DRY 적용 기준

DRY는 단순히 코드가 두 번 등장한다는 이유로 적용하지 않는다.

예:

```text
server queryFn
client queryFn
```

이 비슷하게 보여도 변화 이유와 실행 환경이 다르면 중복을 허용한다.

공유해야 하는 것은 코드 자체보다 다음과 같은 지식이다.

```text
data identity
domain schema
domain type
query key
business rule
validation rule
API contract
```

두 코드가 우연히 동일하게 생겼다고 해서 하나의 abstraction으로 합치지 않는다.

---

# 21. SSOT 적용 기준

다음은 SSOT 후보다.

```text
Zod schema
schema-derived domain type
query key
API contract
domain rule
validation rule
```

반대로 다음을 하나의 SSOT로 만들려고 하지 않는다.

```text
TanStack Query queryKey
Next.js cache identity
Next cacheTag
HTTP route
DB key
```

서로 다른 시스템의 identifier는 서로 다른 역할을 가진다.

공통 vocabulary는 사용할 수 있어도 하나의 기술적 표현으로 통합하지 않는다.

---

# 22. Zod와 타입 정책

외부 데이터가 애플리케이션 경계로 들어올 때 Zod로 검증한다.

```ts
export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type Post =
  z.output<typeof PostSchema>;
```

가능한 경우 별도의 수동 interface를 중복 작성하지 않는다.

```ts
// 피한다.
interface Post {
  id: string;
  title: string;
}
```

schema-derived type을 사용한다.

Zod의 역할:

```text
runtime validation
+
normalization
+
type source
```

단, 모든 내부 객체를 무조건 반복 parse하지 않는다.

외부 시스템, DB representation → domain output, HTTP response 등 명확한 contract boundary에서 검증한다.

---

# 23. Contract Validation

페이지에서 다음과 같은 코드를 제거하는 방향을 검토한다.

```ts
song.lyrics as unknown as LyricLine[]
```

페이지는 DB representation을 보정하는 장소가 아니다.

가능하면:

```text
repository
 ↓
service
 ↓
validated / normalized domain output
 ↓
page
```

가 되도록 한다.

Service 또는 명확한 contract boundary에서 Zod schema 등을 사용해 데이터를 검증 / 정규화하고 페이지는 확정된 타입을 소비한다.

페이지에서:

```ts
as unknown as ...
```

를 사용해 데이터 계약 문제를 덮지 않는다.

---

# 24. Server Layer

현재 `src/server`를 FSD의 새로운 product layer로 해석하지 않는다.

`src/server`는 FSD product decomposition과 별개의:

> server runtime / application / infrastructure boundary

로 본다.

예:

```text
src/
├─ app/
├─ entities/
├─ features/
├─ shared/
└─ server/
   ├─ auth/
   ├─ db/
   ├─ repositories/
   ├─ services/
   ├─ http/
   ├─ email/
   └─ errors/
```

import 방향:

```text
RSC / Route Handler / Server Action
        ↓
      server
        ↓
repository / DB / infrastructure
```

`server`는 필요에 따라 universal entity model / schema / contract 등을 import할 수 있다.

Client graph가 `server`를 import하면 안 된다.

server-only module에는:

```ts
import 'server-only';
```

를 유지한다.

FSD의 UI/domain decomposition과 server runtime boundary를 억지로 하나의 layer taxonomy로 통합하지 않는다.

---

# 25. 동일 Service의 두 Entry Point

동일한 application service가 두 경로에서 호출되는 것은 정상이다.

Public RSC:

```text
RSC
 ↓
service
 ↓
repository
 ↓
DB
```

Browser:

```text
Client
 ↓
Ky
 ↓
Route Handler
 ↓
service
 ↓
repository
 ↓
DB
```

이것을 중복이라고 보고 억지로 통합하지 않는다.

두 runtime의 entry point가 동일 application service에서 합쳐지는 정상적인 구조다.

HTTP는 브라우저가 server service에 접근하기 위한 boundary이지, 서버 내부 호출까지 HTTP로 통일할 이유는 없다.

---

# 26. 공개 콘텐츠 Cache

곡 / 앨범 / 가사 / 응원법은 대체로:

```text
read frequency 높음
write frequency 낮음
SEO 중요
```

이라는 특성이 있다.

따라서 client refetch보다:

```text
server cache
+
write-triggered invalidation
```

전략이 더 자연스럽다.

예:

```text
Admin mutation
 ↓
service write
 ↓
public cache invalidation
```

TTL polling보다 write-triggered invalidation을 우선 검토한다.

가능한 경우 전체 cache를 무효화하기보다 해당 도메인 / entity 단위 tag를 사용한다.

예:

```text
songs
song:{slug}
albums
album:{slug}
```

단, 실제 Next.js 16 cache API를 적용하기 전에 현재 프로젝트의 rendering/cache semantics와 공식 API를 확인하고 구현한다.

특히 다음 API의 현재 semantics를 공식 문서 기준으로 확인한다.

```text
use cache
cacheTag
cacheLife
revalidateTag / updateTag 계열
```

오래된 Next.js 버전의 캐시 모델을 그대로 가정하지 않는다.

불필요한 custom cache abstraction을 만들지 않는다.

---

# 27. generateMetadata와 Page 데이터 중복 조회

현재 곡 상세에서는 다음 호출이 존재한다.

```text
generateMetadata
→ getSongDetailBySlug()

SongDetailPage
→ getSongDetailBySlug()
```

해당 service가 내부적으로 repository / DB query를 직접 실행한다면 동일 request/render 과정에서 조회가 중복될 가능성을 검토한다.

request-level deduplication이 필요하다면 React `cache()` 등 현재 React / Next.js 공식 권장 방식을 검토한다.

목표:

```text
generateMetadata ─┐
                  ├→ same song lookup
page ─────────────┘
```

단:

- 실제 Next.js 16 semantics를 공식 문서로 확인한다.
- framework가 이미 dedupe하는 범위를 먼저 확인한다.
- 필요하지 않은 custom memoization abstraction을 만들지 않는다.
- request-level memoization과 persistent server cache를 혼동하지 않는다.

---

# 28. TypeScript / ESLint 정책

자동화는 실제 버그를 방지하는 수준까지만 적용한다.

우선순위:

```text
TypeScript
→ contract correctness

Zod
→ runtime boundary validation

ESLint
→ server/client import boundary

Formatter
→ formatting
```

유용한 규칙 예:

```text
no-restricted-imports
```

필요하다면 public/shared/client module에서 다음 dependency import를 제한한다.

```text
src/server/**
server-only
next/headers
DB modules
repository modules
```

`explicit-module-boundary-types` 등은 프로젝트의 기존 lint 정책과 비용을 고려해 적용한다.

다음과 같은 취향성 규칙은 실제 문제가 반복되기 전까지 custom lint로 만들지 않는다.

```text
반드시 *Reader 이름 사용
반드시 create*Queries 사용
특정 파일명 강제
특정 AST 구조 강제
```

취향은 먼저 문서와 코드 리뷰로 관리한다.

---

# 29. TanStack Start를 참고하는 방식

TanStack Start의 장점 중 참고할 부분은 다음과 같다.

```text
same query identity
same query policy
isomorphic loader/query model
```

그러나 Next.js에서 이를 그대로 복제하기 위해 다음을 새로 도입하지 않는다.

```text
tRPC
oRPC
Vovk
custom RPC framework
custom createServerFn abstraction
```

현재 요구사항보다 복잡성이 커질 가능성이 높기 때문이다.

TanStack Start의 **개념**만 참고하고 Next.js의 실행 모델을 존중한다.

다른 framework의 대칭적인 architecture를 Next.js 위에 재현하는 것을 목표로 하지 않는다.

---

# 30. 최종 Decision Table

| 상황 | 기본 선택 |
| --- | --- |
| Public SEO 콘텐츠 | RSC → service |
| Public + interactive UI | RSC → props → Client Component |
| Local browser interaction | Client state |
| Admin CRUD | TanStack Query + Ky |
| Client mutation | mutationOptions |
| mutation error UX | MutationCache + meta |
| 서버 write | service 직접 호출 |
| 느린 독립 server subtree | Suspense |
| route 전체 loading | `loading.tsx` |
| server + client 동일 state lifecycle | hydration 검토 |
| client refetch 필요 없음 | props |
| 공개 저빈도 수정 콘텐츠 | server cache + invalidation 검토 |
| Query cache identity | `query-keys.ts` |
| Next cache identity | framework cache + 별도 cacheTag |
| Metadata/page 중복 DB lookup | request dedupe 검토 |
| 단순 RSC 조회 | TanStack Query 사용 안 함 |
| Admin/client-owned state | TanStack Query ownership |
| Public/server-owned state | Next/RSC ownership |
| 동일 query policy 공유 필요 | domain-specific shallow DI 검토 |
| 단순 코드 중복 | 허용 가능 |
| runtime contract | Zod validation |
| server-only dependency | `src/server` 경계 안에 유지 |

---

# 31. 새 데이터 흐름 구현 시 판단 순서

새 데이터 흐름을 구현하기 전에 다음 순서로 판단한다.

```text
1. 프레임워크가 이미 제공하는 공식 기능으로 해결 가능한가?

2. 가장 단순한 데이터 흐름은 무엇인가?

3. 이 데이터는 서버에서 끝나는가,
   브라우저 lifecycle이 필요한가?

4. 데이터 ownership은 server인가 client인가?

5. SEO / initial HTML이 필요한가?

6. 실제로 공유해야 하는 지식은 무엇인가?

7. SSOT여야 하는 것은 무엇인가?

8. 동일한 코드가 아니라 동일한 변화 이유를 공유하는가?

9. DI나 abstraction이 없으면 실제로 어떤 문제가 생기는가?

10. hydration / Suspense / streaming이 실제 UX를 개선하는가?

11. 이 abstraction이 새 프로젝트 어휘를 얼마나 추가하는가?

12. 평범한 코드 몇 줄을 중복하는 쪽이 오히려 더 단순하지 않은가?
```

---

# 32. 리팩터링 우선순위

현재 migration 작업에서는 대규모 architecture rewrite를 하지 않는다.

가장 작은 변경부터 적용한다.

## P1 — 곡 상세 단순화

현재 곡 상세 페이지를 검토하고 다음을 제거할 수 있는지 확인한다.

- 불필요한 `Suspense`
- `LyricsViewerLoader`
- Promise 전달 구조

기본 목표:

```text
RSC fetch
→ validate / normalize / map
→ LyricsViewerClient props
```

route 전체 loading이 필요하면 `loading.tsx`를 우선 검토한다.

---

## P2 — 타입 경계 정리

다음 코드가 필요하지 않도록 song service / contract의 lyrics 타입을 정리한다.

```ts
as unknown as LyricLine[]
```

DB representation과 UI contract 사이의 변환 / 검증 위치를 명확히 한다.

---

## P3 — Metadata/Page 조회 dedupe

`generateMetadata`와 page의 동일 song lookup을 공식 React / Next.js 방식으로 dedupe할 수 있는지 검토한다.

framework가 이미 제공하는 semantics를 먼저 확인하고 필요한 최소한의 방법만 적용한다.

---

## P4 — Admin 구조 유지

현재:

```text
songQueries
songMutations
Ky API
TanStack Query
```

구조는 큰 이유가 없다면 유지한다.

Admin은 TanStack Query 기반 client server-state architecture를 사용한다.

기존 구조가 정상적으로 동작한다면 server/client 대칭성을 위해 변경하지 않는다.

---

## P5 — Public cache

곡 / 앨범 / 응원법 수정 이후 public page cache invalidation 전략을 설계한다.

실제 Next.js 16 cache semantics를 확인한 후 최소한으로 도입한다.

가능하면 write-triggered invalidation을 사용한다.

---

## P6 — 다른 Public 페이지 적용

곡 상세에서 확립한 원칙을 albums / chants 등 다른 `(user)` 페이지에 적용한다.

각 페이지마다 먼저 실제 data lifecycle을 확인한다.

일괄적인 query abstraction이나 universal factory를 만들지 않는다.

---

# 33. 작업 전 코드 추적 원칙

코드를 수정하기 전에 해당 route와 연결된 파일을 모두 추적한다.

```text
page / layout
↓
feature / entity UI
↓
query / mutation / API
↓
Route Handler / Server Action
↓
server service
↓
repository
↓
DB / external API
↓
contract / schema
```

해당 경로에서 실제로 사용되는 부분만 추적하되 파일 하나만 보고 architecture를 추측하지 않는다.

다음도 함께 확인한다.

```text
generateMetadata
loading.tsx
error.tsx
not-found handling
cache usage
query invalidation
mutation side effect
client/server import boundary
```

---

# 34. 구체적인 작업 요청

현재 코드베이스를 위 원칙 기준으로 분석하고 다음을 수행하라.

1. RSC-only 데이터와 Client lifecycle 데이터를 구분한다.
2. 각 데이터의 cache ownership이 server인지 client인지 판단한다.
3. 불필요한 TanStack Query 사용을 제거하거나 단순화한다.
4. Client Component가 단순 props로 데이터를 받을 수 있는 곳을 찾는다.
5. server dependency가 shared query module을 통해 client bundle로 유입되는 부분을 찾는다.
6. query key를 순수 universal module로 분리한다.
7. Next cacheTag와 TanStack queryKey를 분리한다.
8. hydration이 실제로 필요한 사용처만 남긴다.
9. 불필요한 prefetch / dehydrate / HydrationBoundary를 제거한다.
10. Suspense가 실제 streaming UX를 제공하지 않는 곳을 찾는다.
11. route-level loading이 더 적절한 곳은 `loading.tsx`를 검토한다.
12. 동일 query policy 공유 가치가 큰 경우에만 domain-specific shallow DI를 적용한다.
13. generic QuerySource / DataProvider / Executor abstraction은 만들지 않는다.
14. server/client runtime detector나 custom query framework를 만들지 않는다.
15. Zod schema를 runtime validation과 type source로 사용한다.
16. 페이지의 `as unknown as ...` 타입 우회를 제거한다.
17. `generateMetadata`와 page의 동일 DB 조회 중복 여부를 검토한다.
18. React / Next.js 공식 request-level dedupe 방식을 우선 검토한다.
19. 공개 콘텐츠에 server cache + write-triggered invalidation 적용 가능성을 검토한다.
20. Admin의 기존 TanStack Query + Ky 구조는 실제 문제가 없다면 유지한다.
21. `src/server`를 server runtime / application / infrastructure boundary로 유지한다.
22. Client graph가 `src/server`를 import하지 못하도록 경계를 확인한다.
23. 동일 service의 RSC direct call과 HTTP entry point를 정상적인 별도 entry point로 인정한다.
24. TanStack Query queryKey를 Next cache protocol로 재사용하지 않는다.
25. 새로운 라이브러리나 RPC framework를 추가하지 않는다.
26. custom hook / wrapper / provider를 특별한 이유 없이 추가하지 않는다.
27. 기존 동작을 유지하면서 가장 작은 변경부터 적용한다.
28. 변경 후 typecheck / lint / test / build 등 프로젝트가 제공하는 검증 절차를 수행한다.
29. 실제 문제가 없는 영역은 구조적 일관성을 위해 변경하지 않는다.
30. 구현 전에 현재 Next.js 16 / React / TanStack Query 공식 API semantics가 필요한 부분은 공식 문서 기준으로 확인한다.

---

# 35. 리팩터링 결과 설명 형식

각 주요 변경에 대해 다음 형식으로 설명하라.

```text
문제
→ 기존 구조가 어떤 비용을 만들고 있었는가

변경
→ 무엇을 제거하거나 단순화했는가

원칙
→ KISS / DRY / SSOT / SOLID / 바퀴 재발명 방지 중
   어떤 원칙을 적용했는가

Trade-off
→ 어떤 중복, 제약, 명시적 코드 증가를 의도적으로 허용했는가

검증
→ 기존 behavior와 타입 안정성을 어떻게 확인했는가
```

추상화를 추가한 경우에는 추가로 반드시 설명한다.

```text
왜 필요한가
→ 평범한 코드 중복으로 두는 것보다 실제로 어떤 문제가 해결되는가

어휘 비용
→ 개발자가 새로 알아야 하는 프로젝트 전용 개념은 무엇인가

제거 기준
→ 요구사항이 사라질 경우 이 abstraction을 쉽게 제거할 수 있는가
```

---

# 36. 기대하는 최종 기본 구조

Public의 기본 경로:

```text
Public

RSC
 ↓
Service
 ↓
Repository
 ↓
DB

RSC
 ↓
Props
 ↓
Client Island
```

즉:

```text
Public
RSC → Service → DB
        ↓
      Props
        ↓
  Client Island
```

브라우저에서 server-state lifecycle이 실제로 존재하지 않는다면 TanStack Query를 추가하지 않는다.

---

Admin의 기본 경로:

```text
Admin

Client Component
 ↓
TanStack Query
 ↓
Ky
 ↓
Route Handler / Backend API
 ↓
Service
 ↓
Repository
 ↓
DB
```

RSC는 auth / permission / redirect / layout / shell 등의 서버 경계 역할에 집중한다.

---

Server initial render와 client lifecycle이 동시에 필요한 예외적인 경우:

```text
RSC
 ↓
prefetch
 ↓
dehydrate
 ↓
HydrationBoundary
 ↓
TanStack Query
 ↓
client lifecycle
```

이 구조는 기본값이 아니라 예외다.

---

# 37. 최종 목표

이 리팩터링의 목표는:

```text
더 많은 abstraction
더 높은 server/client 대칭성
더 많은 hydration
더 많은 framework 기능 사용
```

이 아니다.

목표는 다음이다.

```text
데이터 lifecycle을 먼저 판단
↓
ownership 결정
↓
가장 단순한 runtime 경로 선택
↓
framework/library 공식 vocabulary 사용
↓
필요한 지식만 공유
↓
실제 문제가 생긴 뒤 필요한 만큼만 추상화
```

복잡한 유즈케이스가 실제로 등장했을 때만 기본 경로 위에 추가 기능을 쌓는다.

코드베이스를 처음 보는 개발자가:

```text
Next.js
React
TanStack Query
Ky
Zod
```

의 표준 지식만으로 대부분의 데이터 흐름을 이해할 수 있어야 한다.

프로젝트 전용 architecture vocabulary는 최소화한다.

**가장 좋은 구조는 가장 많은 기능을 공유하는 구조가 아니라, 각 데이터가 어디에서 살아야 하는지를 가장 쉽게 설명할 수 있는 구조다.**