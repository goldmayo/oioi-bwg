---
title: "Testing Architecture"
document_id: "10"
version: "1.1"
status: "active"
authority: "architecture"
updated_at: "2026-08-29"
depends_on:
  - "01"
  - "02"
  - "03"
  - "04"
  - "05"
  - "06"
  - "07"
related:
  - "08"
  - "09"
  - "12"
tags:
  - "vitest"
  - "rtl"
  - "playwright"
  - "testing"
---

# oioi-bwg Testing Architecture v1.1

## 1. 목적

테스트의 목적은 구현 세부사항을 고정하는 것이 아니라
architecture boundary와 중요한 user behavior를 보호하는 것이다.

---

## 2. 기본 도구

기본 stack:

```text
Vitest
React Testing Library
Playwright
```

MSW는 client API contract normalization 테스트의 확정된 use case다. 05 §27의 정상 payload / 깨진 payload / error payload normalization을 MSW fixture로 검증한다. 그 외 HTTP mocking은 가치가 명확할 때만 사용한다.

---

## 3. Test Pyramid를 절대 규칙으로 삼지 않는다

테스트 종류는 코드의 성질에 맞춘다.

```text
pure lib
→ unit

service/business rule
→ unit or integration

repository
→ DB integration

component behavior
→ RTL

critical user flow
→ Playwright
```

---

## 4. Pure Logic

`lib`의 pure function은 가장 싸고 빠르게 unit test한다.

후보:

```text
parser
mapper
calculation
decision function
lyrics timing
progress calculation
```

---

## 5. Service Test

Service에서 보호할 것:

```text
business rule
authz decision
transaction scope
repository orchestration
expected AppError
```

Repository 구현 세부사항을 과도하게 mock하지 않는다.

---

## 6. Repository Test

Repository는 실제 PostgreSQL behavior와 SQL mapping을 검증하는 integration test가 가치가 높다. 구체 repository/transaction 검증 범위는 06 §42~43을 참조한다.

후보:

```text
constraint
join
ordering
transaction
unique conflict
mapping
```

---

## 7. Contract Test

05 §27의 contract test 원칙을 따른다.

특히:

```text
request schema
response schema
error response schema
pagination schema
```

DB row shape를 contract test로 착각하지 않는다.

---

## 8. Auth/Authz Test

04 §36의 Auth/Authz test matrix를 따른다.

후보:

```text
anonymous
authenticated
role
assignment
album access
locale access
disabled user
stale permission
```

CASL rule builder는 table-driven test 후보가 된다.

---

## 9. Component Test

RTL에서는 사용자 관점 behavior를 검증한다.

```text
보인다
입력한다
클릭한다
에러가 보인다
disabled 된다
submit 된다
```

implementation detail state를 직접 assert하지 않는다.

---

## 10. Form Test

08과 연결한다.

검증 후보:

```text
default value
validation
field error
dirty state
submit mapping
server field error mapping
```

RHF 자체를 다시 테스트하지 않는다.

---

## 11. Query Test

TanStack Query library 자체를 테스트하지 않는다.

우리 코드가 소유하는 것만 검증한다.

```text
query key
query fn contract
mutation invalidation target
error mapping
```

---

## 12. E2E

Playwright는 critical flow에 집중한다.

후보:

```text
로그인
공개 곡 조회
관리 곡 편집
publish
권한 거부
critical navigation
```

모든 화면 조합을 E2E로 덮지 않는다.

---


## 12.1. Playwright 실행 전제

E2E는 deterministic test identity와 seed data를 전제로 한다.

최소 fixture:

```text
anonymous
normal authenticated user
authorized editor/admin
forbidden user
published resource
editable draft resource
```

login flow 자체를 검증하는 test를 제외하면
각 test가 UI login을 prerequisite로 반복하지 않는다.

Target은 production-like Next standalone + PostgreSQL 조합을 우선한다.

구체 CI orchestration은 12가 소유한다.

---

## 13. Snapshot Test

기본적으로 지양한다.

큰 JSX snapshot은 변경 노이즈가 크고 의미가 약하다.

작고 안정적인 serialization output에만 제한적으로 고려한다.

---

## 14. Mock 원칙

Mock은 boundary를 격리하기 위한 도구다.

모든 dependency를 mock해서 실제 integration risk를 숨기지 않는다.

특히 DB behavior와 authz는 실제 integration test의 가치가 높다.

---


## 15. Test DB

Repository/integration test는 실제 PostgreSQL 17 기반 test database를 사용한다.

```text
CI / local test
→ isolated PostgreSQL test database
→ migration/schema 적용
→ deterministic fixture seed
→ test 실행
→ cleanup
```

SQLite/in-memory fake로 PostgreSQL behavior를 대체하지 않는다.

구체 CI lifecycle은 12가 소유한다.

---


## 16. Fixtures / Builders

fixture가 반복될 때 작은 builder를 사용할 수 있다.

하지만 자체 testing framework를 만들지 않는다.

---

## 17. CI Gate

최소 후보:

```text
typecheck
lint
unit/integration
critical Playwright
build
```

실행 시간과 신뢰도를 보고 단계별로 조정한다.

---

## 18. Coverage

coverage percentage를 품질의 SSOT로 삼지 않는다.

중요한 architecture boundary와 business rule coverage를 우선한다.

### Regression traceability

도메인 invariant와 critical workflow에는 `DOMAIN_SPECIFICATION.md`의 식별자(예: `INV-004`,
`AUTH-T001`)를 테스트 설명이나 별도 매핑에 남긴다. UI mockup 전용 id 체계를 새로 만들지는
않으며, 추적성은 테스트가 보호하는 규칙과 직접 연결될 때만 추가한다.

---

## 19. 금지 패턴

```text
line coverage 목표만 맞추기
library behavior 재테스트
거대한 snapshot
모든 dependency mock
E2E로 모든 조합 검증
private implementation detail assert
test-only architecture framework
```

---

## 20. 최종 원칙

1. Pure logic은 unit test한다.
2. Business rule은 Service에서 보호한다.
3. Persistence risk는 DB integration test로 보호한다.
4. Contract는 Zod boundary를 기준으로 테스트한다.
5. Authz rule은 명시적으로 테스트한다.
6. Component test는 사용자 behavior를 본다.
7. Critical journey만 E2E로 보호한다.
8. Library 자체를 다시 테스트하지 않는다.
9. Snapshot은 제한적으로 사용한다.
10. Mock은 integration risk를 숨기지 않게 사용한다.
11. Coverage 숫자보다 중요한 경계를 우선한다.
12. Testing framework를 새로 만들지 않는다.
