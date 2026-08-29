---
title: "M2 Shared Boundary Normalization Result"
document_id: "M2-STRUCTURE-CHECKPOINT-SHARED-BOUNDARIES"
version: "1.0"
status: "active"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M2-STRUCTURE"
  - "M2-STRUCTURE-CHECKPOINT-FEATURE-SLICES"
---

# M2 Shared Boundary Normalization Result

## 범위

공용 코드와 기존 `containers` 폴더의 ownership을 헌법의 segment vocabulary에 맞췄다. URL,
locale routing, 데이터 계약과 서버 Service/Repository 책임은 변경하지 않았다.

## 변경 내역

| 기존 위치 | 목표 위치 | 근거 |
|---|---|---|
| `src/containers/GridContainer.tsx` | 제거 | consumer 0개인 dead code |
| `src/containers/sidebar/*` | `src/app/(admin)/admin/_ui/*` | 관리자 route에서만 사용되는 composition |
| `shared/components/**` | `shared/ui/**` | presentation component |
| `shared/hooks/**` | `shared/model/**` | React state/lifecycle orchestration |
| `shared/types/**` | `shared/model/**` | application/domain type |
| `shared/utils/**` | `shared/lib/**` | 순수 변환·분석·metadata helper |
| `shared/constants/site.ts` | `shared/config/site.ts` | 런타임 설정/metadata 상수 |
| `shared/feature-flag/**` | `shared/ui`, `shared/config`, `shared/lib` | UI/config/server wrapper 책임 분리 |

모든 consumer import는 새 segment 경로로 갱신했다. route private UI는 route 내부 상대 경로로만
참조하며, URL은 기존 `/albums/[slug]`, `/songs/[slug]`, `/more/*`, `/admin/*`를 유지한다.

## 검증 결과

- `pnpm type-check`: PASS
- `pnpm test:harness`: PASS — 7 tests
- `pnpm test:unit:run`: PASS — 5 files, 21 tests
- `pnpm lint:fsd`: PASS — no problems
- `pnpm lint`: PASS — 0 errors, 4 review warnings
- `pnpm format:check`: PASS
- `pnpm build`: PASS — Next.js 16.3.3 standalone

남은 4개 warning은 함수 길이 review signal이며 헌법에 따라 CI 오류로 승격하지 않는다.

## 다음 작업

M2 구조 하네스 기준의 폴더/segment 오류는 해소됐다. 다음 단계는 route inventory와 route-local
composition을 실제 consumer 근거로 재검토하고, M3 이후로 넘길 server/query 책임을 문서화하는
것이다.
