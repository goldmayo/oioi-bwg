# Finding Registry

## DATA-001 — Challenge consume CHECK conflict

### Primary Model

```text
PLAN: Sol High
IMPLEMENT: Sol High
보조 test/fixture: Terra
REVIEW: Sol High
```

### Problem

`PENDING → VERIFIED → CONSUMED` 중 consume이 `status`와 `consumed_at`만 변경하며 `verified_at`이 남는다.

현재 CHECK:

```text
(status = VERIFIED) iff verified_at IS NOT NULL
```

때문에 CONSUMED 전이가 실제 PostgreSQL에서 23514로 실패한다.

### Goal

다음을 모두 만족시킨다.

```text
requestOtp
→ verifyOtp
→ completeSignup
→ account/profile/password_credential 생성 성공
```

그리고 signup 후반 실패 시 동일 transaction이 rollback되어야 한다.

### Decision constraint

최소 수정안과 domain semantic 변경을 구분한다.

현재 iff 계약을 유지한다면 consume 시 `verified_at = null`이 최소안이다.

검증 시각을 CONSUMED에서도 보존하려면 schema state contract 자체를 먼저 변경해야 하며 새 migration이 필요하다.

### Verification

실제 PostgreSQL에서:

```text
PENDING → VERIFIED → CONSUMED 성공
재소비 실패
account/profile/credential 생성
후반 insert 실패 → 전체 rollback
```

---

## DATA-002 — Album image upload authorization bypass

### Primary Model

```text
PLAN: Sol High
IMPLEMENT: Terra
REVIEW: Sol High
```

### Problem

현재:

```text
Album form
→ Server Action
→ uploadPublicAsset
→ R2 PutObject
```

경로에 application-level admin authorization이 없다.

### Goal

최종 security boundary에서:

```text
RequestContext
→ requireUser
→ ability manage/all
→ file validation
→ storage
```

을 보장한다.

### Constraints

* 전체 CRUD transport를 재구성하지 않는다.
* 제한적인 Server Action 유지 가능.
* R2 client/credential은 server/storage boundary에 둔다.
* UI의 AdminLayout은 authorization evidence로 사용하지 않는다.

### Verification

```text
guest → storage call 0
USER → storage call 0
REVIEWER → storage call 0
ADMIN → success
invalid FormData/MIME/size → rejected before upload
```

---

## DATA-003 — Drizzle unique conflict mapping

### Primary Model

```text
PLAN: Sol Medium
IMPLEMENT: Terra
REVIEW: Sol Medium
```

### Problem

DrizzleQueryError의 outer message만 검사하고 실제 PostgreSQL 오류가 `cause`에 있기 때문에 known unique conflict가 409가 아니라 500으로 매핑된다.

### Goal

작은 server helper로 다음만 처리한다.

```text
SQLSTATE = 23505
AND
constraint_name ∈ known constraints
→ expected AppError conflict
```

그 외 DB 오류는 unexpected 500으로 유지한다.

### Constraints

generic DB error framework를 만들지 않는다.

무제한 recursive cause parsing을 만들지 않는다.

### Verification

```text
wrapped DrizzleQueryError unit test
+
real PostgreSQL Album duplicate slug
+
email/nickname duplicate

→ known conflict 409
→ unrelated DB error 500
```

---

## DATA-004 — Sensitive DB error logging

### Primary Model

```text
PLAN: Sol XHigh
IMPLEMENT: Sol High
REVIEW: Sol High
```

### Problem

실제 Drizzle error message에 SQL/params가 포함되고 logger/Sentry 경계에 raw error가 전달된다.

credential/challenge query params에는 다음이 포함될 수 있다.

```text
email
password hash
OTP hash
IP
```

### Goal

safe error serialization boundary를 만든다.

보존할 정보:

```text
safe error type
safe code
source
event
request correlation metadata
```

금지:

```text
SQL text
params
raw cause
password
hash
OTP
token
cookie
session
authorization
private PII
```

### Scope

반드시 함께 확인:

```text
HTTP error mapper
server logger
Sentry adapter
instrumentation
Auth.js failure path
output-contract failure
```

### Constraints

* 단순 key-name redaction만으로 해결하지 않는다.
* raw Error.message/cause 자체가 민감할 수 있음을 전제로 한다.
* unexpected 500 observability는 없애지 않는다.

### Verification

민감 synthetic marker를 중첩 Error/cause/message/params에 넣고:

```text
console payload
structured logger payload
captureException/captureMessage payload
```

어디에도 marker가 남지 않아야 한다.

---

## DATA-005 — Song.slug uniqueness policy

### Primary Model

```text
POLICY DESIGN: Astra High/Max
TECHNICAL PLAN: Sol High
IMPLEMENT: 정책 결정 후 Sol High/Terra
FINAL REVIEW: Astra 또는 Sol High
```

### Important

이 finding은 즉시 code fix하지 않는다.

### Problem

Legacy에는 unique 선언이 있었으나 migrated baseline에서는 의도적으로 제거되었다.

실제 current PostgreSQL은 duplicate slug를 허용한다.

현재 데이터에는 non-null duplicate group이 없지만 정책은 미결이다.

### Astra decision task

다음 후보를 비교한다.

```text
A. Song.slug global unique
B. album-scoped unique
C. non-unique
D. slug 외 별도 stable public identity
```

각 안에 대해 검토:

```text
URL semantics
findFirst ambiguity
existing URLs
album 이동
rename
SEO
API identity
future CheerGuide/Revision URL
DB constraint
conflict UX
migration/backfill
```

### Rule

정책 결정 전 unique constraint를 복원하지 않는다.

### Output

Astra는 코드가 아니라 ADR/decision proposal을 만든다.

---

## DATA-006 — Query invalidation gaps

### Primary Model

```text
PLAN: Sol High
IMPLEMENT: Terra
REVIEW: Sol Medium
```

### Problem

현재 mutation invalidation이 실제 Query consumer 전체를 반영하지 않는다.

확인된 영향:

```text
lyrics save
→ song adminList

album rename/delete
→ album adminList
→ song adminList
```

### Goal

mutation이 변경하는 실제 consumer만 명시적으로 invalidate한다.

### Constraints

* unrelated slice끼리 직접 import하지 않는다.
* 필요하면 route composition callback을 사용한다.
* RSC-only public view를 억지로 TanStack Query로 옮기지 않는다.
* editor local draft ownership을 유지한다.

### Verification

영향 Query cache를 먼저 채운 뒤 mutation하고:

```text
필요 key stale/refetch
불필요 key unaffected
editor draft preserved
```

를 확인한다.

---

## DATA-007 — Admin list DTO

### Primary Model

```text
PLAN: Sol Medium
IMPLEMENT: Terra
REVIEW: Sol Medium
```

### Problem

현재 list response가 bare array다.

### Goal

명시적인 domain-specific list DTO를 정의한다.

예시 후보:

```json
{
  "items": [],
  "nextCursor": null
}
```

단, 실제 shape는 PLAN에서 결정한다.

### Constraints

* generic `{ success, data }` envelope 금지.
* server pagination을 요구사항 없이 추가하지 않는다.
* 현재 전체 조회 + client pagination behavior 유지 가능.
* hydration seed와 HTTP refetch shape는 동일해야 한다.

### Verification

```text
Route output schema
client parser
Hydration/setQueryData seed
HTTP refetch
Query cache
```

가 동일 DTO shape을 사용해야 한다.

---

## DATA-008 — Real DB/security test coverage

### Primary Model

```text
TEST PLAN: Sol High
TEST IMPLEMENTATION: Terra
REVIEW: Sol High
```

### Goal

전체 test suite를 대량 작성하는 것이 아니라 foundation P0 위험을 실제 PostgreSQL test로 보호한다.

### P0 coverage

```text
signup success
signup transaction rollback
OTP state transition
OTP concurrency
unique conflict 409
privileged Service direct denial
Album/Song constraint/FK/order
critical public visibility/read
```

### P1

```text
Route error mapping
cache invalidation consumer
form/field error
```

### P2

```text
browser E2E
coverage scope
load test continuity
```

### Constraints

* production credentials 사용 금지.
* 격리된 PostgreSQL DB 사용.
* mock-only success를 integration success로 기록하지 않는다.
* 각 high-risk fix와 regression test를 같은 concern 단위로 추가한다.

---

## DATA-009 — OTP first-request concurrency race

### Primary Model

```text
PLAN: Sol XHigh
IMPLEMENT: Sol High
REVIEW: Sol High
```

### Problem

현재 순서:

```text
previous challenge SELECT/lock
→ cooldown check
→ rate-limit counter upsert
```

최초 동시 요청 두 개는 previous challenge가 없어 둘 다 cooldown을 통과할 수 있다.

실제 PostgreSQL 동시성 검증에서 둘 다 성공하고 mail 2회가 재현되었다.

### Goal

동일 email에 대한 serialization point를 cooldown decision 이전에 둔다.

### Constraints

* 새 lock framework 금지.
* 기존 PostgreSQL primitive와 현재 rate-limit 구조를 우선 활용.
* email/IP rate limit semantics를 깨지 않는다.
* transaction commit 이후 mail 발송 구조를 유지한다.
* boundary-time window key 변경 race도 고려한다.

### Candidate analysis

PLAN에서 최소한 다음을 비교한다.

```text
existing rate-limit row lock
advisory lock
dedicated stable lock key
transaction ordering 변경
```

가장 작은 현재 architecture-compatible solution을 선택한다.

### Verification

실제 PostgreSQL concurrent test:

```text
동일 email 최초 동시 요청 N개
→ 성공 발송 1
→ 나머지 cooldown

재발급 동시 요청
→ 동일 invariant

transaction rollback
→ mail 0

email/IP rate-limit
→ 기존 정책 보존
```

---

# Completion Rule

finding 하나를 완료 처리하려면 다음이 모두 있어야 한다.

```text
PLAN decision
implementation diff
relevant automated test
필요 시 actual PostgreSQL verification
typecheck/lint/unit gate
REVIEW pass
```

단순 코드 수정이나 mock unit green만으로 완료 처리하지 않는다.
