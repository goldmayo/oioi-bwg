---
title: "Authentication / Authorization Architecture"
document_id: "04"
version: "1.2"
status: "active"
authority: "architecture"
updated_at: "2026-08-30"
depends_on:
  - "01"
  - "03"
  - "05"
related:
  - "06"
supersedes:
  - "04-v1"
tags:
  - "auth"
  - "authz"
  - "authjs"
  - "casl"
  - "security"
---

# oioi-bwg Authentication / Authorization Architecture v1.2

## 1. 목적

oioi-bwg는 Next.js 16 단일 애플리케이션으로 구성한다.

인증과 인가는 API/Error Architecture와 밀접하게 연결되지만 책임은 분리한다.

이 문서의 목표는 다음과 같다.

- 인증(Authentication)과 인가(Authorization)를 분리한다.
- Auth.js는 identity/session 처리에 집중한다.
- CASL을 서버와 클라이언트가 공유하는 인가 어휘로 사용한다.
- DB에는 사용자 role 같은 사실 데이터만 저장한다.
- 인가 정책 자체는 TypeScript 코드에서 정의한다.
- 서버가 항상 보안의 SSOT가 된다.
- FE는 서버와 동일한 CASL rules를 사용해 UX 권한을 계산한다.
- NestJS Guard/Decorator/Metadata 시스템을 Next.js 위에 재구현하지 않는다.
- DB policy engine, policy release/version, 자체 permission DSL은 v1에서 만들지 않는다.
- 실제 복잡도 증가가 확인될 때만 동적 정책 시스템을 재검토한다.

---

# 2. 전체 구조

```text
Auth.js
  │
  └─ identity / session
       │
       ▼
getRequestContext()
       │
       ├─ user
       └─ role
       │
       ▼
buildAbilityRules(ctx)
       │
       ▼
CASL Ability
       │
       ├───────────────┐
       │               │
       ▼               ▼
Server Service      Client FE
security boundary   UX permission
       │               │
       ▼               ▼
ability.can()       ability.can()
ability.cannot()    <Can> / useAbility()
       │
       ▼
AppError
       │
       ├─ Route Handler → HTTP 401 / 403
       └─ RSC → redirect / forbidden / error boundary
```

핵심 책임은 다음과 같다.

```text
Auth.js
= 누구인가

DB
= 현재 사용자의 role 사실 데이터

buildAbilityRules()
= 정책 정의

CASL
= 정책 평가

service
= 실제 보안 경계

FE
= 동일 rule 기반 UX 제어

AppError
= 실패 표현

HTTP / RSC
= delivery mechanism별 번역
```

---

# 3. 인증과 인가를 분리한다

Authentication은 다음 질문에 답한다.

> 이 요청의 사용자는 누구인가?

Auth.js가 담당한다.

Authorization은 다음 질문에 답한다.

> 이 사용자가 이 리소스에 이 작업을 수행할 수 있는가?

CASL Ability가 담당한다.

둘을 섞지 않는다.

```text
session
= identity

DB
= mutable authorization facts

TypeScript rules
= authorization policy

CASL
= authorization decision
```

---

# 4. Auth.js 역할

Auth.js는 다음 책임만 가진다.

```text
로그인
세션 발급
세션 검증
로그아웃
현재 사용자 identity 제공
```

초기 계획:

```text
Provider
= Credentials

Password hashing
= argon2id

Session
= Auth.js JWT session
```

JWT에는 최소한의 identity만 둔다.

```ts
type SessionIdentity = {
  userId: string;
};
```

다음 정보는 기본적으로 JWT에 넣지 않는다.

```text
role
permissions
CASL rules
```

이 값들은 변경 가능하며 세션 lifetime과 authorization lifetime을 결합시키기 때문이다.

---

# 5. Authorization facts의 SSOT는 DB다

v1에서 mutable authorization fact는 Account의 단일 role이다.

```text
USER / REVIEWER / ADMIN role 변경
Account 활성 상태 변경
```

이런 변경은 다음 요청부터 인가 판단에 반영되어야 한다.

따라서:

```text
JWT
= stable identity

DB
= mutable authorization facts
```

를 기본 원칙으로 한다.

---

# 6. Request Context

서버에서는 현재 요청의 identity와 최종 CASL Ability를 하나의 context로 구성한다.

Authorization facts는 Ability를 만들기 위한 내부 입력이며 Service에 기본 노출하지 않는다.

```ts
type AuthorizationFacts = {
  accountId: string | null;
  role: Role | null;
};

type RequestContext =
  | {
      user: null;
      ability: AppAbility;
    }
  | {
      user: {
        id: string;
      };
      ability: AppAbility;
    };
```

최종 `RequestContext` shape는 위 형태 하나로 고정한다.

```text
DB authorization facts
        ↓
AuthorizationFacts
        ↓
buildAbilityRules()
        ↓
AppAbility
        ↓
RequestContext
```

`getRequestContext()`는 다음을 수행한다.

```text
Auth.js session 확인
현재 user 존재/활성 상태 확인
role 조회
AuthorizationFacts 구성
CASL rules / Ability 생성
RequestContext 반환
```

다음은 담당하지 않는다.

```text
도메인 mutation
HTTP response 생성
API DTO 변환
business workflow 실행
```

Service는 일반적으로 `ctx.user`와 `ctx.ability`만 소비한다.

Role raw fact가 별도 business requirement로 실제 필요해질 때만 명시적으로 추가한다.

---

# 7. 요청 단위 memoization

RSC에서 동일 요청 안에 여러 컴포넌트가 context를 사용할 수 있다.

이 경우 React `cache()`를 사용해 동일 요청 내 중복 조회를 줄일 수 있다.

```ts
export const getRequestContext = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    return guestContext;
  }

  return buildUserContext(session.user.id);
});
```

이 cache는 global authorization cache가 아니다.

목적은 동일 요청의 중복 계산 제거다.

구현 시 현재 사용자 활성 상태와 role을 필요한 최소 projection과 적은 round-trip으로 읽는다.

```text
React cache()
= 동일 요청 내 중복 제거

DB query shape 최적화
= request 최초 context 구성 비용 절감
```

둘은 다른 문제다.

---

# 8. CASL을 인가의 공통 어휘로 사용한다

우리 프로젝트가 직접 다음과 같은 permission helper 집합을 확장해 가지 않는다.

```text
canUpdateSong()
canPublishSong()
canDeleteSong()
canEditTranslation()
assertCanUpdateSong()
assertCanPublishSong()
...
```

대신 CASL의 기본 어휘를 사용한다.

```text
ability
can
cannot
action
subject
```

예:

```ts
ability.can('update', song);
ability.cannot('publish', song);
```

이는 프로젝트 전용 permission framework를 만드는 것보다 어휘 비용이 낮다.

---

# 9. 정책 정의는 TypeScript 코드에 둔다

v1에서는 정책을 DB JSON으로 저장하지 않는다.

정책은 `buildAbilityRules()`에서 정의한다.

개념 예:

```ts
export function buildAbilityRules(
  ctx: AuthorizationFacts,
) {
  const { can, cannot, rules } =
    new AbilityBuilder(createMongoAbility);

  can('read', 'Song', {
    status: 'published',
  });

  if (ctx.role) {
    can('create', 'Contribution');
    can('create', 'DiscussionThread');
    can('create', 'DiscussionComment');
    can('create', 'Report');
  }

  if (ctx.role === 'REVIEWER') {
    can(['resolve', 'reject'], 'DiscussionThread');
  }

  if (ctx.role === 'ADMIN') {
    can('manage', 'all');
  }

  return rules;
}
```

이 함수가 authorization policy의 SSOT다.

---

# 10. CASL Ability 생성

서버에서는 request context를 기반으로 ability를 생성한다.

```ts
export function buildAbility(
  ctx: AuthorizationFacts,
) {
  return createMongoAbility(
    buildAbilityRules(ctx),
  );
}
```

`getRequestContext()`는 최종적으로 `user + ability` shape를 반환한다. Service는 role 저장 구조를
직접 알 필요가 없다.

---

# 11. Service가 실제 security boundary다

Route Handler나 Proxy만 검사하고 끝내지 않는다.

실제 use case 내부에서 resource를 조회한 후 CASL로 권한을 검사한다.

```ts
export async function updateSong(
  ctx: RequestContext,
  input: UpdateSongInput,
) {
  requireUser(ctx);

  const song = await findSongForUpdate(input.id);

  if (!song) {
    throw new AppError('SONG_NOT_FOUND');
  }

  if (
    ctx.ability.cannot(
      'update',
      subject('Song', toSongAuthSubject(song)),
    )
  ) {
    throw new AppError('FORBIDDEN');
  }

  // update
}
```

인가 판단은 use case의 일부다.

---

# 12. requireUser()는 유지한다

CASL은 authorization을 담당하지만 authentication 부재 자체를 표현하는 작은 helper는 여전히 유용하다.

```ts
export function requireUser(
  ctx: RequestContext,
): asserts ctx is AuthenticatedRequestContext {
  if (!ctx.user) {
    throw new AppError('UNAUTHENTICATED');
  }
}
```

이것은 NestJS Guard framework가 아니다.

단순한 assertion helper다.

---

# 13. requireRole()은 기본 패턴으로 두지 않는다

CASL을 사용한다면 role별 helper를 다시 늘리지 않는다.

기본적으로:

```ts
ctx.ability.can('manage', 'User')
```

또는 실제 subject/action 조합을 사용한다.

Role은 정책을 만드는 입력 데이터일 뿐, service가 직접 알아야 하는 application vocabulary가 되지 않도록 한다.

예외적으로 아주 단순한 bootstrap/운영 코드에서 role 자체를 확인해야 할 필요가 실제 생기면 사용할 수 있지만 기본 패턴은 아니다.

---

# 14. Resource-level authorization

실제 resource 상태가 필요한 권한은 resource를 조회한 뒤 검사한다.

예를 들어 Comment 작성자 본인인가, Revision이 freeze됐는가 같은 실제 resource 상태는 resource를
조회한 뒤 정책용 subject로 변환해 판단한다. 수정 허용 시간 같은 business rule은 Service가 별도로
검증한다.

```ts
if (
  ctx.ability.cannot(
    'update',
    subject('Song', songAuthView),
  )
) {
  throw new AppError('FORBIDDEN');
}
```

---

# 15. Authorization subject는 외부/정책용 shape를 사용한다

CASL 조건이 평가하는 subject shape를 명확히 한다.

DB row 전체를 그대로 CASL에 넘기는 것을 기본값으로 하지 않는다.

예:

```ts
type SongAuthSubject = {
  id: string;
  albumId: string;
  status: SongStatus;
};
```

```ts
function toSongAuthSubject(
  song: SongRow,
): SongAuthSubject {
  return {
    id: song.publicId,
    albumId: song.album.publicId,
    status: song.status,
  };
}
```

정책이 persistence 내부 id에 종속되지 않게 한다.

---

# 16. FE에서도 동일한 CASL rules를 사용한다

FE가 다음처럼 서버 정책을 직접 복제하지 않는다.

```ts
role === 'REVIEWER' &&
thread.status === 'OPEN'
```

대신 현재 사용자의 CASL rules를 서버에서 전달받아 Ability를 만든다.

v1 schema는 DOMAIN_SPECIFICATION의 단일 `USER/REVIEWER/ADMIN` role을 사용한다.

개념적으로:

```text
GET /api/me/permissions
        ↓
CASL rules
        ↓
createMongoAbility(rules)
        ↓
AbilityProvider
```

---

# 17. FE Permission Contract

예:

```json
{
  "rules": [
    {
      "action": "read",
      "subject": "Song",
      "conditions": {
        "status": "published"
      }
    },
    {
      "action": "update",
      "subject": "Song",
      "conditions": {
        "albumId": {
          "$in": ["album-a", "album-b"]
        },
        "status": {
          "$in": ["draft", "in_review"]
        }
      }
    }
  ]
}
```

클라이언트:

```ts
const ability = createMongoAbility(rules);
```

CASL rules를 client에 전달하면 조건에 포함된 Account id나 resource 식별자 같은 일부
authorization facts도 client에서 관찰 가능하다.

이는 v1에서 의도적으로 수용하는 trade-off다.

```text
rules에 포함해도 되는 것
= UI 권한 계산에 필요한 non-secret authorization facts

포함하면 안 되는 것
= secret
= credential
= 내부 보안 판단에만 필요한 민감 정보
```

Client rules는 UX를 위한 것이며 숨겨야만 안전한 정보를 policy condition에 넣지 않는다.

이후:

```ts
ability.can(
  'update',
  subject('Song', song),
);
```

으로 UI 권한을 계산한다.

---

# 18. Capability DTO는 기본적으로 사용하지 않는다

CASL을 사용하므로 각 DTO마다 다음 값을 서버에서 계산해 붙이는 방식을 기본값으로 하지 않는다.

```json
{
  "capabilities": {
    "update": true,
    "publish": false
  }
}
```

대신:

```text
resource DTO
+
current user's CASL rules
```

를 FE가 조합하여 capability를 계산한다.

장점:

```text
resource 목록마다 capability 필드 생성 불필요
permission N+1 계산 불필요
서버/FE가 같은 CASL vocabulary 사용
```

특정 API에서 명시적 capability snapshot이 더 적합한 요구가 생기면 예외적으로 사용할 수 있다.

---

# 19. FE authorization은 UX일 뿐이다

FE의 `ability.can()` 결과는 보안 경계가 아니다.

예:

```tsx
<Button
  disabled={
    ability.cannot(
      'publish',
      subject('Song', song),
    )
  }
>
  Publish
</Button>
```

실제 mutation 요청이 들어오면 서버 service는 다시 동일 권한을 평가한다.

```text
FE CASL
= UX

Server CASL
= security boundary
```

서버가 항상 이긴다.

---

# 20. Rule 전달과 사용자별 캐시

CASL rules는 사용자마다 다를 수 있다.

따라서:

```text
/api/me/permissions
```

응답은 사용자 context에 종속된다.

public/shared cache 대상으로 취급하지 않는다.

TanStack Query에서는 현재 로그인 사용자 권한 상태로 관리한다.

로그인/로그아웃/권한 변경 시 invalidate되어야 한다.

---

# 21. 권한 변경 반영

v1에서는 DB의 role이나 Account 활성 상태가 변경되면 서버 다음 요청부터 새 ability가 만들어진다.

FE는 즉시 최신 상태가 아닐 수 있다.

초기 전략:

```text
permissions query
staleTime 설정
window focus refetch
로그인/로그아웃 시 invalidate
403 수신 시 permissions invalidate
```

이 정도로 충분히 시작한다.

정책 version header나 release version 시스템은 v1에서 만들지 않는다.

---

# 22. 403 self-healing

FE가 오래된 rules를 가지고 있어 UI에서 허용했다고 해도 서버가 최종 판단한다.

흐름:

```text
FE ability.can() → true
        ↓
mutation
        ↓
Server ability.cannot() → true
        ↓
403 FORBIDDEN
        ↓
permissions query invalidate
        ↓
최신 rules refetch
        ↓
UI 수렴
```

이것이 FE/BE authorization mismatch의 기본 복구 방식이다.

---

# 23. 인증/인가 실패와 AppError

Authentication failure:

```ts
throw new AppError('UNAUTHENTICATED');
```

Authorization failure:

```ts
throw new AppError('FORBIDDEN');
```

API/Error Architecture에서:

```text
UNAUTHENTICATED → HTTP 401
FORBIDDEN       → HTTP 403
```

로 번역한다.

CASL이 HTTP status를 알 필요는 없다.

---

# 24. RSC에서 동일한 ability를 사용한다

Route Handler와 RSC는 같은 `getRequestContext()`와 Ability 생성 경로를 사용한다.

```text
Client
→ Route Handler
→ getRequestContext()
→ Service

RSC
→ getRequestContext()
→ Service
```

RSC에서도 필요하면:

```ts
ctx.ability.can(...)
```

으로 UI entry gating을 할 수 있다.

하지만 실제 mutation/read protection은 service에서 다시 수행한다.

---

# 25. Proxy는 보안 경계가 아니다

`proxy.ts`는 UX용 optimistic routing check 정도만 담당한다.

예:

```text
/admin/*
→ session이 없으면 login redirect
```

Proxy를 통과했다는 이유로 service의 인증/인가 확인을 생략하지 않는다.

---

# 26. 로그인 실패는 Auth.js contract에 맡긴다

Credentials 로그인 실패는 일반 application API error protocol에 억지로 통합하지 않는다.

```text
Auth.js sign-in protocol
≠
application API error protocol
```

UI에서는 필요한 사용자 의미로 번역한다.

---

# 27. CSRF

초기에는 별도 커스텀 CSRF framework를 만들지 않는다.

기본 전제:

```text
Auth.js session cookie
same-origin Next.js Route Handler
```

실제 구현 단계에서 다음을 검증한다.

```text
Auth.js cookie 설정
SameSite
Secure
HttpOnly
mutation request Origin 검증 필요성
```

필요하면 작은 Origin validation helper를 추가한다.

---

# 28. JWT session과 권한 회수

JWT에 authorization state를 넣지 않으므로 role 변경은 다음 요청부터 반영 가능하다.

사용자가 disabled/deleted 상태라면 `getRequestContext()`가 정상 authenticated context를 만들지 않도록 한다.

---

# 29. Session revocation은 YAGNI

v1에서는 기본 구현하지 않는다.

```text
device별 session 관리
session 목록
특정 session revoke
session family
refresh rotation
sessionVersion
```

실제 요구가 생기면 재검토한다.

---

# 30. Authorization storage

DB에는 정책 자체가 아니라 authorization facts만 저장한다.

M5 v1의 저장 구조는 다음 사실만 포함한다.

```text
account.role = USER | REVIEWER | ADMIN
account.status
```

Guest는 Account role이 아니라 인증되지 않은 RequestContext다. album/locale assignment와 복수 role은
현재 DOMAIN_SPECIFICATION의 권한 모델이 아니므로 만들지 않는다. 이 문서의 조건부 CASL 예시는
CASL 표현력을 설명할 뿐 제품 role/permission을 추가하는 근거가 아니다. scoped permission이 실제
요구가 되면 DOMAIN_SPECIFICATION을 먼저 개정하고 schema/rules/test를 함께 변경한다. 구체 identity
schema는 `docs/migration/implementation/M5-AUTH-PREFLIGHT.md`가 확정한다.

---

# 31. v1에서 만들지 않는 Policy System

다음은 도입하지 않는다.

```text
policies table
policy_releases table
policy version
DB rule JSON editor
condition placeholder substitution
동적 rule release
정책 무배포 변경
자체 query-filter compiler
자체 permission DSL
```

CASL 채택과 DB policy engine 채택은 별개의 결정이다.

---

# 32. CASL의 역할 범위

채택:

```text
@casl/ability
@casl/react

AbilityBuilder
createMongoAbility
ability.can()
ability.cannot()
subject()
React AbilityProvider / useAbility / Can
```

미채택:

```text
DB-driven policy engine
custom policy lifecycle
policy release/version framework
프로젝트 전용 authorization DSL
```

---

# 33. DB query filtering은 별도 문제로 본다

CASL을 도입했다고 해서 목록 조회 SQL filtering까지 처음부터 자동화하지 않는다.

초기에는 각 query/use case에서 명시적으로 필요한 조건을 적용한다.

예를 들어 공개 목록은 공개 상태를, 관리자 목록은 DOMAIN_SPECIFICATION의 role과 resource 상태를
명시적인 repository/service 조건으로 적용한다.

CASL rules → Drizzle SQL 자동 변환기를 직접 만들지 않는다.

실제 반복과 복잡도가 충분히 커질 때 검증된 접근을 다시 검토한다.

---

# 34. 서버 폴더 구조

초기 기준:

```text
src/server/
├─ db/
│
├─ auth/
│  ├─ get-request-context.ts
│  └─ require-user.ts
│
├─ authz/
│  ├─ ability.ts
│  ├─ rules.ts
│  ├─ subjects/
│  │  ├─ song.ts
│  │  ├─ album.ts
│  │  └─ translation.ts
│  └─ types.ts
│
├─ services/
│
├─ errors/
│
└─ http/
```

폴더는 실제 파일 수에 따라 더 평평하게 시작해도 된다.

빈 디렉터리를 미리 만들지 않는다.

---

# 35. Shared authorization code

서버와 FE가 모두 알아야 하는 것은 CASL rule/subject의 공용 계약이다.

필요하면 다음을 `shared`에 둔다.

```text
src/shared/authz/
├─ ability.ts
├─ types.ts
└─ subjects.ts
```

단 DB 조회나 사용자 context 생성 코드는 절대 `shared`로 보내지 않는다.

```text
shared/authz
= serializable rule / ability vocabulary

server/authz
= 현재 사용자 facts → rules 생성
```

구조는 실제 구현 시 circular dependency와 client bundle 유입을 확인하며 조정한다.

---

# 36. 테스트 전략

## Rule generation

```text
guest
user
reviewer
admin
```

각 context에서 예상 CASL rule이 생성되는지 테스트한다.

## Ability decision

대표 resource fixture를 사용한다.

```text
user + contribution create → true
user + thread resolve → false
reviewer + thread resolve → true
admin + any song → manage true
```

## Service

```text
unauthenticated → UNAUTHENTICATED
ability denied → FORBIDDEN
ability allowed → success
```

## HTTP contract

```text
UNAUTHENTICATED → 401
FORBIDDEN → 403
```

## FE

CASL 자체를 다시 테스트하지 않는다.

우리 rule hydration과 대표 UI gating만 테스트한다.

---

# 37. CASL / Dynamic Policy 재검토 신호

현재 TypeScript rule 정의로 감당하기 어려운 상황이 실제로 생기면 재검토한다.

```text
운영자가 코드 배포 없이 정책을 바꿔야 한다
고객/조직별 커스텀 정책이 생긴다
정책 rule 수와 조합이 급격히 증가한다
정책 변경 이력/승인/rollback이 제품 요구가 된다
```

그 시점에 DB policy storage와 release/version을 다시 설계한다.

현재는 만들지 않는다.

---

# 38. 최종 헌법

1. 인증과 인가는 분리한다.
2. Auth.js는 identity/session만 담당한다.
3. JWT에는 최소 identity만 저장한다.
4. role 같은 mutable authorization facts는 DB가 SSOT다.
5. authorization policy는 TypeScript 코드에서 정의한다.
6. CASL을 서버와 FE의 공통 authorization vocabulary로 사용한다.
7. `buildAbilityRules()`가 v1 정책 정의의 SSOT다.
8. 서버는 request마다 현재 DB facts를 기반으로 Ability를 구성한다.
9. Service가 실제 security boundary다.
10. resource-level authorization은 resource 조회 후 `ability.can/cannot`으로 검사한다.
11. authentication 부재는 `requireUser()`로 표현한다.
12. role-specific helper를 프로젝트 전용 permission API로 확장하지 않는다.
13. 자체 `canX/assertCanX` permission framework를 기본 패턴으로 만들지 않는다.
14. FE는 서버 authorization rule을 별도로 재구현하지 않는다.
15. FE는 서버가 제공한 CASL rules로 Ability를 생성한다.
16. FE의 Ability는 UX용이며 보안 경계가 아니다.
17. 서버는 모든 민감 작업에서 authorization을 다시 검사한다.
18. capability DTO는 기본 패턴으로 사용하지 않는다.
19. permissions/rules 응답은 사용자별 데이터로 취급한다.
20. 403 수신 시 FE permissions query를 invalidate해 self-healing 한다.
21. 인증 실패는 `UNAUTHENTICATED`, 인가 실패는 `FORBIDDEN` AppError로 표현한다.
22. Route Handler는 이를 401/403으로 번역한다.
23. RSC는 동일한 identity/ability 구조를 사용한다.
24. Proxy는 보안 경계가 아니다.
25. Auth.js 로그인 protocol과 일반 API error protocol을 억지로 합치지 않는다.
26. 자체 CSRF framework를 먼저 만들지 않는다.
27. CASL 채택과 DB policy engine 채택을 동일시하지 않는다.
28. v1에서는 DB policy table/release/version을 만들지 않는다.
29. CASL rules → Drizzle SQL compiler를 직접 만들지 않는다.
30. 실제 복잡도가 증가하면 검증된 확장 방식을 재검토한다.
31. Guard/Decorator/Metadata framework를 만들지 않는다.
32. 단단함은 framework 수가 아니라 정책 정의와 보안 경계의 일관성에서 얻는다.

---

# 39. 최종 흐름

```text
Auth.js
   ↓
user identity
   ↓
DB role
   ↓
getRequestContext()
   ↓
buildAbilityRules()
   ↓
CASL Ability
   ↓
Service
   ↓
ability.cannot(action, subject)?
   ├─ YES → AppError('FORBIDDEN')
   └─ NO  → use case 실행
```

FE:

```text
/api/me/permissions
   ↓
CASL rules
   ↓
AbilityProvider
   ↓
ability.can(action, subject)
   ↓
hide / disable / route UX
```

서버와 클라이언트는 동일한 CASL 어휘를 사용하지만, 보안 판단의 최종 권한은 항상 서버에 있다.
