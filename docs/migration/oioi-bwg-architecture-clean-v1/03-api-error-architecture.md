---
title: "API / Error Architecture"
document_id: "03"
version: "1.4"
status: "active"
authority: "architecture"
updated_at: "2026-09-03"
depends_on:
  - "01"
related:
  - "05"
supersedes:
  - "legacy-00-api-error"
  - "03-v0"
  - "03-v1"
tags:
  - "api"
  - "http"
  - "error"
  - "sentry"
---

# oioi-bwg API & Error Architecture v1.4

## 1. 목적

oioi-bwg는 Next.js 16 단일 애플리케이션이다.

별도의 NestJS API 서버 없이 Route Handler와 RSC가 동일한 server service를 사용한다.

목표:

> **Contract / Validation 분리:** Request/Response DTO, Zod validation, Drizzle row ↔ DTO 경계, RHF schema 파생 규칙은 [`05-contract-validation-architecture.md`](./05-contract-validation-architecture.md)를 따른다. 이 문서는 실패 표현과 전달만 책임진다.
- 성공/실패 의미를 HTTP와 Promise의 native semantics에 맞춘다.
- server service를 HTTP에서 분리한다.
- expected failure와 unexpected failure를 구분한다.
- Next.js 위에 NestJS의 Filter / Interceptor / Guard framework를 재구현하지 않는다.
- 실제 반복이 확인되면 작은 helper 함수는 허용한다.

---

## 2. 전체 흐름

```text
Client Component
      |
      | ky
      v
Route Handler
      |
      v
server service
      |
      v
Drizzle / PostgreSQL

RSC
 `---------------------> server service
```

실패 흐름:

```text
Service
  |- success -> DTO
  |- expected application failure -> AppError throw
  `- unexpected failure -> original exception throw
             |
             v
HTTP boundary
  |- AppError -> 4xx ErrorResponse
  |- ZodError -> 400 ErrorResponse
  `- unknown -> Sentry + 500 ErrorResponse
             |
             v
ky
  `- non-2xx -> ApiError
             |
             v
TanStack Query
  |- resolve -> data
  `- reject  -> ApiError
             |
             v
feature/model
             |
             v
UI
```

---

## 3. HTTP status가 성공/실패의 SSOT

성공 응답에 공통 envelope를 사용하지 않는다.

사용하지 않는다.

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

성공하면 API DTO 자체를 반환한다.

```json
{
  "id": "019...",
  "title": "Discord",
  "revision": 4
}
```

HTTP status가 성공과 실패를 표현한다.

```text
2xx = success
4xx = request/application failure
5xx = server failure
```

---

## 4. 성공 응답

공통 success wrapper는 없다.

단일 리소스:

```json
{
  "id": "...",
  "title": "...",
  "revision": 4
}
```

목록:

```json
{
  "items": [],
  "nextCursor": "..."
}
```

생성은 `201`, body가 필요 없는 성공은 `204`를 사용한다.

---

## 5. 실패 응답 계약

실패 응답만 공통 형태를 사용한다.

```ts
type ApiErrorResponse = {
  code: ApiErrorCode;
  message: string;
  details?: ClientSafeErrorDetails;
};
```

현재 구현에서 `ApiErrorCode`는 shared contract의 명시적 enum이고, 공개 `details`는 우선
`VALIDATION_ERROR`의 `{ fieldErrors: Record<string, string[]> }`만 허용한다. 새 code나 공개 details
shape를 추가할 때는 server mapping과 client parser를 같은 변경 단위에서 확장한다.

예:

```json
{
  "code": "SONG_REVISION_CONFLICT",
  "message": "다른 사용자가 먼저 수정했습니다."
}
```

Validation failure는 05번 문서의 boundary validation 규칙을 따르며, HTTP 경계에서는 아래 공통 ErrorResponse로 번역한다.


```json
{
  "code": "VALIDATION_ERROR",
  "message": "입력값이 올바르지 않습니다.",
  "details": {
    "fieldErrors": {
      "title": ["제목을 입력해주세요."]
    }
  }
}
```

`message`는 식별자가 아니다.

Client logic은 `code`를 사용한다.

---

## 6. Server service는 HTTP를 모른다

금지:

```ts
Response.json(...)
NextResponse.json(...)
throw new HttpException(...)
return { status: 409, ... }
```

Service는 application/domain 의미만 안다.

```ts
export async function updateSong(
  ctx: Context,
  input: UpdateSongInput,
): Promise<SongDto> {
  const song = await findSong(input.id);

  if (!song) {
    throw new AppError('SONG_NOT_FOUND');
  }

  if (song.revision !== input.revision) {
    throw new AppError('SONG_REVISION_CONFLICT');
  }

  // ...
}
```

Service에 `404`, `409` 같은 HTTP 어휘를 넣지 않는다.

---

## 7. AppError

Expected application failure는 하나의 `AppError`로 표현한다.

에러마다 class hierarchy를 만들지 않는다.

```ts
type AppErrorCode =
  | 'SONG_NOT_FOUND'
  | 'SONG_REVISION_CONFLICT'
  | 'SONG_INVALID_STATE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN';
```

```ts
class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly details?: unknown,
  ) {
    super(code);
  }
}
```

`AppError`에는 HTTP status를 넣지 않는다.

`details`는 service 내부에서 application context를 전달하기 위한 값일 수 있지만, HTTP response로 그대로 노출하지 않는다.

```text
금지:
DB row
internal id
stack
SQL
raw exception
secret / credential
```

HTTP에 노출할 details는 code별 mapping에서 client-safe shape로 명시적으로 선택한다.

---

## 8. Expected와 Unexpected failure

### Expected

예:

```text
SONG_NOT_FOUND
SONG_REVISION_CONFLICT
SONG_INVALID_STATE
FORBIDDEN
UNAUTHENTICATED
```

`AppError`로 표현한다.

### Unexpected

예:

```text
DB connection failure
programming bug
broken invariant
unexpected third-party exception
```

억지로 `AppError`로 wrapping하지 않는다.

원래 exception을 그대로 전파하고 HTTP boundary에서 Sentry + 500으로 처리한다.

---

## 9. Result 패턴

기본 application/API convention으로 `Result<T, E>`를 사용하지 않는다.

```ts
Promise<Result<Song, ApiError>>
```

이 구조는 두 개의 failure channel을 만든다.

```text
Promise rejection
+
Result error
```

TanStack Query 또한 Promise semantics를 사용하므로 API-wide Result는 어휘와 branching 비용을 증가시킨다.

Result 자체를 금지하지는 않는다.

함수의 정상적인 결과가 복수 상태이고 호출자가 반드시 분기해야 하는 특수한 local case에서만 사용할 수 있다.

---

## 10. null과 throw

absence가 정상적인 함수라면 `null`을 사용할 수 있다.

```ts
findSongBySlug(slug): Promise<Song | null>
```

반대로 use-case가 존재를 전제로 한다면 absence는 failure다.

```ts
getSongDetail(slug)
```

이 경우:

```ts
throw new AppError('SONG_NOT_FOUND');
```

함수의 semantic contract를 기준으로 판단한다.

---

## 11. Validation 책임

### Boundary validation

Zod가 담당한다.

- type
- required field
- UUID 형식
- enum 형태
- request shape

### Application/domain validation

Service가 담당한다.

- publish 가능한 상태인가
- 사용자가 수정 가능한가
- revision이 일치하는가
- 현재 domain rule을 만족하는가

Zod schema가 DB나 application service를 호출하지 않는다.

---

## 12. HTTP status vocabulary

| 상황 | Status |
|---|---:|
| 일반 성공 | 200 |
| 생성 | 201 |
| 반환값 없는 성공 | 204 |
| Request validation | 400 |
| 인증 필요 | 401 |
| 권한 없음 | 403 |
| 리소스 없음 | 404 |
| 상태 / revision conflict | 409 |
| 예상하지 못한 서버 오류 | 500 |

초기에는 400과 422를 세분화하지 않는다.

---

## 13. Error -> HTTP 변환

Application error를 HTTP로 번역하는 위치는 한 곳으로 제한한다.

Request validation과 server output contract validation은 같은 `ZodError`를 사용하지만 의미가 다르다.

```text
Request ZodError
→ client input 문제
→ 400 VALIDATION_ERROR

Output contract violation
→ programming / contract drift
→ unexpected error
→ Sentry + 500
```

따라서 output validation은 raw `ZodError`가 `toErrorResponse()`까지 도달하지 않도록 전용 helper에서 일반 unexpected error로 변환한다.

```ts
function parseResponseContract<T>(
  schema: ZodType<T>,
  value: unknown,
): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new Error('Response contract violation', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
```

Request body/params/query의 boundary parse에서 발생한 `ZodError`만 400으로 취급한다.
`request.json()`의 JSON syntax failure도 공용 request parser가 400 `VALIDATION_ERROR`로 번역하며,
service 내부의 임의 `SyntaxError`까지 validation으로 오인하지 않는다.

AppError의 HTTP status/message/details mapping은 하나의 exhaustive table로 관리한다.

```ts
type AppErrorDefinition = {
  status: number;
  message: string;
  toDetails?: (details: unknown) => unknown;
};

const appErrorDefinitions = {
  SONG_NOT_FOUND: {
    status: 404,
    message: '곡을 찾을 수 없습니다.',
  },
  SONG_REVISION_CONFLICT: {
    status: 409,
    message: '다른 변경과 충돌했습니다.',
    toDetails: toRevisionConflictDetails,
  },
  SONG_INVALID_STATE: {
    status: 409,
    message: '현재 상태에서는 수행할 수 없습니다.',
  },
  UNAUTHENTICATED: {
    status: 401,
    message: '로그인이 필요합니다.',
  },
  FORBIDDEN: {
    status: 403,
    message: '권한이 없습니다.',
  },
} satisfies Record<AppErrorCode, AppErrorDefinition>;
```

`AppErrorCode`가 추가되면 mapping 누락을 compile time에 발견해야 한다.

```ts
function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        code: 'VALIDATION_ERROR',
        message: '입력값이 올바르지 않습니다.',
        details: toValidationDetails(error),
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    const definition =
      appErrorDefinitions[error.code];

    const details =
      definition.toDetails?.(error.details);

    return Response.json(
      {
        code: error.code,
        message: definition.message,
        ...(details === undefined
          ? {}
          : { details }),
      },
      { status: definition.status },
    );
  }

  Sentry.captureException(error);

  return Response.json(
    {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
    },
    { status: 500 },
  );
}
```

중요:

> `error.details`를 HTTP response에 그대로 spread/pass하지 않는다.

이는 NestJS Exception Filter framework가 아니라 `unknown -> Response` 변환 함수 하나다.

---

## 14. Route Handler

초기에는 명시적으로 작성한다.

```ts
export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const input = updateSongSchema.parse({
      ...(await request.json()),
      id: (await context.params).id,
    });

    const ctx = await getRequestContext();
    const result = await updateSong(ctx, input);

    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

역할:

```text
HTTP input
-> parse
-> request context
-> service
-> HTTP output
```

비즈니스 로직은 Route Handler에 넣지 않는다.

---

## 15. Handler helper

반복이 실제 확인되면 작은 helper를 허용한다.

예:

```ts
export function withApiHandler(
  handler: () => Promise<Response>,
) {
  return async () => {
    try {
      return await handler();
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
```

하지만 아래처럼 범용 configuration DSL로 성장하면 재검토한다.

```ts
handler({
  auth: true,
  permission: ['update', 'Song'],
  body: schema,
  output: schema,
  transaction: true,
  audit: true,
  cache: false,
  rateLimit: true,
});
```

원칙:

> 반복 코드를 함수로 추출하는 것은 허용한다.
> 새로운 실행 모델을 만드는 것은 피한다.

---

## 16. Guard 성격의 helper

인증/인가 반복도 일반 함수로 추출할 수 있다.

```ts
export function requireUser(
  ctx: Context,
): asserts ctx is AuthenticatedContext {
  if (!ctx.userId) {
    throw new AppError('UNAUTHENTICATED');
  }
}
```

또는:

```ts
requirePermission(ctx, 'update', song);
```

이것은 Nest Guard framework가 아니라 조건 검사 함수다.

Decorator metadata 시스템을 만들지 않는다.

---

## 17. Interceptor 성격의 helper

다음과 같은 횡단 관심사는 필요가 확인되면 wrapper 함수로 표현할 수 있다.

- error mapping
- request logging
- tracing
- timing

처음부터 interceptor pipeline abstraction을 만들지 않는다.

```ts
composeInterceptors(...)
```

같은 프로젝트 전용 lifecycle이 생기기 시작하면 재검토한다.

---

## 18. Helper 도입 기준

Helper는 세 조건을 모두 만족할 때 만든다.

1. 실제 반복이 존재한다.
2. 반복되는 의미가 동일하다.
3. 추출 후 호출부가 더 명확해진다.

좋은 예:

```ts
requireUser(ctx);
```

주의할 예:

```ts
applyPolicies(ctx, options);
```

내부에서 auth, permission, validation, logging까지 수행한다면 의미가 흐려진다.

---

## 19. Client 2xx Contract Violation

2xx response라도 payload가 Zod contract를 위반하면 정상 성공으로 취급하지 않는다.

이 경우의 의미는 HTTP/API application failure가 아니라
server/client contract drift 또는 programming/system failure다.

따라서:

```text
2xx response
    ↓
contract violation
    ↓
ClientContractError
    ↓
Sentry capture
    ↓
TanStack Query error channel
    ↓
generic system failure UX
```

로 처리한다.

`ClientContractError` 클래스 정의와 `parseClientResponse()` helper 구현은
`05-contract-validation-architecture.md` §16.1을 SSOT로 따른다.

03에서는 해당 구현을 복제하지 않는다.

규칙:

- raw `ZodError`를 TanStack Query error channel로 직접 흘리지 않는다.
- `ClientContractError`를 `ApiError`로 합치지 않는다.
- UI/model은 이를 사용자 입력 오류가 아닌 generic system failure로 처리한다.
- observability 정책에 따라 Sentry에 capture한다.

---


## 20. TanStack Query

TanStack Query에는 Result wrapper를 넣지 않는다.

```text
resolve = data
reject = ApiError
```

Query 전용 custom hook wrapper도 기본적으로 만들지 않는다.

Entity API는 `queryOptions` / `mutationOptions`를 제공하고 feature/model에서 공식 hook을 직접 사용한다.

---

## 21. Feature model과 UI

Feature/model은 `ApiError`를 필요한 UI state로 번역할 수 있다.

```ts
const hasConflict =
  mutation.error instanceof ApiError &&
  mutation.error.code === 'SONG_REVISION_CONFLICT';
```

UI에는 가능하면 transport error 객체 자체보다 해석된 값만 전달한다.

```tsx
<SongEditor
  hasConflict={hasConflict}
  errorMessage={errorMessage}
/>
```

---

## 22. Global / Local error

Global 처리에 적합한 예:

- NETWORK_ERROR
- INTERNAL_SERVER_ERROR
- generic mutation failure

Local 처리에 적합한 예:

- VALIDATION_ERROR
- SONG_REVISION_CONFLICT
- feature-specific domain failure

TanStack Query의 MutationCache와 `meta` 같은 공식 extension point 사용은 허용한다.

범용 mutation wrapper를 만들지 않는다.

---

## 23. Sentry

Expected error는 Sentry에 보내지 않는다.

```text
AppError -> no capture
Request validation ZodError -> no capture
Output/client contract violation -> capture
Unexpected error -> capture
```

운영자가 조사해야 할 오류만 Sentry에 남기는 것을 목표로 한다.

---

## 24. RSC

RSC는 service를 직접 호출한다.

```ts
try {
  const song = await getSong(...);
  return <SongPage song={song} />;
} catch (error) {
  if (
    error instanceof AppError &&
    error.code === 'SONG_NOT_FOUND'
  ) {
    notFound();
  }

  throw error;
}
```

동일한 AppError를 delivery mechanism에 따라 번역한다.

```text
AppError
|- Route Handler -> HTTP 4xx
`- RSC -> notFound / redirect / error boundary
```

---

## 25. Persistence model과 DTO

Drizzle row를 그대로 외부 DTO로 노출하지 않는다.

```text
Persistence Model != External DTO
```

필요한 경우 순수 mapper 함수를 둔다.

```ts
function toSongDto(row: SongRow): SongDto {
  return {
    id: row.publicId,
    title: row.title,
    revision: row.revision,
  };
}
```

Mapper interface, BaseMapper, class hierarchy는 만들지 않는다.

---


> Repository는 이미 채택된 server data-access boundary다. Repository는 06의 plain function module 규칙을 따른다. 03은 generic repository framework/DI abstraction만 금지한다.

## 26. 초기 server 구조

`src/server`의 canonical 구조 예시는 `06-server-data-access-architecture.md` §44가 SSOT다.
03에서는 server directory tree를 복제하지 않는다.

반복이 확인되면 아래 정도의 작은 helper가 추가될 수 있다.

```text
server/http/handler.ts
server/auth/require-user.ts
```

기본적으로 만들지 않는 것:

- Controller class
- UseCase class
- DI container
- Decorator
- Interceptor framework
- Exception Filter framework
- Guard framework
- Pipe framework
- Base class hierarchy

---

## 27. Helper와 framework의 경계

허용 가능한 helper:

```text
toErrorResponse(error)
withApiHandler(fn)
requireUser(ctx)
requirePermission(...)
parseRequest(...)
```

주의 신호:

```text
프로젝트 전용 lifecycle
metadata
custom decorator
거대한 options DSL
middleware/interceptor registry
```

판단 질문:

> helper가 기존 TypeScript/Next.js 코드를 더 읽기 쉽게 만드는가?

YES면 유지한다.

> helper를 이해하려면 프로젝트 전용 실행 모델을 새로 배워야 하는가?

YES면 과도한 abstraction인지 재검토한다.

---

## 28. 최종 규칙

1. HTTP status가 API 성공/실패의 SSOT다.
2. 성공 response에는 공통 envelope를 사용하지 않는다.
3. 실패 response만 `{ code, message, details? }`로 통일한다.
4. Server service는 HTTP와 Next.js를 모른다.
5. Expected application failure는 `AppError`로 표현한다.
6. `AppError`에는 HTTP status가 없다.
7. Unexpected error는 불필요하게 wrapping하지 않는다.
8. Zod는 외부 입력 boundary validation을 담당한다.
9. Business/domain validation은 service가 담당한다.
10. 기본 API convention으로 Result를 사용하지 않는다.
11. Route Handler는 HTTP adapter 역할만 한다.
12. Error -> HTTP 변환은 한 경계에서 수행한다.
13. 반복이 확인되면 작은 handler helper를 만들 수 있다.
14. 인증/인가 반복은 `require*` 일반 함수로 추출할 수 있다.
15. Filter/Interceptor/Guard framework를 만들지 않는다.
16. Helper가 configuration DSL이나 lifecycle system으로 성장하면 재검토한다.
17. ky boundary에서 HTTP error를 `ApiError`로 정규화한다.
18. TanStack Query의 Promise/error semantics를 그대로 사용한다.
19. Query-only custom hook wrapper는 기본적으로 만들지 않는다.
20. Feature/model이 error를 UI state로 해석한다.
21. Expected error는 Sentry에 보내지 않는다.
22. RSC는 service를 직접 호출한다.
23. Persistence model과 API DTO는 분리한다.
24. Mapper가 필요하면 순수함수로 구현한다.
25. DI/Decorator/Base abstraction은 실제 요구가 생기기 전에는 도입하지 않는다.
