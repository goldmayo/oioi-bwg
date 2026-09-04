---
title: "As-Is Screen ID 목록"
document_id: "RE-SCREEN-001"
version: "0.1.1"
status: "draft"
authority: "plan"
updated_at: "2026-09-05"
tags:
  - "reverse-engineering"
  - "screen"
  - "as-is"
---

## Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.1 | 2026-09-05 | - | 접근 범위 단순화, 공통 동작 책임 축소 및 Change Log 위치 보정 |
| 0.1.0 | 2026-09-05 | - | 실제 Page/Route 기준 Screen ID 목록 작성 |

# As-Is Screen ID 목록

## 1. 화면 목록

| Screen ID | 화면명 | URL | 실제 구현 위치 | Type | 권한 | 핵심 동작 | 상태 |
|---|---|---|---|---|---|---|---|
| SCR-PUB-001 | 홈 | `/` | `src/app/(user)/page.tsx` | Page | Public | visible album/song 조회 후 앨범 목록 표시 | 확인됨 |
| SCR-PUB-002 | 응원법 리스트 | `/chants` | `src/app/(user)/chants/page.tsx` | Page | Public | 공개 곡 평탄화 목록 표시 및 클라이언트 필터 | 확인됨 |
| SCR-PUB-003 | 앨범 상세 | `/albums/{slug}` | `src/app/(user)/albums/[slug]/page.tsx` | Page | Public | 앨범 상세와 수록곡 링크 표시 | 확인됨 |
| SCR-PUB-004 | 곡 응원법 뷰어 | `/songs/{slug}` | `src/app/(user)/songs/[slug]/page.tsx` | Page | Public | YouTube 재생 시간에 맞춰 가사 행과 응원 구간 동기화 | 확인됨 |
| SCR-PUB-005 | 더보기 | `/more` | `src/app/(user)/more/page.tsx` | Page | Public | 하위 정보 메뉴 제공 | 확인됨 |
| SCR-PUB-006 | 공지사항 | `/more/notice` | `src/app/(user)/more/notice/page.tsx` | Page | Public | 공지 accordion 표시 | 확인됨 |
| SCR-PUB-007 | 안내 및 약관 | `/more/policy` | `src/app/(user)/more/policy/page.tsx` | Page | Public | 정책 상세 링크 목록 표시 | 확인됨 |
| SCR-PUB-008 | 정책 상세 | `/more/policy/{slug}` | `src/app/(user)/more/policy/[slug]/page.tsx` | Page | Public | 정책 본문 표시; 정적 slug 5종 | 확인됨 |
| SCR-PUB-009 | 오류 제보 | `/more/report` | `src/app/(user)/more/report/page.tsx` | Page | Public | 외부 Google Form 링크 제공 | 확인됨 |
| SCR-PUB-010 | 업데이트 내역 | `/more/updates` | `src/app/(user)/more/updates/page.tsx` | Page | Public | 업데이트 내역 정적 표시 | 확인됨 |
| SCR-AUTH-001 | 관리자 로그인 | `/admin-login` | `src/app/admin-login/page.tsx` + `features/auth` | Page | Guest Only | 이메일/비밀번호 제출, 로그인 오류 표시 | 확인됨 |
| SCR-ADM-001 | 관리자 진입 | `/admin` | `src/app/(admin)/admin/page.tsx` | Redirect | Admin | `/admin/albums`로 이동 | 확인됨 |
| SCR-ADM-002 | 앨범 관리 | `/admin/albums` | `src/app/(admin)/admin/albums/page.tsx` | Page | Admin | 앨범 CRUD | 확인됨 |
| SCR-ADM-003 | 곡 관리 | `/admin/songs` | `src/app/(admin)/admin/songs/page.tsx` | Page | Admin | 곡 CRUD 및 가사 편집 진입 | 확인됨 |
| SCR-ADM-004 | 가사 편집 | `/admin/edit/{slug}` | `src/app/(admin)/admin/edit/[slug]/page.tsx` | Page | Admin | 가사 행/세그먼트/타이밍 편집 및 저장 | 확인됨 |

## 2. 공통 화면 동작

| 항목 | 확인된 동작 |
|---|---|
| 공개 레이아웃 | Global navigation에 홈·응원법·더보기 메뉴가 존재한다. |
| 관리자 레이아웃 | 관리자 영역에 앨범 관리·곡 관리 사이드 메뉴가 존재한다. |
| 인증되지 않은 관리자 접근 | 관리자 layout에서 `/admin-login`으로 이동한다. |
| 인증된 관리자 로그인 화면 접근 | `/admin`으로 이동한다. |
| 관리자 권한 부족 | 관리자 layout에서 `forbidden()`을 호출한다. |
| 상세 조회 실패 | 앨범/곡 slug 조회 결과가 없으면 `notFound()`를 호출한다. |
