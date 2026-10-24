---
title: "Testing Architecture"
document_id: "10"
version: "1.17"
status: "active"
authority: "architecture"
updated_at: "2026-10-25"
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

# oioi-bwg Testing Architecture v1.15

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

관리자 전체 사용자 흐름(`pnpm test:integration:admin`, 로컬은
`pnpm test:integration:admin:local`)은 필요 시 명시적으로 실행하는 E2E다.
일반 PR·push·Promotion의 자동 CI 및 required `verify`에는 포함하지 않는다.
실행하지 않은 관리자 E2E를 자동 검증 통과로 기록하지 않는다.

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

일반 `migration_main` PR의 전체 merge-base diff가 일반 파일 `.md` 변경뿐이면 무거운 검사를 생략한다.
scope와 필수 `verify`는 실행하고 모든 생략 job의 상태를 대조한다. 코드 혼합·빈 diff·판정 실패는 전체 검증이다.
feature push hook도 같은 전체 diff 판정을 사용한다. Promotion과 main/develop push는 이 예외를 적용하지 않는다.

`pnpm lint:deps`는 workspace별 TS alias·package exports를 해석한 source/config/test graph와
Turbo boundaries를 검사한다. root lint·verify·CI·push hook이 같은 entry를 실행한다.
packages의 앱 역참조·앱 간 참조·workspace 상대 경로 우회·미선언 내부 의존성·runtime의 tooling 참조와
실제 runtime 순환을 거절한다. type import로 끊기는 순환은 별도 경고로 드러낸다.
root의 앱 source 참조는 foundation HTTP 통합 테스트의 Web response adapter 한 곳으로 제한한다.
FSD/계층 규칙은 ESLint·Steiger가 계속 소유한다. 정적 해석 불가능한 계산형 dynamic import는
별도 runtime/build 검증 대상이며 Turbo boundaries의 실험적 검사만으로 경계 보장을 대체하지 않는다.

root의 내부 package 소비 검증은 tools/repository로 단계적으로 이관한다. workspace는
직접 사용하는 package·도구·타입 프로그램을 소유하며 root 명령은 같은 검증을 orchestrate한다.
기존 경로를 위한 root adapter는 tooling의 등록된 공개 entry만 참조한다. 이관 전후
harness/unit/ops/PG 수집 합집합·주 타입 소속·cwd 해석을 대조하고, 검사 entry를 먼저 제거하지 않는다.
제품 task의 cache는 root 내부 package source의 전역 결합을 제거한 뒤 소비 입력으로 검증한다.
affected 선택·hash 변화·실제 실행을 구분하고 필요한 무효화와 무관한 cache 보존을 함께 증명한다.

Web과 Console은 독립 FSD root에서 lint/type-check/unit/build를 실행한다.
각 앱의 alias와 테스트 include는 다른 앱의 소스·테스트를 읽지 않도록 해당 workspace가 소유한다.
Web·Console·server·contracts의 type-check는 소스와 자체 Node 설정 프로그램을 함께 실행한다.
Next·ESLint·Vitest·Steiger 진입점은 해당 workspace의 tsconfig.config.json이 소유하며 앱 alias를
Node 프로그램에 주입하지 않는다. 앱 Sentry runtime 진입점은 앱 소스 프로그램에서 검사한다.
Relay·config는 기존 자체 프로그램을 유지한다. root는 root 설정·scripts·통합 검사를 소유한다.
root lint orchestration은 workspace lint와 repo lint를 나눠 실행하며 repo lint는 apps/packages/tools를
재검사하지 않는다. root ESLint의 설정 조합은 staged 파일과 harness의 cwd별 정책 대조를 위해 유지한다.
양 앱의 FSD 정책·해석 graph·검사 소속 회귀는 repository-tools의 architecture harness가 소유한다.
Root test:harness와 lint:deps는 Tool의 자체 명령을 통해 같은 검증을 실행한다.
기존 dependency CLI 파일도 등록된 Tool 공개 entry를 import하는 호환 진입점으로 유지한다.
운영 CLI의 package 소비 구현·정책은 Tool의 공개 operator entry가 소유한다. 기존 scripts 경로는
해당 entry를 재수출하며 local DB·파일 권한·OCI worker 검증 계약을 유지한다.
package를 소비하는 ops 테스트·MFA fixture는 Tool이 직접 의존성과 Node 테스트 타입 프로그램을
소유한다. Root ops entry는 양 위치의 기존 테스트 합집합을 수집하며 fixture의 기존 CLI 경로·격리 DB guard는 유지한다.
Tool 자체 type-check는 소스·설정과 테스트 프로그램을 함께 검사한다. Root 전체 type-check는 각 owner를
한 번 실행하고, type-check:tests는 Root와 Tool의 테스트 타입 검사를 함께 실행한다.
repo harness는 직접 앱 import, source package 및 공통 설정 변경의 두 앱 task 선택/hash를 검사한다.
루트 설정과 운영·통합 테스트도 repo 진입점의 strict 타입 검사에 포함한다. 테스트 수집·실행 성공을
타입 검사 성공으로 취급하지 않는다. Node 테스트에는 앱 alias를 전역 적용하지 않으며 Web HTTP
adapter를 소비하는 테스트만 해당 앱의 타입 해석을 사용한다. harness는 추적 테스트의 검사 소속과
alias 격리를 확인한다. 추적된 모든 TS 테스트는 include로 결정한 주 타입 검사 소속을 정확히 하나
가지며, import에 따른 transitive 방문은 별도로 구분한다. Contracts 테스트도 package의 strict
프로그램에 포함하고 실제 테스트 안의 타입 오류 검출을 harness로 보호한다. CI·push hook은 동일한 repo 검사 진입점을 사용한다.
P04의 두 앱 로그인 회귀는 P06-E에서 Console 인증/관리와 Web 비로그인 조회/인증 거절로 전환한다.
Web은 로그인 화면·세션/권한 API·Credentials callback 부재와 기존 쿠키의 비사용을 검증한다.
Console의 MFA·인가 계약은 유지한다. 전체 관리자 E2E의 수동 실행 원칙은 §12.1을 따른다.
CI의 PostgreSQL fixture는 격리된 test DB에만 만들고 정리한다.
서버 repository/service 전용 DB 테스트는 packages/server/tests/integration과 서버 strict 타입
프로그램이 소유한다. 실제 실행은 root guarded runner와 직렬 Node project를 사용하며 일반 package
unit에는 수집하지 않는다. Web HTTP adapter를 검증하는 foundation과 operator CLI 통합은 root에 유지한다.
수동 k6는 앱 import/테스트 환경 없는 외부 Web 검증 도구로 root에 유지하고 unit/일반 verify와 분리한다.
기존 target 식별자를 APP_ENV로 해석하거나 승인 없이 변경·호출하지 않는다.

독립 relay Worker는 자체 Node unit/type/lint workspace다. root unit·coverage와 Turbo가 동일한
테스트를 한 번씩 수집하며 browser/Web alias를 적용하지 않는다. 해당 unit을 root ops에서 중복 실행하지
않는다. `.mts` runtime도 coverage 대상에 포함한다. Wrangler dry-run 번들과 실제 배포·Slack 수신은
별도 증거이며 일반 검증은 외부 secret·전송을 요구하지 않는다.

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
