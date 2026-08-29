---
title: "Server / Data Access Architecture"
document_id: "06"
version: "1.0"
status: "active"
authority: "architecture"
updated_at: "2026-08-26"
depends_on:
  - "01"
  - "03"
  - "04"
  - "05"
supersedes:
  - "06-v0"
tags:
  - "server"
  - "repository"
  - "drizzle"
  - "postgresql"
  - "transaction"
---

# oioi-bwg Server / Data Access Architecture v1.0

## 1. 목적

이 문서는 oioi-bwg의 서버 애플리케이션에서 다음 책임의 경계를 정의한다.

- Route Handler
- RSC
- 제한적으로 사용하는 Server Action
- Service / Use Case
- Repository
- Drizzle
- PostgreSQL
- Transaction

현재 staging 코드에는 다음 구조가 존재한다.

```text
shared/api/db/drizzle/
├─ index.ts
├─ schema.ts
├─ queries.ts
└─ commands.ts
```

또한 `features/manage-content/actions.ts`에서 Server Action이 직접:

```text
Zod parse
DB 접근
domain/application validation
cache invalidation
error conversion
Result 반환
```

까지 담당하고 있다.

새 구조의 목적은 이 기능들을 모두 다시 만드는 것이 아니라,
현재 존재하는 persistence API의 책임을 명확히 재배치하는 것이다.

---

# 2. 최종 서버 구조

기본 흐름:

```text
Route Handler / RSC / 제한적 Server Action
                    ↓
               Service / Use Case
                    ↓
                Repository
                    ↓
                  Drizzle
                    ↓
               PostgreSQL
```

각 계층의 책임은 다음과 같다.

```text
Delivery
= 입력/출력 adapter

Service
= application workflow
= auth/authz
= business rule
= transaction boundary

Repository
= persistence query
= Drizzle expression
= persistence mapping

Drizzle
= SQL execution / transaction API

PostgreSQL
= data persistence
```

---

# 3. Repository는 둔다

oioi-bwg에서는 Repository 계층을 사용한다.

이유:

현재 `queries.ts / commands.ts`가 이미 사실상 persistence abstraction 역할을 하고 있다.

따라서 Repository를 새로 발명하는 것이 아니라:

```text
기존 queries / commands
        ↓
책임 재정의
        ↓
도메인 단위 Repository
```

로 정리하는 것이다.

---

# 4. Repository framework는 만들지 않는다

Repository 계층은 사용하지만 다음은 만들지 않는다.

```text
IRepository<T>
BaseRepository<T>
SongRepository interface
SongRepositoryImpl
RepositoryFactory
RepositoryContainer
UnitOfWork class
DI Token
Decorator
Metadata
```

Repository는 plain function module이면 충분하다.

예:

```ts
export async function findSongById(
  executor: DbExecutor,
  id: number,
) {
  // drizzle query
}

export async function updateSong(
  executor: DbExecutor,
  id: number,
  input: SongUpdateRow,
) {
  // drizzle query
}
```

---

# 5. Repository는 도메인 단위로 구성한다

현재 staging은:

```text
queries.ts
commands.ts
```

형태로 read/write를 기준으로 나눈다.

새 구조에서는 도메인 단위를 기본으로 한다.

```text
server/repositories/
├─ song.repository.ts
├─ album.repository.ts
├─ revision.repository.ts
└─ translation.repository.ts
```

이유:

```text
query / command
```

이라는 기술 분류보다:

```text
song
album
translation
```

이라는 도메인 경계가 더 오래 유지된다.

Repository 내부에서는 read/write를 같이 둘 수 있다.

---

# 6. Repository는 DB executor를 인자로 받는다

현재 staging에서는 query/command 함수 내부에서 `getDb()`를 직접 호출한다.

새 구조에서는 Repository 내부에서 DB connection을 획득하지 않는다.

사용:

```ts
await songRepository.findById(db, id);
```

Transaction:

```ts
await songRepository.update(tx, id, data);
```

기본 시그니처:

```ts
export async function updateSong(
  executor: DbExecutor,
  id: number,
  data: SongUpdateRow,
) {
  return executor
    .update(song)
    .set(data)
    .where(eq(song.id, id));
}
```

---

# 7. 왜 executor를 명시적으로 전달하는가

주된 이유는 Transaction propagation이다.

현재 방식:

```ts
export async function updateSong(...) {
  const db = getDb();
  ...
}
```

이 구조에서:

```ts
await db.transaction(async (tx) => {
  await updateSong(...);
});
```

라고 호출하더라도 `updateSong()` 내부에서 다시 `getDb()`를 사용하면
실제 transaction executor인 `tx`가 전달되지 않는다.

새 구조:

```ts
await db.transaction(async (tx) => {
  await songRepository.update(tx, id, data);
});
```

transaction 사용이 함수 signature와 call site에 명시적으로 드러난다.

---

# 8. DI container를 사용하지 않는다

executor를 함수 인자로 전달하는 것은 DI container 도입을 의미하지 않는다.

사용하지 않는다:

```text
Inversify
NestJS DI
Service Container
Repository Registry
Token Resolver
```

사용:

```text
plain function argument
```

```ts
repository.update(tx, ...)
```

의존성 흐름을 코드에 그대로 노출한다.

---

# 9. AsyncLocalStorage transaction context를 기본으로 사용하지 않는다

다음과 같은 ambient transaction context는 v1에서 사용하지 않는다.

```text
withTransaction(...)
    ↓
AsyncLocalStorage
    ↓
repository가 현재 tx 자동 획득
```

이 방식은 호출부에서 어떤 DB executor가 사용되는지 숨긴다.

기본 원칙:

> transaction context는 명시적으로 전달한다.

실제 규모가 커져 명시적 전달 비용이 충분히 문제가 될 때만 재검토한다.

---

# 10. Transaction owner는 Service / Use Case다

Repository는 transaction을 시작하지 않는다.

Transaction 범위를 결정하는 주체는 Service다.

이유:

Repository는 하나의 DB operation만 알지만,
Service는 application use case 전체를 알고 있다.

예:

```text
publish song
├─ song status 변경
├─ revision 생성
├─ translation 상태 변경
└─ audit event 생성
```

이 네 작업이 하나의 atomic operation이어야 하는지는
Repository가 아니라 `publishSong()` use case가 결정한다.

---

# 11. Transaction 기본 패턴

```ts
export async function publishSong(
  ctx: RequestContext,
  input: PublishSongInput,
) {
  const song = await songRepository.findById(
    db,
    input.id,
  );

  // auth/authz
  // domain/application validation

  return db.transaction(async (tx) => {
    const updated =
      await songRepository.publish(
        tx,
        input.id,
      );

    await revisionRepository.create(
      tx,
      makePublishRevision(updated),
    );

    return toSongDto(updated);
  });
}
```

---

# 12. Top-level write use case 하나가 transaction 하나를 소유한다

기본 규칙:

> 하나의 top-level write use case가 하나의 transaction boundary를 소유한다.

피한다:

```text
Service A transaction
    ↓
Service B transaction
    ↓
Service C transaction
```

이 구조는 transaction ownership을 불명확하게 만든다.

---

# 13. Nested transaction은 기본 패턴이 아니다

Drizzle이 nested transaction/savepoint를 지원하더라도
일반 application flow에서 이를 기본으로 사용하지 않는다.

Nested transaction이 필요한 경우:

```text
부분 rollback 요구
savepoint가 명시적 business requirement
```

같은 실제 요구가 확인될 때만 사용한다.

---

# 14. 단순 write에는 transaction을 강제하지 않는다

모든 mutation을 transaction으로 감싸지 않는다.

예:

```ts
await songRepository.rename(
  db,
  id,
  title,
);
```

단일 SQL statement로 원자성이 충분하다면 별도 transaction이 필요 없다.

Transaction은 다음 경우에 사용한다.

```text
여러 DB operation이 하나의 atomic use case일 때
read + write consistency가 transaction isolation을 요구할 때
부분 실패를 허용할 수 없을 때
```

---

# 15. Service가 다른 Service를 호출하는 것을 기본 패턴으로 만들지 않는다

예:

```text
publishSong()
  → updateSong()
      → transaction
```

처럼 top-level use case끼리 중첩 호출하면
transaction ownership과 authorization 흐름이 불명확해질 수 있다.

기본 원칙:

```text
top-level use case
    ↓
Repository
shared pure function
domain helper
```

공통 로직이 필요하면 먼저 작은 pure function 또는 domain helper 추출을 검토한다.

---

# 16. Service의 책임

Service는 다음을 담당한다.

```text
authorization
business/application validation
resource loading orchestration
transaction boundary
multiple repository coordination
DTO mapping 호출
expected AppError 발생
```

예:

```ts
export async function updateSong(
  ctx: RequestContext,
  input: UpdateSongInput,
): Promise<SongDto> {
  const song = await songRepository.findById(
    db,
    input.id,
  );

  if (!song) {
    throw new AppError("SONG_NOT_FOUND");
  }

  if (
    ctx.ability.cannot(
      "update",
      subject("Song", toSongAuthSubject(song)),
    )
  ) {
    throw new AppError("FORBIDDEN");
  }

  const updated =
    await songRepository.update(
      db,
      input.id,
      toSongUpdateRow(input),
    );

  return toSongDto(updated);
}
```

---

# 17. Authorization은 Handler가 아니라 Service에서 수행한다

Route Handler에서만 권한을 검사하지 않는다.

이유:

동일 Service가 다음 경로에서 호출될 수 있다.

```text
Route Handler
RSC
Server Action
internal server flow
```

따라서 실제 security boundary는 Service여야 한다.

```text
Route Handler ─┐
RSC ───────────┼→ Service → authz → Repository
Server Action ─┘
```

Delivery layer의 auth check는 UX/coarse gating일 수는 있지만,
민감한 operation의 최종 authorization을 대체하지 않는다.

---

# 18. Repository의 책임

Repository는 다음만 담당한다.

```text
Drizzle query 구성
DB row 조회
insert/update/delete
join/relation 조회
persistence-specific filtering
DB representation 변환
```

Repository는 다음을 알지 않는다.

```text
Next.js cache
TanStack Query
HTTP status
ApiError
AppError
toast
UI message
RSC rendering
redirect
```

---

# 19. Repository는 Result를 반환하지 않는다

현재 staging의 일부 command는:

```ts
return {
  success: false,
  error: "..."
};
```

형태를 사용한다.

새 Repository에서는 사용하지 않는다.

성공:

```text
data 반환
```

Expected application failure:

```text
Service에서 AppError
```

Unexpected DB failure:

```text
원래 exception 전파
```

Repository가 에러를 UI 문구로 변환하지 않는다.

---

# 20. Repository에서 Next cache invalidation을 제거한다

현재 staging의 command는:

```text
updateTag()
revalidatePath()
```

를 DB write와 함께 수행한다.

새 Repository는 Next.js cache를 모른다.

사용하지 않는다:

```ts
export async function updateSong(...) {
  await db.update(...);
  updateTag("songs");
}
```

Repository 책임은 DB write에서 끝난다.

---

# 21. Cache invalidation은 별도 concern이다

Client-side server state mutation의 기본 경로:

```text
TanStack Mutation
    ↓
ky
    ↓
Route Handler
    ↓
Service
```

Client cache consistency는 mutation 성공 후:

```ts
queryClient.invalidateQueries(...)
```

를 기본으로 한다.

Next Data Cache / RSC cache invalidation은
07 Rendering / Query / Cache Architecture에서 별도로 정의한다.

Repository가 두 캐시 시스템을 동시에 관리하지 않는다.

---

# 22. Server Action은 기본 mutation transport가 아니다

기본 client mutation 경로:

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
```

Server Action을 일반 application mutation 경로로 병행하면:

```text
HTTP / ApiError / Query invalidation
```

과:

```text
Server Action result / revalidatePath
```

이라는 두 mutation vocabulary가 생긴다.

따라서 기본값으로 사용하지 않는다.

---

# 23. Server Action은 제한적으로 허용한다

다음 경우에 고려할 수 있다.

```text
단순 server form
framework integration
client cache lifecycle과 무관한 operation
HTTP API contract를 만드는 것이 오히려 과한 경우
```

Server Action을 사용하더라도 application logic을 직접 구현하지 않는다.

```ts
"use server";

export async function someAction(
  raw: unknown,
) {
  const input = someSchema.parse(raw);
  const ctx = await getRequestContext();

  return someService(ctx, input);
}
```

즉 Server Action도 delivery adapter다.

---

# 24. 현재 manage-content Server Action은 해체 대상이다

현재 staging의 Server Action은 한 함수 안에서:

```text
input validation
LRC parsing
DB access
persistence mapping
cache invalidation
error conversion
Result creation
```

을 수행한다.

Migration 시 다음 책임으로 분리한다.

```text
Route Handler
= Zod input validation / HTTP

Service
= LRC/domain orchestration
= auth/authz
= transaction

Repository
= Drizzle write

Client mutation
= invalidateQueries
```

---

# 25. RSC는 Service를 직접 호출할 수 있다

RSC가 데이터를 읽기 위해 자기 애플리케이션의 HTTP API를 다시 호출할 필요는 없다.

기본:

```text
RSC
 ↓
Service
 ↓
Repository
```

사용하지 않는 기본 패턴:

```text
RSC
 ↓
localhost HTTP
 ↓
Route Handler
 ↓
Service
```

서버 내부에서 자기 HTTP boundary를 우회 호출하지 않는다.

---

# 26. TanStack queryOptions를 서버 내부 application abstraction으로 사용하지 않는다

`queryOptions()`는 TanStack Query cache/orchestration vocabulary다.

Server 내부 Service 호출을 위해:

```text
RSC
→ queryOptions
→ queryFn
→ API
```

형태로 강제하지 않는다.

단, RSC에서 실제 TanStack Query hydration/prefetch가 필요한 경우:

```ts
queryClient.prefetchQuery(
  songQueries.detail(id),
);
```

처럼 Query cache 자체가 목적일 때는 사용할 수 있다.

이 규칙의 상세는 07번 문서에서 정의한다.

---

# 27. Drizzle schema type은 persistence 내부에서 사용 가능하다

현재 schema에서:

```ts
type Song = typeof song.$inferSelect;
type InsertSong = typeof song.$inferInsert;
```

형태의 타입 추론을 사용하고 있다.

이 방식은 persistence 내부에서는 유지할 수 있다.

예:

```text
Repository input/output helper
DB mapper
migration code
```

---

# 28. Drizzle type을 API DTO로 사용하지 않는다

다음은 구분한다.

```text
Drizzle Row
≠ Service DTO
≠ API DTO
≠ Form Model
```

외부 계약은 05 Contract / Validation Architecture를 따른다.

```text
DB Row
  ↓
Mapper
  ↓
Zod DTO
```

Drizzle inferred type을 Client까지 직접 전달하지 않는다.

---

# 29. Mapper는 plain function으로 둔다

예:

```ts
export function toSongDto(
  row: SongRow,
): SongDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
  };
}
```

만들지 않는다:

```text
Mapper interface
BaseMapper
Mapper class hierarchy
AutoMapper
```

---

# 30. Persistence input은 API input과 분리할 수 있다

예:

```ts
type UpdateSongInput =
  z.infer<typeof updateSongInputSchema>;

type SongUpdateRow =
  Partial<typeof song.$inferInsert>;
```

하지만 Service에서 무작정:

```ts
repository.update(db, id, input);
```

하지 않는다.

필요하면 명시적 mapping:

```ts
const row = toSongUpdateRow(input);

await songRepository.update(
  db,
  id,
  row,
);
```

API contract가 DB column 구조에 종속되지 않게 한다.

---

# 31. `updatedAt` 정책

현재 staging의 command는 `updatedAt`을 직접 갱신한다.

새 구조에서는 이 값의 책임을 명확히 한다.

우선순위:

```text
DB default / DB-level convention
    ↓
Persistence helper
    ↓
Service
```

모든 Service에서 제각각:

```ts
updatedAt: new Date().toISOString()
```

를 반복하는 구조는 피한다.

정확한 구현은 기존 schema와 migration 전략에 맞춰 결정한다.

---

# 32. DB client 초기화

현재 staging의 `getDb()`는 Vinext / Cloudflare Hyperdrive 전제를 가진다.

Migration 후 OCI standalone에서는 이 전제를 제거한다.

목표:

```text
DATABASE_URL
    ↓
postgres.js client
    ↓
Drizzle
```

DB connection lifecycle은 process-level singleton을 기본으로 검토한다.

React `cache()`를 DB client singleton 용도로 사용하지 않는다.

---

# 33. Connection pool

OCI single-server 환경에서는 Cloudflare Hyperdrive/PgBouncer용 설정을 그대로 유지하지 않는다.

기존:

```text
prepare: false
max: 5
Hyperdrive connectionString
```

새 환경에서는:

```text
Next standalone process
→ postgres.js
→ PostgreSQL 17 container
```

구조에 맞게 pool size와 prepare 사용 여부를 별도 조정한다.

구체 수치는 deployment 단계에서 실제 concurrency와 서버 자원을 기준으로 설정한다.

---

# 34. Repository naming

권장:

```text
findById
findBySlug
findAllVisible
findWithAlbum
create
update
remove
```

피한다:

```text
executeSongQuery
processSongCommand
fetchSongData
doUpdateSong
```

Repository 함수 이름은 persistence operation의 의미를 드러낸다.

---

# 35. Repository return shape

Repository는 use case에 필요한 최소 persistence shape를 반환한다.

항상 전체 row를 반환할 필요는 없다.

예:

```ts
return db.query.song.findMany({
  columns: {
    id: true,
    title: true,
    slug: true,
  },
});
```

현재 staging의 selective column query 방식은 유지할 수 있다.

단 외부 DTO 계약과 동일하다고 가정하지 않는다.

---

# 36. Query-specific Repository function은 허용한다

Repository가 무조건 CRUD API일 필요는 없다.

좋은 예:

```text
findVisibleSongs
findAlbumWithVisibleSongs
findSongsWithAlbumName
```

현재 staging의 `getAllAlbumsWithSongs()` 같은 query는
실제 product read model을 반영하는 유효한 persistence function일 수 있다.

억지로:

```text
findAll()
+ service에서 관계 조립
```

으로 단순화하지 않는다.

---

# 37. Generic CRUD Repository를 만들지 않는다

피한다:

```ts
createRepository(table)
```

```ts
BaseRepository<T>
```

도메인별 query requirement가 다른데
CRUD abstraction으로 통일하면 실제 query 의미가 사라진다.

Repository는 필요한 query를 명시적으로 표현한다.

---

# 38. Read Service도 필요할 수 있다

단순 조회라도 다음이 필요하면 Service를 둔다.

```text
authorization
business visibility rule
DTO mapping
multiple repository orchestration
```

예:

```text
getAdminSong
getEditableSong
getTranslationWorkspace
```

하지만 단순 public read에서 Service가 아무 의미 없는 passthrough가 된다면
실제 사용 패턴을 보고 최소화할 수 있다.

Service layer를 형식적으로 채우기 위해
모든 query에 1:1 wrapper를 강제하지 않는다.

---

# 39. Service passthrough 남발 금지

좋지 않은 형태:

```ts
export async function getSong(id: number) {
  return songRepository.findById(db, id);
}
```

이 함수가 앞으로도:

```text
authorization 없음
mapping 없음
business logic 없음
orchestration 없음
```

이라면 의미 없는 layer일 수 있다.

하지만 RSC/Route Handler의 공통 application entry point,
authorization 또는 DTO mapping이 실제로 필요하다면 유지한다.

판단 기준은 역할이다.

---

# 40. Error propagation

Repository:

```text
DB exception
→ 그대로 throw
```

Service:

```text
expected application error
→ AppError
```

HTTP boundary:

```text
AppError
→ ApiErrorResponse

unexpected error
→ Sentry
→ 500
```

Repository가 DB exception을 generic user message로 바꾸지 않는다.

---

# 41. Logging

Repository에서:

```ts
console.error(...)
```

후 `{ success: false }`를 반환하는 패턴을 사용하지 않는다.

Unexpected error logging/capture는 상위 boundary의 observability 정책에서 처리한다.

상세 logging 정책은 09번 문서에서 정의한다.

---

# 42. 테스트

Repository:

```text
실제 PostgreSQL/통합 테스트 중심
query 결과
constraint
transaction behavior
```

Service:

```text
authorization
business rule
transaction orchestration
expected AppError
```

Route Handler:

```text
input validation
HTTP mapping
```

Repository implementation detail을 mock하기 위한
대규모 interface 계층을 만들지는 않는다.

---

# 43. Transaction 테스트

최소 대표 case:

```text
operation A 성공
operation B 실패
→ A rollback
```

을 실제 PostgreSQL에서 검증한다.

Transaction propagation의 핵심은:

```text
db
tx
```

가 동일 Repository API를 사용할 수 있는지 확인하는 것이다.

---

# 44. 권장 초기 폴더 구조

```text
src/
├─ app/
│  └─ api/
│
├─ server/
│  ├─ db/
│  │  ├─ index.ts
│  │  └─ schema/
│  │
│  ├─ repositories/
│  │  ├─ song.repository.ts
│  │  ├─ album.repository.ts
│  │  └─ revision.repository.ts
│  │
│  ├─ services/
│  │  ├─ songs/
│  │  │  ├─ get-song.ts
│  │  │  ├─ update-song.ts
│  │  │  └─ publish-song.ts
│  │  └─ albums/
│  │
│  ├─ auth/
│  ├─ authz/
│  ├─ errors/
│  └─ http/
│
└─ shared/
   └─ contracts/
```

실제 파일 수가 적으면 더 평평하게 시작할 수 있다.

빈 폴더를 architecture ceremony로 만들지 않는다.

---

# 45. 현재 staging → 목표 구조

현재:

```text
shared/api/db/drizzle/index.ts
shared/api/db/drizzle/schema.ts
shared/api/db/drizzle/queries.ts
shared/api/db/drizzle/commands.ts
features/manage-content/actions.ts
```

목표:

```text
server/db/index.ts
server/db/schema/*

server/repositories/
├─ song.repository.ts
└─ album.repository.ts

server/services/
├─ songs/*
└─ albums/*

app/api/*
```

Migration 의미:

```text
queries.ts / commands.ts
→ Repository로 재배치

manage-content/actions.ts
→ Route Handler + Service로 해체

Cloudflare getDb()
→ OCI standalone DB client로 교체
```

---

# 46. 현재 코드에서 유지할 것

유지:

```text
Drizzle schema
Drizzle inferred persistence type
selective columns
relation query
명시적인 domain-specific query
PostgreSQL relation/constraint 활용
```

---

# 47. 현재 코드에서 제거/이동할 것

제거 또는 이동:

```text
Repository 내부 getDb()
Repository 내부 updateTag()
Repository 내부 revalidatePath()
Repository 내부 console.error()
Repository 내부 { success, error }

Server Action 내부 DB query
Server Action 내부 transaction ownership 없는 write orchestration
Server Action을 일반 mutation API처럼 사용하는 패턴

Cloudflare workers env
Hyperdrive-specific DB initialization
```

---

# 48. Architecture boundary

허용 dependency:

```text
Delivery
→ Service
→ Repository
→ DB
```

필요 시:

```text
Service
→ shared contract
Service
→ auth/authz
Service
→ pure lib
```

금지:

```text
Repository → Service
Repository → Next cache
Repository → UI
Repository → TanStack Query

shared → server
client → server/db
client → repository
```

---

# 49. 최종 헌법

1. Repository 계층을 사용한다.
2. Repository는 plain function module로 구현한다.
3. Repository interface/class/DI framework는 만들지 않는다.
4. Repository는 도메인 단위로 구성한다.
5. read/write를 `queries.ts / commands.ts` 전역 파일로 계속 키우지 않는다.
6. Repository는 `getDb()`를 내부에서 호출하지 않는다.
7. Repository는 DB executor를 첫 번째 인자로 받는다.
8. 일반 호출은 `db`, transaction 호출은 `tx`를 전달한다.
9. Transaction boundary는 Service / Use Case가 소유한다.
10. Repository는 transaction을 시작하지 않는다.
11. 하나의 top-level write use case가 하나의 transaction을 소유하는 것을 기본으로 한다.
12. Nested transaction은 특별한 요구가 없으면 사용하지 않는다.
13. 모든 write를 무조건 transaction으로 감싸지 않는다.
14. AsyncLocalStorage 기반 transaction magic은 v1에서 사용하지 않는다.
15. UnitOfWork abstraction을 만들지 않는다.
16. Authorization의 실제 security boundary는 Service다.
17. Handler/RSC/Server Action은 Service를 통해 동일한 application rule을 사용한다.
18. Repository는 Drizzle/persistence concern만 담당한다.
19. Repository는 AppError/ApiError/HTTP/UI message를 모른다.
20. Repository는 Result `{ success, error }`를 반환하지 않는다.
21. Repository는 Next cache를 모른다.
22. Client server-state mutation의 기본 transport는 `TanStack Query → ky → Route Handler → Service`다.
23. Server Action은 기본 mutation transport가 아니다.
24. Server Action은 제한적 경우에만 delivery adapter로 사용한다.
25. RSC는 필요할 경우 Service를 직접 호출한다.
26. 서버 내부 application 호출을 위해 자기 HTTP API를 다시 호출하지 않는다.
27. `queryOptions()`를 서버 application abstraction으로 강제하지 않는다.
28. TanStack hydration/prefetch가 목적일 때만 RSC에서 Query API를 사용한다.
29. Drizzle inferred type은 persistence 내부에서 사용할 수 있다.
30. Drizzle row type을 API DTO로 직접 노출하지 않는다.
31. External DTO는 05 Contract / Validation Architecture를 따른다.
32. Mapper는 plain function으로 구현한다.
33. Generic CRUD Repository를 만들지 않는다.
34. 필요한 domain-specific query를 명시적으로 만든다.
35. Service passthrough를 architecture ceremony로 강제하지 않는다.
36. Unexpected DB error는 원래 exception을 유지한다.
37. Expected application failure는 Service에서 AppError로 표현한다.
38. DB client는 OCI standalone runtime에 맞게 재구성한다.
39. Cloudflare/Hyperdrive 전제는 migration 시 제거한다.
40. 단단함은 abstraction 수가 아니라 transaction ownership과 dependency direction의 명확성에서 얻는다.
