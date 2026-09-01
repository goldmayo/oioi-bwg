---
title: "Architecture Document Index"
document_id: "00"
version: "1.7"
status: "active"
authority: "index"
updated_at: "2026-09-01"
tags:
  - "architecture"
  - "documentation"
  - "ssot"
---

# oioi-bwg Architecture Document Index

## 1. 목적

이 문서는 oioi-bwg 아키텍처 문서 세트의 상태와 우선순위를 관리하는 인덱스다.

문서 내용의 상세 설계는 각 문서가 SSOT이며, 이 문서는 다음만 책임진다.

- active / draft / superseded 상태
- 문서 번호와 역할
- 문서 간 의존 관계
- 충돌 시 우선순위
- 구버전 문서의 대체 관계

---

## 2. 문서 우선순위

충돌이 발생하면 다음 순서를 따른다.

```text
01 Architecture Constitution
        ↓
각 영역별 active architecture 문서
        ↓
migration / implementation plan
        ↓
현재 코드
```

하위 문서가 01의 결정을 변경해야 한다면 하위 문서를 조용히 우선하지 않는다.

먼저 01을 개정한 뒤 관련 문서를 함께 수정한다.

---

## 3. Active document map

| ID | 문서 | 버전 | 상태 | 책임 |
|---|---|---:|---|---|
| 00 | Document Index | 1.7 | active | 문서 상태 / 버전 / 책임 SSOT |
| 01 | Architecture Constitution | 2.6 | active | 전체 시스템 헌법 |
| 02 | Frontend Architecture | 1.8 | active | FSD, UI/model/lib, Query 사용 원칙 |
| 03 | API / Error Architecture | 1.3 | active | HTTP / AppError / ApiError / error mapping |
| 04 | Auth / Authz Architecture | 1.2 | active | Auth.js, RequestContext, CASL |
| 05 | Contract / Validation Architecture | 1.6 | active | Zod contract / DTO / boundary validation |
| 06 | Server / Data Access Architecture | 1.0 | active | Service, Repository, Drizzle, transaction |
| 07 | Rendering / Query / Cache Architecture | 1.2 | active | RSC / Query / hydration / cache / retry 전략 |
| 08 | Form / Client State Architecture | 1.0 | active | form / URL / local client state ownership |
| 09 | Error UX / Observability Architecture | 1.1 | active | query/mutation error UX / logging / Sentry |
| 10 | Testing Architecture | 1.1 | active | unit / integration / component / E2E strategy |
| 11 | Content / i18n / Assets / Runtime Architecture | 1.0 | active | locale / content / assets / env / runtime |
| 12 | Deployment / Migration Runbook | 1.1 | active | migration phases / test infra / Docker / OCI / rollback |

---

## 4. Superseded 문서

다음 문서는 active architecture로 사용하지 않는다.

```text
legacy API / Error Architecture v0
→ superseded by 03

03-api-error-architecture-v1.md 같은 임시 파일명
→ canonical file은 03-api-error-architecture.md
```

구버전 문서를 보관하더라도 `status: superseded`를 명시하고 active 문서와 같은 이름/번호로 병행하지 않는다.

---

## 5. 상태 vocabulary

```text
draft
= 논의 중이며 구현 기준으로 사용하지 않음

active
= 현재 구현의 SSOT

superseded
= 다른 문서로 대체됨

deprecated
= 아직 참고 가능하지만 신규 구현에는 사용하지 않음
```

---

## 6. 문서 변경 규칙

- **코드 예시는 해당 구현을 소유하는 문서 한 곳에만 둔다.**
  다른 active 문서는 같은 helper/class/contract 구현을 복제하지 않고 SSOT 문서를 참조한다.
  의미(semantics)는 여러 문서에서 설명할 수 있지만 구현 예시는 중복하지 않는다.


Architecture decision을 변경할 때:

```text
1. 영향받는 상위 문서 확인
2. Constitution과 충돌하면 01부터 개정
3. 관련 active 문서를 같은 변경 단위에서 수정
4. version / updated_at 갱신
5. superseded 문서가 생기면 상태 명시
6. 구현은 문서 정합성 확인 후 진행
```

---

## 7. Front matter 표준

모든 architecture 문서는 YAML front matter를 사용한다.

기본 필드:

```yaml
---
title:
document_id:
version:
status:
authority:
updated_at:
depends_on: []
related: []
supersedes: []
superseded_by:
tags: []
---
```

없는 값은 생략한다.

`authority`는 다음 vocabulary를 사용한다.

```text
index
constitution
architecture
plan
runbook
```

---

## 8. 구현 착수 기준

active 문서끼리 명시적 모순이 없어야 한다.

모순을 발견하면 코드에서 임의로 한쪽을 선택하지 않는다.

```text
문서 수정
→ 영향 범위 확인
→ 구현
```

이 문서 세트는 구현을 대신하는 상세 명세가 아니라,
구현 중 되돌리기 비싼 구조적 결정을 안정적으로 유지하기 위한 기준이다.


- `planned` 문서는 아직 active architecture가 아니며 구현 SSOT로 사용하지 않는다.
