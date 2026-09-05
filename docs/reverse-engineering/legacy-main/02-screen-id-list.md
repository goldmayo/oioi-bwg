---
title: Legacy Main Screen ID List
document_id: RE-MAIN-002
version: 0.1.0
status: draft
authority: plan
source:
  repository: goldmayo/oioi-bwg
  branch: main
  commit: 4b299934846f4a0eed7132f58c5b1c2a481a3739
---

## Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-09-05 | Codex | main page 기준 화면 inventory 작성 |

# Legacy Main Screen ID List

| Screen ID | Route | 이름 | 영역 | 접근 범위 | 구현 파일 | 주요 목적 |
|---|---|---|---|---|---|---|
| SCR-MAIN-PUB-001 | `/` | 홈 | Public | 누구나 | `src/app/(user)/page.tsx` | 공개 앨범 목록과 곡 진입 |
| SCR-MAIN-PUB-002 | `/chants` | 응원법 목록 | Public | 누구나 | `src/app/(user)/chants/page.tsx` | 곡 목록 조회 및 client 필터 |
| SCR-MAIN-PUB-003 | `/albums/[slug]` | 앨범 상세 | Public | 누구나 | `src/app/(user)/albums/[slug]/page.tsx` | 앨범 곡 목록을 modal로 표시 |
| SCR-MAIN-PUB-004 | `/songs/[slug]` | 곡 응원법 viewer | Public | 누구나 | `src/app/(user)/songs/[slug]/page.tsx` | YouTube와 동기화된 가사 표시 |
| SCR-MAIN-PUB-005 | `/more` | 더보기 | Public | 누구나 | `src/app/(user)/more/page.tsx` | 정보·정책 메뉴 제공 |
| SCR-MAIN-PUB-006 | `/more/notice` | 공지사항 | Public | 누구나 | `src/app/(user)/more/notice/page.tsx` | 공지 정적 표시 |
| SCR-MAIN-PUB-007 | `/more/report` | 오류 제보 | Public | 누구나 | `src/app/(user)/more/report/page.tsx` | Google Forms 외부 링크 이동 |
| SCR-MAIN-PUB-008 | `/more/updates` | 업데이트 내역 | Public | 누구나 | `src/app/(user)/more/updates/page.tsx` | 업데이트 정적 표시 |
| SCR-MAIN-PUB-009 | `/more/policy` | 정책 목록 | Public | 누구나 | `src/app/(user)/more/policy/page.tsx` | 정책 항목 목록 |
| SCR-MAIN-PUB-010 | `/more/policy/[slug]` | 정책 상세 | Public | 누구나 | `src/app/(user)/more/policy/[slug]/page.tsx` | 정책 상세와 fallback |
| SCR-MAIN-ADM-001 | `/admin` | 관리자 진입/로그인 | Admin boundary | 누구나 진입 가능 / 관리 UI는 admin만 | `src/app/(admin)/admin/layout.tsx`, `page.tsx` | role 확인 후 관리 화면 또는 로그인 폼 |
| SCR-MAIN-ADM-002 | `/admin/albums` | 앨범 관리 | Admin | `app_metadata.role=admin` | `src/app/(admin)/admin/albums/page.tsx` | 앨범 CRUD |
| SCR-MAIN-ADM-003 | `/admin/songs` | 곡 관리 | Admin | `app_metadata.role=admin` | `src/app/(admin)/admin/songs/page.tsx` | 곡 CRUD |
| SCR-MAIN-ADM-004 | `/admin/edit/[slug]` | 가사 편집 | Admin | layout 조건 충족 | `src/app/(admin)/admin/edit/[slug]/page.tsx` | 가사·YouTube ID 편집 |

## 확인 상태

- 모든 항목은 main commit의 실제 page/layout에서 확인되어 `confirmed`다.
- 별도 `/admin-login` page는 확인되지 않는다. 로그인 UI는 AdminLayout 내부에서 렌더링된다.
- 화면 ID는 migrated-current 문서의 ID와 동일할 필요가 없는 main snapshot 전용 식별자다.
