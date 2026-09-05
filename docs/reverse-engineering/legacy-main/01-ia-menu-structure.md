---
title: Legacy Main IA / Menu Structure
document_id: RE-MAIN-001
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
| 0.1.0 | 2026-09-05 | Codex | main App Router와 navigation 기준 IA 작성 |

# Legacy Main IA / Menu Structure

## 1. Route / Layout hierarchy

```text
RootLayout `/src/app/layout.tsx`
├─ UserLayout `(user)`
│  ├─ `/`
│  ├─ `/chants`
│  ├─ `/albums/[slug]`
│  ├─ `/songs/[slug]`
│  └─ `/more`
│     ├─ `/more/notice`
│     ├─ `/more/report`
│     ├─ `/more/updates`
│     ├─ `/more/policy`
│     └─ `/more/policy/[slug]`
└─ AdminLayout `(admin)`
   ├─ `/admin` → `/admin/albums`
   ├─ `/admin/albums`
   ├─ `/admin/songs`
   └─ `/admin/edit/[slug]`
```

`(user)`와 `(admin)`은 route group이며 URL에는 노출되지 않는다. Root layout은 Providers, in-app browser guard, GTM 조건부 script, Toaster를 제공한다.

## 2. Public IA

### Global navigation

`NAV_ITEMS`에서 다음 세 항목을 확인했다.

| 메뉴 | Path | 구현 |
|---|---|---|
| 홈 | `/` | `nav-data.ts`, `GlobalNav`, `BottomNav` |
| 응원법 | `/chants` | 동일 |
| 더보기 | `/more` | 동일 |

Desktop에서는 `GlobalNav`가 상단 fixed header로 표시되고, mobile에서는 `MobileHeader`와 `BottomNav`가 표시된다. `NavLinks`와 `usePathname()`으로 활성 메뉴를 표시한다.

### More IA

`/more`는 다음 정적 링크를 제공한다.

```text
/more
├─ /more/notice
├─ /more/report
├─ /more/updates
└─ /more/policy
   └─ /more/policy/[slug]
```

실제 `policy` slug는 `privacy`, `terms`, `copyright`, `email`, `ga`다. 정의되지 않은 slug는 `privacy` 상세로 fallback한다.

## 3. Admin IA

`AdminSidebar`의 실제 메뉴는 다음 두 개다.

```text
/admin
├─ /admin/albums
├─ /admin/songs
└─ /admin/edit/[slug]
```

`/admin/albums`와 `/admin/songs`는 sibling route다. `/admin/edit/[slug]`는 sidebar 메뉴에는 없지만 실제 route로 존재한다. `/admin` page는 `redirect("/admin/albums")`를 수행한다. 관리자 layout은 Supabase `getUser()` 결과의 `user.app_metadata.role === "admin"`을 확인하고, 조건을 만족하지 않으면 관리자 화면 대신 로그인 폼을 렌더링한다.

## 4. 확인 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| App Router route | `confirmed` | `src/app/**/page.tsx` |
| Public navigation | `confirmed` | `nav-data.ts`, navigation components |
| Admin navigation | `confirmed` | `AdminSidebar.tsx` |
| HTTP API route | `confirmed` | main tree에 `src/app/api` 없음 — 관찰 결과: 없음 |
| 코드에 선언된 외부 링크 | `confirmed` | `/more/report`가 Google Forms URL로 연결 |
| 운영에서 추가되는 외부 링크 | `unknown` | main commit 코드만으로 확인 불가 |
