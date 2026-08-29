---
title: "Contract / Validation Architecture"
document_id: "05"
version: "1.6"
status: "active"
authority: "architecture"
updated_at: "2026-08-26"
depends_on:
  - "01"
related:
  - "03"
supersedes:
  - "05-v0"
tags:
  - "zod"
  - "contract"
  - "validation"
  - "dto"
  - "drizzle"
  - "pagination"
---

# oioi-bwg Contract / Validation Architecture v1.6

## 1. 목적

이 문서는 oioi-bwg에서 데이터가 레이어와 프로세스 경계를 넘을 때 사용하는 계약과 validation 규칙을 정의한다.

목표:

- Drizzle schema와 API contract의 책임을 분리한다.
- Zod를 HTTP/API boundary contract의 SSOT로 사용한다.
- DB Row, API DTO, Form Model을 동일한 타입으로 취급하지 않는다.
- Request는 한 번 검증한 뒤 service에 전달한다.
- Response는 mapper를 통해 외부 DTO로 변환한다.
- FE는 HTTP JSON을 `unknown`으로 받고 Zod로 검증한 뒤 typed data로 사용한다.
- Error payload도 공통 Zod contract로 검증한다.
- RHF schema는 API contract를 재사용하거나 파생할 수 있지만 UI 모델과 API input을 동일시하지 않는다.
- business/domain validation은 Zod가 아니라 service가 담당한다.
- contract abstraction 자체가 새로운 framework가 되지 않도록 한다.

---

## 2. SSOT는 하나가 아니라 경계별로 존재한다

```text
PostgreSQL
    │
    ▼
Drizzle Schema
= persistence SSOT

HTTP / Process Boundary
    │
    ▼
Zod Contracts
= external contract SSOT

React / Form
    │
    ▼
UI Model
= presentation concern
```

따라서 다음은 서로 같지 않다.

```text
DB Row
≠ API DTO
≠ Form Model
```

---

## 3. Drizzle Schema의 책임

Drizzle schema는 persistence model의 SSOT다.

담당:

```text
table
column
constraint
index
foreign key
database representation
DB default
persistence row type
```

Drizzle에서 유도한 타입은 persistence 내부에서 사용할 수 있다.

```ts
type SongRow = typeof songs.$inferSelect;
```

하지만 이 타입을 API contract나 FE 타입으로 직접 노출하지 않는다.

---

## 4. DB Row를 API DTO로 직접 노출하지 않는다

Persistence model에는 외부에 필요하지 않은 정보가 포함될 수 있다.

예:

```text
internal bigint id
foreign key internal id
password hash
audit metadata
DB-specific timestamp representation
internal flags
```

따라서:

```text
Drizzle Row
    ↓
Mapper
    ↓
API DTO
```

경계를 둔다.

Mapper는 순수함수로 충분하다.

```ts
export function toSongDto(row: SongRow): SongDto {
  return {
    id: row.publicId,
    title: row.title,
    revision: row.revision,
  };
}
```

다음 abstraction은 기본적으로 만들지 않는다.

```text
Mapper interface
BaseMapper
Mapper class hierarchy
AutoMapper framework
```

---

## 5. Zod Contract의 책임

Zod는 외부/API boundary를 넘는 데이터의 runtime contract를 담당한다.

주요 대상:

```text
Route Handler request params
Route Handler query
Route Handler body
API response DTO
API error response
serializable authz rule contract
필요한 외부 integration payload
```

Zod contract에서 TypeScript 타입을 유도한다.

```ts
export const songDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  revision: z.number().int().positive(),
});

export type SongDto = z.infer<typeof songDtoSchema>;
```

---

## 6. 공통 Contract 위치

초기 기준:

```text
src/shared/contracts/
├─ error.ts
├─ song.ts
├─ album.ts
└─ translation.ts
```

규모가 커지면 도메인별 하위 폴더로 분리한다.

빈 폴더나 과도한 파일 분리는 미리 만들지 않는다.

---

## 7. Input Contract

예:

```ts
export const updateSongInputSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1),
  lyrics: lyricsSchema,
  revision: z.number().int().positive(),
});

export type UpdateSongInput = z.infer<typeof updateSongInputSchema>;
```

이 schema는 HTTP request boundary의 계약이다.

---

## 8. Request validation은 Route Handler에서 한 번 수행한다

```text
HTTP Request
    ↓
unknown
    ↓
Zod parse
    ↓
trusted input
    ↓
Service
```

예:

```ts
const params = songParamsSchema.parse(await context.params);
const body = updateSongBodySchema.parse(await request.json());

const input: UpdateSongInput = {
  id: params.id,
  ...body,
};

const result = await updateSong(ctx, input);
```

Service는 이미 검증된 타입을 받으며 같은 입력을 다시 parse하지 않는다.

---

## 9. Params / Query / Body를 구분한다

필요하면 각각 schema를 둔다.

```ts
const songParamsSchema = z.object({
  id: z.uuid(),
});

const songQuerySchema = z.object({
  locale: localeSchema.optional(),
});

const updateSongBodySchema = z.object({
  title: z.string().trim().min(1),
  lyrics: lyricsSchema,
  revision: z.number().int().positive(),
});
```

모든 endpoint를 하나의 generic request schema DSL로 만들지는 않는다.

---

## 10. Boundary validation과 Business validation을 분리한다

### Boundary validation

Zod가 담당한다.

```text
string인가
number인가
UUID 형식인가
필수 필드가 있는가
배열 구조가 맞는가
지원하는 locale 문자열인가
길이/형식 제한이 맞는가
```

### Business / Domain validation

Service가 담당한다.

```text
현재 상태에서 publish 가능한가
현재 사용자가 이 곡을 수정 가능한가
revision이 최신인가
해당 album에 실제로 song이 속하는가
현재 번역 상태에서 전이가 가능한가
```

Business rule을 Zod async refine + DB query로 구현하지 않는다.

Zod schema는 application service를 호출하지 않는다.

---

## 11. Response DTO도 Contract다

Response는 persistence row가 아니라 외부 DTO다.

```ts
export const songDtoSchema = z.object({
  id: z.uuid(),
  albumId: z.uuid(),
  title: z.string(),
  status: songStatusSchema,
  revision: z.number().int().positive(),
});
```

외부 DTO는 공개할 필드를 allow-list 방식으로 명시한다.

---

## 12. Server output validation

v1 기본값은 중요한 API response를 Zod로 검증한다.

```ts
const result = await getSong(ctx, input);

return Response.json(
  songDtoSchema.parse(result),
);
```

장점:

```text
실수로 internal field 노출 방지
mapper/contract drift 조기 발견
runtime contract 보장
```

실제 profiling에서 큰 목록 response의 parse 비용이 문제가 되는 경우에만 제한적으로 완화한다.

---

## 13. Request ZodError와 Output ZodError를 구분한다

Request parse 실패는 사용자 요청 문제다.

```text
Request ZodError
→ VALIDATION_ERROR
→ 400
```

반면 서버가 만든 response가 DTO schema를 통과하지 못하면 programming error 또는 contract drift다.

```text
Output contract violation
→ unexpected server failure
→ Sentry
→ 500
```

따라서 모든 `ZodError`를 무조건 400으로 매핑하지 않는다.

Output validation은 전용 helper에서 raw `ZodError`를 unexpected `Error`로 변환한다.

`parseResponseContract()`의 구현은 `03-api-error-architecture.md` §13을 SSOT로 따른다.

05에서는 다음 원칙만 정의한다.

- Request boundary의 `ZodError`는 사용자 입력 오류이므로 400으로 변환될 수 있다.
- Output contract violation은 서버가 자신의 계약을 어긴 것이므로 500 + Sentry 대상이다.
- Output validation 단계에서 raw `ZodError`가 `toErrorResponse()`까지 직접 도달하지 않게 한다.
- 실제 helper 구현은 03에만 둔다.

그 결과 `03-api-error-architecture.md`의 `toErrorResponse()`에 raw `ZodError`가 도달했다면 기본적으로 request boundary validation failure로 해석할 수 있다.

---

## 14. API/Error Architecture와의 연결

이 문서는 다음을 정의한다.

```text
무엇을 검증하는가
어디에서 검증하는가
어떤 schema가 계약인가
```

`03-api-error-architecture.md`는 다음을 정의한다.

```text
검증 실패를 어떤 error로 표현하는가
HTTP status는 무엇인가
Client에서 어떻게 ApiError가 되는가
```

---

## 15. Error Response도 Zod Contract다

```ts
export const apiErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
```

서버는 이 contract에 맞는 payload를 반환하고 Client는 error body도 검증한다.

---

## 16. Client HTTP response는 unknown에서 시작한다

기본적으로 다음 방식은 사용하지 않는다.

```ts
const data = await http
  .get('songs/1')
  .json<SongDto>();
```

이 코드는 runtime response를 검증하지 않는다.

기본 패턴:

```ts
const data = await http
  .get(`songs/${id}`)
  .json<unknown>();

return parseClientResponse(
  songDtoSchema,
  data,
);
```

```text
HTTP JSON
    ↓
unknown
    ↓
parseClientResponse()
    ↓
Zod safeParse
    ├─ success → SongDto
    └─ failure → ClientContractError + Sentry
    ↓
TanStack Query
```

---

## 16.1. Client contract violation

2xx response라고 해도 payload는 신뢰하지 않는다.

Client response validation 실패는 HTTP application error가 아니라
server/client contract drift 또는 programming/system error로 취급한다.

따라서 `ApiError`로 합치지 않는다.

```ts
export class ClientContractError extends Error {
  readonly cause: ZodError;

  constructor(cause: ZodError) {
    super("API response contract violation");
    this.name = "ClientContractError";
    this.cause = cause;
  }
}
```

공통 parsing helper:

```ts
export function parseClientResponse<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const error =
      new ClientContractError(result.error);

    Sentry.captureException(error);
    throw error;
  }

  return result.data;
}
```

흐름:

```text
2xx HTTP JSON
    ↓
unknown
    ↓
Zod safeParse
    ├─ success → typed DTO
    └─ failure
          ↓
    ClientContractError
          ↓
       Sentry
          ↓
  TanStack Query error channel
```

`ClientContractError`는 사용자에게 서버 validation message를 보여주기 위한 에러가 아니다.
일반적인 system error UX로 처리한다.

---

## 17. Entity API layer

예:

```text
entities/song/api/
├─ get-song.ts
├─ update-song.ts
├─ queries.ts
└─ mutations.ts
```

Client API는 HTTP payload를 `unknown`으로 받은 뒤 반드시 공통 contract parser를 통과시킨다.

```ts
export async function getSong(
  id: string,
): Promise<SongDto> {
  const data = await http
    .get(`songs/${id}`)
    .json<unknown>();

  return parseClientResponse(
    songDtoSchema,
    data,
  );
}
```

TanStack Query:

`songQueries` / `queryOptions()` factory 구현과 query-key hierarchy는 `02-frontend-architecture.md` §7/§13이 SSOT다. 05는 Client API가 DTO contract를 검증한 뒤 typed data를 반환한다는 경계만 소유한다.


Client API example에서 raw `schema.parse(data)`를 직접 사용하지 않는다.

그 이유는 response contract violation을 항상:

```text
ClientContractError
+ Sentry capture
```

경로로 정규화하기 위해서다.

---


## 18. Client error payload validation

ky가 non-2xx response를 받으면 error payload를 검증한 뒤 `ApiError`로 정규화한다.

M4의 shared Ky client는 `throwHttpErrors: false`를 설정하지 않는다. non-2xx를 정상
response 흐름으로 섞지 않고, Ky의 HTTP error boundary에서만 아래 정규화를 수행한다.
Ky 2의 `HTTPError`는 error body를 `error.data`에 한 번 소비해 둔다. 따라서
`error.response.json()`을 다시 호출하지 않고 `error.data`를 `unknown`으로 검증한다. JSON이
아니거나 schema가 맞지 않으면 안정적인 fallback `ApiError`를 만든다.

```ts
if (isHTTPError(error)) {
  const raw: unknown = error.data;

  const parsed = apiErrorResponseSchema.safeParse(raw);
}
```

정상 contract면 해당 `code/message/details`로 `ApiError`를 생성한다.

잘못된 error body라면 안정적인 fallback error로 정규화한다.

성공 response도 신뢰하지 않는다. Client API는 `json<unknown>()` 결과를 output schema parser로
넘기며, 2xx body가 contract를 위반하면 `ClientContractError`와 observability 경로로 처리한다.
이 규칙을 Ky hook이나 범용 response wrapper에 숨기지 않는다.

---

## 19. RHF Form Model은 API Input과 같지 않을 수 있다

API input:

```ts
export const updateSongInputSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  title: z.string().trim().min(1),
  lyrics: lyricsSchema,
});
```

Form에서 실제 편집하는 값이 `title`, `lyrics`뿐이라면:

```ts
export const songEditorFormSchema =
  updateSongInputSchema.pick({
    title: true,
    lyrics: true,
  });
```

처럼 파생할 수 있다.

---

## 20. Form → API Command 조립은 model/orchestration 책임이다

```ts
const input: UpdateSongInput = {
  id: song.id,
  revision: song.revision,
  ...formValues,
};
```

```text
UI
→ Form values

model
→ API command

entity api
→ HTTP
```

Dumb UI가 API command shape를 직접 조립하지 않는다.

---

## 21. RHF schema를 무조건 API schema에서 파생하지 않는다

Form UX 요구와 API contract가 다를 수 있다.

예:

```text
confirmPassword
UI-only checkbox
temporary input string
date input string
presentation 전용 field
```

이 경우 별도 form schema를 만드는 것이 정상이다.

```text
Form Model
    ↓
explicit mapping
    ↓
API Input Contract
```

---

## 22. Zod schema 재사용 기준

재사용한다:

```text
동일한 의미
동일한 validation rule
동일한 boundary contract
```

별도로 만든다:

```text
같아 보이지만 의미가 다름
UI 전용 상태
DB 내부 표현
도메인 계산용 내부 모델
```

중복 제거만을 위해 의미가 다른 schema를 강제로 합치지 않는다.

---

## 23. Schema composition은 Zod 기본 어휘를 사용한다

사용:

```text
pick
omit
extend
partial
필요한 경우 merge
```

프로젝트 전용 schema builder framework를 만들지 않는다.

---

## 24. Contract 이름은 역할을 드러낸다

좋은 예:

```text
SongDto
UpdateSongInput
CreateSongInput
SongListDto
ApiErrorResponse
SongEditorFormValues
```

피하는 예:

```text
SongData
SongModel
SongPayload
CommonResponse<T>
BaseDto
```

---

## 25. 내부 타입을 모두 Zod로 만들지 않는다

런타임 validation이 필요 없는 내부 계산 타입은 TypeScript로 충분할 수 있다.

```ts
type LyricsSyncState = {
  activeLine: number;
  progress: number;
};
```

판단 기준:

> 이 값이 신뢰할 수 없는 경계를 넘어오는가?

YES → Zod 검토  
NO → TypeScript 타입으로 충분할 수 있다.

---

## 25.1. Pagination Contract

목록 pagination이 필요한 endpoint는 cursor 기반 contract를 기본으로 한다.

Response shape:

```ts
type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
```

규칙:

```text
items
= 현재 page의 결과

nextCursor
= 다음 요청에 그대로 전달할 opaque cursor

nextCursor: null
= 다음 page가 없음
```

Client는 cursor를 parse하거나 내부 의미에 의존하지 않는다.

Cursor encoding은 server implementation detail이다.

```text
Server
stable sort key(s)
+ unique tie-breaker
        ↓
opaque cursor encoding
        ↓
Client
그대로 보관/전달
```

Cursor pagination query는 반드시 deterministic order를 가져야 한다.

예:

```text
updatedAt DESC
+ id DESC
```

처럼 unique tie-breaker를 포함한다.

Endpoint마다 `{ data, pageInfo }`, `{ rows, cursor }`, `{ list, next }`처럼 서로 다른 pagination envelope를 만들지 않는다.

Pagination이 필요 없는 작은 목록까지 억지로 이 contract를 사용하지 않는다.

---

## 26. Contract change 규율

API contract가 바뀌면 같은 변경 단위에서 다음을 함께 수정한다.

```text
Zod contract
server mapper/service
Route Handler
client API parse
query/mutation 사용처
관련 fixture/test
```

---

## 27. Contract test 전략

### Schema test
복잡한 custom validation만 테스트한다. Zod 자체를 다시 테스트하지 않는다.

### Mapper test
내부 field가 DTO에 노출되지 않는지와 변환 정확성을 테스트한다.

### Route contract test
대표 endpoint에서 잘못된 request → 400, 정상 response → output schema 통과를 확인한다.

### Client API test
정상 payload, 깨진 payload, error payload normalization을 fixture/MSW로 확인한다.

---

## 28. Shared contract의 server-only dependency 금지

`shared/contracts`는 Client bundle에서도 import될 수 있다.

따라서 다음을 import하지 않는다.

```text
Drizzle DB client
Node-only module
server env
filesystem
Auth.js server config
server service
```

Serializable schema와 타입만 둔다.

---

## 29. Security 원칙

API DTO schema는 외부에 공개할 필드를 직접 선언한다.

DB schema에서 `omit()`으로 내부 필드를 제거해 API DTO를 만드는 방식을 기본으로 하지 않는다.

즉 external contract는 allow-list다.

---

## 30. Zod / CASL / Service의 책임 분리

```text
Zod
= 요청/응답의 형태가 유효한가

CASL
= 이 사용자가 이 작업을 할 수 있는가

Service
= 현재 business state에서 이 작업이 가능한가
```

각 책임을 서로 대신하지 않는다.

---

## 31. 다른 설계 문서와의 연결

```text
03-api-error-architecture.md
= error propagation / HTTP semantics

04-auth-authz-architecture.md
= Auth.js / CASL / identity / authorization

05-contract-validation-architecture.md
= Zod / DTO / Drizzle / RHF / boundary validation
```

대표 흐름:

```text
Request
  ↓
Zod input validation          (05)
  ↓
getRequestContext / CASL      (04)
  ↓
Service business rules
  ↓
DTO mapper + output schema    (05)
  ↓
Response / AppError mapping   (03)
```

---

## 32. 최종 헌법

1. Drizzle schema는 persistence SSOT다.
2. Zod contract는 HTTP/API boundary의 SSOT다.
3. DB Row, API DTO, Form Model은 동일하지 않다.
4. Drizzle row type을 Client/API contract로 직접 노출하지 않는다.
5. External DTO는 공개 필드를 allow-list 방식으로 정의한다.
6. Request input은 Route Handler boundary에서 Zod로 검증한다.
7. Service는 검증된 input을 받으며 같은 schema를 반복 parse하지 않는다.
8. Zod는 shape/format boundary validation을 담당한다.
9. business/domain validation은 service가 담당한다.
10. Zod schema에서 DB/application service를 호출하지 않는다.
11. Response는 mapper를 거쳐 DTO contract에 맞춘다.
12. v1에서는 중요 API의 server output도 Zod validation 한다.
13. Request parse failure와 output contract failure를 구분한다.
14. Request validation failure는 400으로 번역한다.
15. Output contract failure는 서버 버그로 보고 500/Sentry 대상으로 취급한다.
16. Client HTTP JSON은 `unknown`에서 시작한다.
17. Client API layer에서 Zod parse 후 typed data를 반환한다.
18. Error response도 공통 Zod contract로 검증한다.
19. RHF form schema는 API contract에서 파생할 수 있지만 강제하지 않는다.
20. Form Model과 API Input이 다르면 명시적으로 mapping한다.
21. 내부 계산 타입에 불필요한 Zod schema를 만들지 않는다.
22. Zod 기본 composition API를 우선 사용한다.
23. 프로젝트 전용 schema framework를 만들지 않는다.
24. Contract 이름은 사용 경계를 드러내야 한다.
25. API contract 변경은 관련 server/client/test와 같은 변경 단위로 처리한다.
26. shared contract에는 server-only dependency를 넣지 않는다.
27. Zod validation, CASL authorization, service business rule은 서로 다른 책임이다.
28. 단일 schema로 전체 시스템을 통일하려 하지 않는다.
29. 경계별 SSOT를 명확하게 유지한다.
