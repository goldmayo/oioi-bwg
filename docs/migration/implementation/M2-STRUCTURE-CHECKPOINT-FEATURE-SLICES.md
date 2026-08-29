---
title: "M2 Feature Slice Normalization Result"
document_id: "M2-STRUCTURE-CHECKPOINT-FEATURE-SLICES"
version: "1.0"
status: "active"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M2-STRUCTURE"
---

# M2 Feature Slice Normalization Result

## 범위

M2의 첫 코드 checkpoint로 기능 slice의 책임별 segment와 public API를 정리했다. URL, locale
routing, 데이터 계약, Service/Repository/DTO는 변경하지 않았다.

## 변경 내역

| slice | 이동/정리 | public API |
|---|---|---|
| `album-info` | 상세 모달·스켈레톤을 `ui`로 이동 | `index.ts` 추가 |
| `auth` | 로그인 UI를 `ui`, server action을 `api`로 이동 | `LazyLoginForm`, `signIn`, `signOut` |
| `chant-sync` | 뷰어를 `ui`로 이동 | `LyricsViewerClient` |
| `manage-content` | server action을 `api`, form schema를 `model`로 이동 | 앨범/곡 manager UI |
| `manage-lyrics` | server action을 `api`, 편집 hook과 테스트를 `model`로 이동 | `LazyAdminEditor` |

앱 route와 `src/containers/sidebar/SidebarWrapper.tsx`의 기능 slice 참조는 내부 파일 경로가
아닌 각 slice의 `index.ts` public API를 사용하도록 변경했다.

## 검증 결과

- `pnpm type-check`: PASS
- `pnpm test:harness`: PASS — 7 tests
- `pnpm test:unit:run`: PASS — 5 files, 21 tests
- `pnpm lint:fsd`: PASS — no problems
- `pnpm build`: PASS — Next.js 16.3.3 standalone
- `pnpm lint`: 기존 shared/containers 정리 전까지 EXPECTED FAIL — 38 errors, 4 warnings

남은 ESLint 오류는 `src/containers`와 `src/shared`의 M2 재분류 대상이다. 해당 폴더를 ignore로
숨기지 않고 다음 checkpoint에서 consumer 근거를 확인해 이동한다.

## 비범위

- 기존 `/albums/[slug]`, `/songs/[slug]`, `/more/*`, `/admin/*` URL 유지
- locale prefix 및 locale routing 설계
- DB query/command, Service/Repository, auth 정책의 책임 이동
