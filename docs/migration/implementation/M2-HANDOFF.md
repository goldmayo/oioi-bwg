---
title: "M2 Handoff"
document_id: "M2-HANDOFF"
version: "1.0"
status: "active"
authority: "handoff"
updated_at: "2026-08-29"
depends_on:
  - "M2-STRUCTURE"
  - "M2-ROUTE-INVENTORY"
  - "M2-STRUCTURE-REFACTOR-INVENTORY"
---

# M2 Handoff

M2는 route ownership과 import 경계를 정리했다. 데이터 계약이나 동작은 변경하지 않았다.

## M3 — Server Foundation

현재 다음 코드가 `src/shared/api/db`에 남아 있다.

- Drizzle client/schema/query/command
- Supabase client/server/middleware
- RSC page의 query 직접 호출
- Server Action의 validation·DB·cache 혼합

M3에서 `src/server/db`, `repositories`, `services`로 책임을 이동하고, transaction ownership과
plain DTO mapping을 확립한다. Service는 app/Next/client를 import하지 않는다.

## M4 — Data / API / Query

M3 이후 다음을 도입한다.

- Route Handler와 `ky` HTTP adapter
- Zod request/response contract 및 `ApiError`
- Drizzle row가 아닌 외부 DTO
- Entity API가 소유하는 `queryOptions`/`mutationOptions`
- request별 server QueryClient, browser lifecycle QueryClient
- RSC Service fetch → Query cache seed → hydration
- mutation 성공 후 명시적 query invalidation

현재 `package.json`에는 `@tanstack/react-query`가 직접 등록되어 있지 않다. API/DTO 경계가
준비된 M4 착수 시점에 추가한다.

## M5 — Auth/Authz

현재 admin layout과 Server Action은 Supabase session/metadata에 의존한다. M5에서 Auth.js,
RequestContext, CASL 및 service security boundary로 교체한다. Proxy/layout 통과만으로
mutation 권한을 보장하지 않는다.

## Entity / Widget 판단

- Entity: DOMAIN_SPECIFICATION의 Artist/Song/CheerGuide/Revision 계약을 M3~M4에서 정의한 뒤
  DTO와 함께 생성한다.
- Widget: 현재 2개 이상 route에서 재사용되는 완성 화면 단위가 확인되지 않아 생성하지 않는다.
- Route-local: 단일 consumer UI는 M2에서 private folder로 이관했다.

## M2 종료 조건

- [x] route inventory
- [x] route-local 후보 이관
- [x] import boundary 검증
- [x] M3/M4/M5 handoff 기록
- [x] standalone build 및 주요 route smoke
- [ ] 사용자 확인 후 M2 브랜치 push/PR

### Route smoke evidence

Next.js 16.3.3 standalone server에서 다음 경로가 모두 HTTP 200을 반환했다.

`/`, `/chants`, `/more`, `/more/notice`, `/more/policy`, `/more/report`, `/more/updates`,
`/robots.txt`, `/sitemap.xml`, `/albums/not-found`, `/songs/not-found`, `/admin`
