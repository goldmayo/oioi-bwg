---
title: "Error UX / Observability Architecture"
document_id: "09"
version: "1.2"
status: "active"
authority: "architecture"
updated_at: "2026-09-03"
depends_on:
  - "03"
  - "04"
  - "05"
  - "07"
related:
  - "08"
  - "10"
  - "12"
tags:
  - "errors"
  - "sentry"
  - "logging"
  - "observability"
---

# oioi-bwg Error UX / Observability Architecture v1.2

## 1. 목적

03이 error semantics와 HTTP mapping을 소유한다.

09는 다음을 소유한다.

```text
사용자에게 어떻게 보이는가
운영자에게 어떻게 기록되는가
무엇을 capture 하는가
무엇을 조용히 처리하는가
```

---

## 2. Error Vocabulary는 03을 따른다

09에서 error class를 재정의하지 않는다.

참조:

```text
AppError
ApiError
ClientContractError
Unexpected Error
```

---

## 3. UX Surface

Error UX 후보:

```text
field error
inline message
toast
dialog
page error boundary
retry UI
silent recovery
redirect
```

모든 error를 toast로 처리하지 않는다.

---

## 4. Field Error

사용자 입력과 직접 연결되는 validation error는 field 가까이에 보여주는 것을 우선한다.

RHF `setError()` mapping이 필요하면 feature/model 수준에서 처리한다.

---

## 5. Mutation Error

mutation failure는 기본적으로 전역 공통 UX를 제공할 수 있다.

단 feature가 더 구체적인 UX를 제공해야 하는 경우 escape hatch를 둔다.

현재 규칙:

```text
MutationCache global handler
+
meta.skipGlobalError
```

`MutationCache`는 비폼 mutation의 기본 toast를 담당한다. RHF 폼처럼 field/root 오류를 완전히
표시하는 consumer는 mutation option에 `meta.skipGlobalError`를 선언한다. `meta.errorMessage`는
use-case 전용의 안전한 문구가 필요한 경우에만 사용한다. 전역 handler는 retry나 invalidation을
수행하지 않으며, `ClientContractError`와 비정상 HTTP failure는 중복 없이 관측한다.

---


## 5.1. Query Read Failure UX

Read/query failure는 mutation failure와 별도 UX를 가진다.

```text
Suspense query 초기 load 실패
→ 가장 가까운 Error Boundary

non-Suspense useQuery 실패
→ 해당 component의 inline error/retry state 우선

background refetch 실패
→ 유효한 기존 data가 있으면 화면 전체를 무너뜨리지 않음
```

`QueryCache` 전역 error handler를 모든 read failure의 사용자 UX로 사용하지 않는다.

Retry 가능 여부와 retry 정책은 07 §29.1이 SSOT다.

09는 retry 가능한 failure에 retry action을 제공할지와
실제 표시 surface만 결정한다.

---

## 6. 401

기본 의미:

```text
authentication required
session expired
```

UX는 재인증 흐름으로 수렴해야 한다.

무한 재로그인 redirect / 재인증 loop를 만들지 않는다.

---

## 7. 403

권한 없음은 authentication failure와 구분한다.

04의 stale ability self-healing 규칙과 연결한다.

```text
403
→ permissions invalidate/refetch
→ 여전히 forbidden이면 권한 UX
```

---

## 8. 404

resource not found는 route/page context에 따라 `notFound()` 또는 inline state로 표현한다.

모든 404를 generic toast로 처리하지 않는다.

---

## 9. 409

conflict/revision error는 일반 server error가 아니다.

편집 use case에서는 사용자가 다음 행동을 선택할 수 있어야 한다.

후보:

```text
reload latest
compare
retry
discard local draft
```

구체 UX는 feature 요구에 따라 정한다.

---

## 10. 500 / Unexpected Error

사용자에게 내부 exception message를 노출하지 않는다.

generic system failure UX를 사용한다.

운영 측에서는 capture 대상이다.

---

## 11. ClientContractError

05의 구현을 참조한다.

UX:

```text
generic system failure
```

Observability:

```text
Sentry capture
```

raw Zod detail을 사용자에게 그대로 노출하지 않는다.

---

## 12. Sentry Capture 원칙

capture 하지 않는 기본 항목:

```text
expected AppError
request validation failure
정상적인 401/403/404/409
```

capture 하는 기본 항목:

```text
unexpected server exception
output contract violation
ClientContractError
unexpected client runtime failure
```

---

## 13. Logging

Structured logger 도입을 기본으로 한다.

목표:

```text
timestamp
level
event
request context
error
relevant identifiers
```

`console.log`를 application logging 표준으로 삼지 않는다.

Logger architecture의 소유 위치는 server infrastructure에 둔다.

```text
server
→ structured logger + Sentry

client
→ Sentry + 최소 dev diagnostics
```

선정 기준은 structured JSON, low overhead, error serialization, Docker/stdout 친화성이다.

---

## 14. Sensitive Data

다음을 log/capture payload에 넣지 않는다.

```text
password
token
cookie
authorization header
secret
raw personal data
full DB row
```

Error details도 03의 client-safe 원칙을 따른다.

---

## 15. Correlation / Request ID

초기부터 복잡한 distributed tracing system을 만들지 않는다.

단 single-server 환경에서도 request correlation이 실제 debugging에 유용하면 request ID를 도입할 수 있다.

도입 시 logger/Sentry/HTTP response 간 일관된 vocabulary를 사용한다.

---

## 16. Analytics와 Error Logging 분리

GA4 등 product analytics와 application error observability를 섞지 않는다.

```text
analytics
= user/product behavior

Analytics는 명시된 consent 이후에만 활성화한다. page/location 데이터는 제품 분석에 필요한
최소 형태만 보내며 검색어·이메일·토큰·원문 콘텐츠 같은 개인정보나 민감한 입력을 URL 전체와
함께 전송하지 않는다. 분석 이벤트가 실패해도 제품 요청이나 error reporting을 막지 않는다.

Sentry/logger
= system behavior
```

---

## 17. Retry UX

07 §29.1의 retry policy를 따른다.

Retry 가능한 failure에서만 사용자 retry action을 제공한다.

무조건적인 자동 retry는 피한다.

---

## 18. Error Boundary

Error Boundary 배치 원칙은 09가 소유한다.
RSC error semantics는 07 §32를 참조한다.


Error Boundary는 복구 단위에 맞춰 둔다.

## 18.1. Loading / Empty State

로딩은 하나의 전역 spinner로 뭉개지 않는다. 초기 부팅, route transition, query read, mutation
진행처럼 사용자가 기다리는 경계에 맞춰 surface를 둔다. query가 아직 없는 첫 진입과 기존
데이터가 유지된 refetch를 구분해, 후자의 경우 화면을 불필요하게 빈 상태로 바꾸지 않는다.

Empty state는 정상적인 데이터 없음과 조회 실패를 구분한다. retry는 재시도 가능한 실패에만
노출하고, 이미 표시된 콘텐츠를 보존해야 하는 mutation/stream 오류는 해당 영역의 inline 상태로
처리한다.

```text
app 전체
route
widget
feature
```

모든 작은 component마다 boundary를 만들지 않는다.

---

## 19. 금지 패턴

```text
모든 error를 toast
expected AppError를 Sentry capture
raw internal message 사용자 노출
console.log 중심 운영
Error class 중복 정의
analytics와 error logging 혼합
global catch에서 모든 error 의미 소실
```

---

## 20. 최종 원칙

1. Error semantics는 03이 소유한다.
2. 09는 UX와 observability만 소유한다.
3. Error class/helper 구현을 중복하지 않는다.
4. Field error는 field 가까이에 보여준다.
5. Mutation error는 global 기본 UX + feature escape hatch를 고려한다.
6. 401/403/404/409는 서로 다른 UX 의미를 가진다.
7. Unexpected/System failure는 generic UX로 처리한다.
8. Expected application failure는 기본적으로 Sentry capture하지 않는다.
9. Contract violation과 unexpected exception은 capture한다.
10. Structured logger를 사용한다.
11. Sensitive data는 log/capture하지 않는다.
12. Analytics와 observability를 분리한다.
