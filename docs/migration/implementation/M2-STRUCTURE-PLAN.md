---
title: "M2 Structure Implementation Plan"
document_id: "M2-STRUCTURE"
version: "1.0"
status: "review"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M0-INVENTORY"
  - "M1-RUNTIME-NORMALIZATION"
---

# M2 Structure Implementation Plan

## 1. 목적

M1에서 정규화한 Next.js 16 Node runtime 위에 route-local first 원칙으로 구조를 정리한다.
기능 변경, URL 변경, 데이터 계약 변경을 이 단계에 섞지 않는다.

M2의 목표는 디렉터리를 많이 만드는 것이 아니라 import ownership과 route 경계를 명확히 하는
것이다. 재사용 근거가 없는 코드는 `widgets`나 `entities`로 승격하지 않는다.

## 2. 선행 결정: URL locale

architecture 11과 migration runbook 12에 따라 URL locale 전략을 먼저 확정해야 한다.

현재 URL은 locale prefix가 없다.

| 항목 | 현재 상태 | M2에서 필요한 결정 |
|---|---|---|
| UI locale | 별도 URL locale 없음 | 지원 locale 목록과 fallback |
| content locale | DB 콘텐츠/가사 데이터 | UI locale과 분리 유지 |
| URL 형태 | `/albums/[slug]` 등 | `/ko/...` prefix 도입 여부 |
| i18n library | 미선정 | URL 전략과 함께 선정 |

### 2.1 구현 전 승인 필요

다음 중 하나를 명시적으로 선택한다.

1. **prefix 없음 유지**: 기존 URL을 유지하고 UI locale은 요청/사용자 설정 정책으로 별도 결정한다.
2. **locale prefix 도입**: 지원 locale, 기본 locale, fallback, 기존 URL redirect/redirect 제외 정책을
   확정한 뒤 route segment를 이동한다.

결정 전에는 `src/app` route segment를 변경하지 않는다. 현재 호환성을 우선한다면 M2의 기본
가정은 **prefix 없음 유지**이며, 사용자의 승인을 받은 경우에만 적용한다.

## 3. 현재 구조 분류

### 3.1 Route 영역

| 영역 | 현재 route | M2 처리 |
|---|---|---|
| 사용자 | `/`, `/chants`, `/albums/[slug]`, `/songs/[slug]` | route-local composition 유지 |
| 사용자 부가 | `/more/*` | route-local composition 유지 |
| 관리자 | `/admin`, `/admin/albums`, `/admin/songs`, `/admin/edit/[slug]` | admin route-local 경계 명확화 |
| 공통 metadata | `/robots.txt`, `/sitemap.xml` | app convention 유지 |

### 3.2 현재 slice와 목표 ownership

| 현재 위치 | 1차 목표 | 이동 조건 |
|---|---|---|
| `src/app/**` | route composition과 layout만 소유 | page 내부 로직은 private folder로 격리 |
| `src/features/auth` | auth feature 유지 | 다른 feature에서 직접 내부 파일 import 금지 |
| `src/features/manage-content` | admin content feature 유지 | 공개 진입점 필요성이 확인될 때 index 추가 |
| `src/features/manage-lyrics` | lyrics management feature 유지 | route-specific UI는 route-local 우선 |
| `src/features/album-info` | album detail feature 유지 | 2개 이상 route 재사용 시 widget/entity 검토 |
| `src/features/chant-sync` | chant sync feature 유지 | 순수 model/lib와 client UI 분리 |
| `src/shared/components` | 공통 UI 여부 재분류 | 실제 2개 이상 consumer만 shared 승격 |
| `src/shared/api` | M3/M4 전까지 임시 persistence 경계 | M2에서 Service/Repository 생성 금지 |

## 4. 목표 구조 원칙

```text
src/app       route, layout, metadata, route-local composition
src/widgets   여러 route에서 재사용되는 화면 단위
src/features  사용자 가치/행동 단위 기능
src/entities  여러 feature가 공유하는 domain model
src/shared    framework-agnostic UI, util, config, type
src/server    server-only composition; M3에서 본격 정착
```

- route-local private folder를 먼저 사용한다.
- public slice는 `index.ts`를 통해서만 외부에 공개한다.
- `pages` proxy layer를 만들지 않는다.
- UI가 DB query, cache invalidation, permission 판정을 직접 알지 않게 한다.
- M2에서는 Service/Repository/DTO/Route Handler를 새로 만들지 않는다. 이는 M3/M4 책임이다.
- 이름만 바꾸는 대규모 이동은 하지 않고, 이동마다 import graph와 consumer 수를 기록한다.

## 5. 실행 순서

### Checkpoint 0 — baseline

- `migration_develop`에서 분기된 `migration_m2-structure`인지 확인
- 작업 트리 clean 확인
- URL locale 결정 상태 확인

### Checkpoint 1 — route inventory 고정

- 14개 page route와 admin/user layout을 목록화
- 각 page의 direct import와 client boundary 기록
- URL, metadata, loading/error 경계를 변경하지 않음

### Checkpoint 2 — route-local 격리

- page에만 쓰이는 helper/UI를 해당 route의 private folder로 이동
- 이동 후 `@/app/**` 외부에서 private path를 import하지 않음
- public route 동작과 기존 URL을 유지

### Checkpoint 3 — promotion by evidence

- 동일 UI가 실제로 2개 이상 route에서 사용되는지 확인
- 근거가 있는 경우에만 `widgets` 또는 `entities`로 승격
- 승격 slice에는 `index.ts` public API와 consumer 목록을 남김

### Checkpoint 4 — boundary 정리

- feature 간 내부 파일 직접 import 제거
- shared에 남길 코드와 feature로 돌릴 코드를 consumer 기준으로 분류
- DB/cache/auth 정책 이동은 후속 M3~M5 backlog로 기록

### Checkpoint 5 — handoff

- 변경된 import graph와 route smoke 결과 기록
- M3 Service/Repository, M4 API/Query, M5 Auth/Authz로 넘길 항목 기록
- 스테이지별 커밋 후 사용자 확인 대기

## 6. 커밋/PR 규칙

- 각 checkpoint 완료 후 의미 단위로 커밋한다.
- 작업 중에는 PR을 생성하지 않는다.
- M2 작업과 확인이 끝난 뒤 `migration_m2-structure`를 push하고 PR 링크를 전달한다.
- 추가 수정은 같은 브랜치에 커밋·push하여 기존 PR에 반영한다.
- 사용자가 명시할 때만 `squash and merge`한다.
- 문서만 변경한 checkpoint에서는 lint/typecheck/test/build를 실행하지 않는다.

## 7. 현재 blocker

URL locale 전략이 아직 승인되지 않았다. 따라서 이 커밋에서는 계획 문서만 추가하고 route/FSD
코드 이동은 시작하지 않는다.

