---
title: "Form / Client State Architecture"
document_id: "08"
version: "1.0"
status: "active"
authority: "architecture"
updated_at: "2026-08-26"
depends_on:
  - "01"
  - "02"
  - "05"
  - "07"
related:
  - "09"
  - "10"
tags:
  - "react-hook-form"
  - "nuqs"
  - "state"
  - "forms"
---

# oioi-bwg Form / Client State Architecture v1.0

## 1. 목적

이 문서는 client-side state의 종류별 소유권을 결정한다.

핵심 질문은 다음이다.

> 이 상태는 어디에 있어야 하는가?

---

## 2. 상태 분류

기본 분류:

```text
Server state
→ TanStack Query

Form state
→ React Hook Form

URL/shareable state
→ nuqs

Pure local UI state
→ React state

Cross-tree client state
→ 실제 필요가 확인된 경우에만 별도 store
```

하나의 상태를 여러 저장소에 중복 소유하지 않는다.

---

## 3. Server State

서버에서 온 데이터의 lifecycle은 07을 따른다.

```text
fetch
stale
refetch
retry
invalidate
```

이 책임을 `useState`, Zustand, Context 등에 복제하지 않는다.

---

## 4. Form State

사용자가 아직 저장하지 않은 입력 draft는 RHF가 소유한다.

```text
Query data
= 서버의 현재 상태

Form data
= 사용자가 편집 중인 draft
```

둘을 동일 state로 취급하지 않는다.

---

## 5. Query → Form 경계

편집 화면의 기본 흐름:

```text
DTO
 ↓
form defaultValues
 ↓
user edit
 ↓
form model
 ↓
API input mapping
 ↓
mutation
```

Query cache를 form draft처럼 직접 수정하지 않는다.

---


## 5.1. 편집 중 Server Refetch와 Form Snapshot

Form은 초기화 시점의 server data snapshot을 기준으로 사용자의 draft를 소유한다.

편집 중 Query가 invalidation, staleTime 만료, window focus refetch,
다른 actor의 update 등으로 갱신되어도 dirty form field에 자동 덮어쓰지 않는다.

```text
Query
= 최신 server state

RHF
= 사용자가 편집 중인 snapshot 기반 draft
```

따라서 다음 패턴을 기본으로 사용하지 않는다.

```text
query data 변경
→ useEffect
→ form.reset(latestQueryData)
```

동시 수정은 저장 시 revision/version mismatch를 감지해:

```text
409
→ conflict UX
```

로 수렴한다.

Conflict semantics는 03, revision contract는 05, 사용자 UX는 09를 따른다.

사용자가 명시적으로 최신 서버 값 다시 불러오기를 선택한 경우에만
form reset/reinitialize를 수행한다.

---

## 6. API Contract와 Form Model

05의 원칙을 따른다.

```text
API DTO ≠ Form Model
API Input ≠ Form Model
```

같을 수는 있지만 동일해야 하는 것은 아니다.

UI-only field, display format, default value, 임시 입력 상태가 있으면 form model을 별도로 둔다.

---

## 7. RHF 사용 기준

다음과 같은 경우 RHF를 우선한다.

```text
여러 field
validation
submit
field error
dirty state
reset
server error mapping
```

단순 toggle, search box 한 개, local control 정도는 React state가 더 단순할 수 있다.

RHF를 숨기기 위한 wrapper를 만들지 않는다.

---

## 8. UI와 Model의 경계

02를 따른다.

UI에 둘 수 있는 것:

```text
register
control
Controller
formState
dialog open/close
accordion
focus/hover
```

Model로 분리할 후보:

```text
mutation
invalidateQueries
router.push
analytics
autosave
navigation guard
API field error mapping
```

---

## 9. URL State

공유 가능하거나 navigation과 함께 보존되어야 하는 state는 nuqs를 우선한다.

후보:

```text
search
filter
sort
page
tab
selected view mode
```

단순 transient UI state를 URL에 올리지 않는다.

---


## 9.1. URL State와 Form이 겹치는 경우

검색/필터 입력은 두 패턴을 구분한다.

즉시 반영형:

```text
input change
→ nuqs
→ URL/query state 변경
```

Submit형:

```text
RHF draft
→ submit
→ nuqs에 commit
→ URL/query state 변경
```

같은 값을 RHF와 nuqs에서 동시에 authoritative state로 유지하지 않는다.

---

## 10. Local UI State

다음은 component 가까이에 둔다.

```text
dialog open
accordion open
hover
focus
temporary disclosure
local selection
```

재사용 가능성만으로 global store로 올리지 않는다.

---

## 11. Derived State

계산 가능한 state를 별도로 저장하지 않는다.

사용하지 않는 패턴:

```text
server data
→ copy to local state
→ derived value도 다시 state
```

가능하면 render 시 계산하거나 pure `lib` 함수로 파생한다.

---

## 12. Global Client Store

기본값은 사용하지 않음이다.

다음 조건이 실제로 생길 때 검토한다.

```text
여러 route/component tree에서 공유
URL로 표현하기 부적절
server state가 아님
form state가 아님
local state lifting이 과도함
```

라이브러리는 필요가 생긴 뒤 선택한다.

---

## 13. Dirty State / Navigation Guard

dirty state는 form lifecycle concern이다.

navigation guard가 필요하면 RHF의 dirty state를 기반으로 model에서 orchestration한다.

project-wide navigation framework를 만들지 않는다.

---

## 14. Autosave

autosave는 기본값이 아니다.

필요할 경우 다음을 별도 설계한다.

```text
debounce
pending state
conflict/revision
last saved state
retry
navigation
```

단순 form submit과 같은 정책으로 취급하지 않는다.

---

## 15. Mutation 이후 Form 처리

mutation 성공 후 선택 가능한 동작:

```text
reset to server result
navigate away
keep current draft
invalidate related queries
```

화면 use case에 따라 명시적으로 결정한다.

자동 global form policy를 만들지 않는다.

---

## 16. Error 연결

field validation과 server mutation error의 UX는 09가 소유한다.

08은 상태 연결만 정의한다.

```text
validation error
→ RHF field/form state

mutation error
→ model orchestration
```

구현 예시는 09와 중복하지 않는다.

---

## 17. 금지 패턴

```text
Query data를 Zustand에 복제
Form draft를 Query cache에 직접 저장
모든 UI state를 URL에 저장
모든 form을 custom hook으로 감싸기
RHF vocabulary를 wrapper 뒤로 숨기기
derived state 중복 저장
evidence 없이 global store 도입
```

---

## 18. 최종 원칙

1. Server state는 TanStack Query가 소유한다.
2. Form draft는 RHF가 소유한다.
3. URL/shareable state는 nuqs를 우선한다.
4. Pure local UI state는 component 가까이에 둔다.
5. Cross-tree client store는 evidence가 있을 때만 도입한다.
6. Query data와 Form data는 서로 다른 lifecycle이다.
7. Query cache를 form draft처럼 직접 수정하지 않는다.
8. API contract와 Form model을 억지로 동일시하지 않는다.
9. RHF vocabulary는 직접 사용한다.
10. 외부 side effect orchestration만 필요할 때 model로 분리한다.
11. 계산 가능한 derived state를 중복 저장하지 않는다.
12. Dirty/navigation/autosave는 실제 use case가 있을 때만 확장한다.
