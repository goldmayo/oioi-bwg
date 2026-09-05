---
title: Legacy Main Screen Specification
document_id: RE-MAIN-005
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
| 0.1.0 | 2026-09-05 | Codex | main page·component·action 관찰 기준 화면 명세 작성 |

# Legacy Main Screen Specification

## 1. Public

| Screen | 주요 UI / 동작 | 데이터·상태 |
|---|---|---|
| `SCR-MAIN-PUB-001` 홈 | 브랜드 헤더, 설명, 앨범 list/grid, responsive nav | `getAllAlbumsWithSongs` Suspense; `AlbumListSkeleton`; 곡 없는 앨범 제외 |
| `SCR-MAIN-PUB-002` 응원법 목록 | 제목, `FilteredChantList`, 앨범 cover·곡 목록 | server initial data; filter는 client; loading skeleton |
| `SCR-MAIN-PUB-003` 앨범 상세 | Suspense loader와 `AlbumDetailModal` | slug query; 결과 없음 `notFound()`; `"use cache"` 확인 |
| `SCR-MAIN-PUB-004` 곡 viewer | YouTube player, 가사 viewer, album navigation | slug query; 결과/album 없음 `notFound()`; client viewer state |
| `SCR-MAIN-PUB-005` 더보기 | Notice/Report/Updates/Policy card list | 정적 RSC; 별도 fetch 없음 |
| `SCR-MAIN-PUB-006` 공지 | 정적 공지 UI | 저장소 내부 page 기준; 별도 data access 없음 |
| `SCR-MAIN-PUB-007` 오류 제보 | Google Forms 링크로 외부 이동 | `GOOGLE_FORM_URL` anchor 확인 |
| `SCR-MAIN-PUB-008` 업데이트 | 업데이트 정적 내용 | 별도 data access 없음 |
| `SCR-MAIN-PUB-009` 정책 목록 | 정책 링크 목록 | 정적 RSC |
| `SCR-MAIN-PUB-010` 정책 상세 | `POLICY_DETAILS` 기반 content | `generateStaticParams`; 알 수 없는 slug는 privacy fallback |

## 2. Admin

| Screen | 주요 UI / 동작 | 데이터·상태 |
|---|---|---|
| `SCR-MAIN-ADM-001` 관리자 진입 | role 불충족 시 lazy login form; 성공 시 admin children | Supabase `getUser`; login form loading/error |
| `SCR-MAIN-ADM-002` 앨범 관리 | 전체 table, search, 10건 client pagination, add/edit dialog, delete confirmation | `getAllAlbums`; action 후 `window.location.reload`; empty/search empty |
| `SCR-MAIN-ADM-003` 곡 관리 | 전체 table, title/slug/album search, album filter, 15건 pagination, CRUD | `getSongsWithAlbum`+`getAllAlbums`; LRC required on create; editor link |
| `SCR-MAIN-ADM-004` 가사 편집 | admin editor, lyric row/segment/time/preview UI | slug query; song 없음 `notFound`; save action; editor local state |

## 3. 공통 상태 및 오류

- Root `loading.tsx`, `global-error.tsx`, `not-found.tsx`가 존재한다.
- 앨범·곡 상세 page는 Suspense fallback을 직접 정의한다.
- Admin page는 page-level `dynamic = "force-dynamic"`, `noindex` metadata를 설정한다.
- Server Action 실패는 각 action의 `{ success: false, error }` 반환값으로 client가 alert 또는 form error를 표시한다.
- 실제 production의 cache hit/miss와 Supabase 정책에 따른 오류 화면은 `unknown`이다.

## 4. Assets / external UI

- `next/image`는 `unoptimized: true`이며 R2 hostname을 remote pattern으로 설정한다.
- main의 album image upload는 Supabase Storage public URL을 사용한다.
- YouTube player는 `YoutubePlayer`와 viewer feature에서 사용된다.
