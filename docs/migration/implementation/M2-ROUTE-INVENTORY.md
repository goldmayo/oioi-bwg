---
title: "M2 Route Inventory"
document_id: "M2-ROUTE-INVENTORY"
version: "1.0"
status: "active"
authority: "evidence"
updated_at: "2026-08-29"
depends_on:
  - "M2-STRUCTURE"
---

# M2 Route Inventory

M2 기준 route와 렌더링 경계를 고정한다. URL과 locale routing은 변경하지 않는다.

## Route 목록

| URL | 파일 | 렌더링 | 데이터/경계 |
|---|---|---|---|
| `/` | `app/(user)/page.tsx` | Server page + Suspense | DB query, `_ui/album-list-container` client |
| `/chants` | `app/(user)/chants/page.tsx` | Server page + Suspense | DB query, `_ui/filtered-chant-list` client |
| `/albums/[slug]` | `app/(user)/albums/[slug]/page.tsx` | Server page + Suspense | metadata/query, `features/album-info` client UI |
| `/songs/[slug]` | `app/(user)/songs/[slug]/page.tsx` | Server page + Suspense | metadata/query, `features/chant-sync` client UI |
| `/more` | `app/(user)/more/page.tsx` | Server page | 정적 링크/콘텐츠 |
| `/more/notice` | `app/(user)/more/notice/page.tsx` | Server page | `_ui/notice-accordion` client |
| `/more/policy` | `app/(user)/more/policy/page.tsx` | Server page | 정적 정책 링크 |
| `/more/policy/[slug]` | `app/(user)/more/policy/[slug]/page.tsx` | Server page + static params | 정적 정책 콘텐츠 |
| `/more/report` | `app/(user)/more/report/page.tsx` | Client page | iframe loading state |
| `/more/updates` | `app/(user)/more/updates/page.tsx` | Server page | 정적 업데이트 콘텐츠 |
| `/admin` | `app/(admin)/admin/page.tsx` | Server page | redirect |
| `/admin/albums` | `app/(admin)/admin/albums/page.tsx` | Server page + Suspense | DB query, `manage-content` client UI |
| `/admin/songs` | `app/(admin)/admin/songs/page.tsx` | Server page + Suspense | parallel DB query, `manage-content` client UI |
| `/admin/edit/[slug]` | `app/(admin)/admin/edit/[slug]/page.tsx` | Server page | DB query, `manage-lyrics` client UI |

## Layout 및 전역 경계

| 경계 | 책임 |
|---|---|
| `app/layout.tsx` | metadata, fonts, providers, GTM, app-local guard, toaster |
| `app/(user)/layout.tsx` | user navigation/footer composition |
| `app/(admin)/admin/layout.tsx` | admin session 확인, login gate, admin navigation |
| `app/loading.tsx` | global loading fallback |
| `app/not-found.tsx` | global not-found UI |
| `app/global-error.tsx` | global error logging/UI |

## M2 판정

- [x] 14개 page route 목록 고정
- [x] URL 및 locale prefix 미변경
- [x] route-private client boundary 기록
- [x] metadata/loading/error 경계 기록
- [x] direct DB 접근은 M3 handoff 대상으로 표시
