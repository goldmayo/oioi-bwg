---
title: "M3 Preflight"
document_id: "M3-PREFLIGHT"
version: "1.0"
status: "planned"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M2-HANDOFF"
---

# M3 Preflight

M2 종료 후 M3 Server Foundation 착수 전에 확인할 추가 작업이다.

## 착수 전 필수 확인

- `migration_develop`에 M2 squash merge가 반영됐는지 확인
- `migration_m3-server-foundation`을 `migration_develop`에서 새로 생성
- M2의 URL/route ownership 변경이 동작에 영향을 주지 않았는지 smoke 결과 보관
- `.env`와 production DB 접근 방식은 변경하지 않고 server boundary만 이동
- M3 범위를 Service/Repository/transaction/DTO mapping으로 고정

## M3에서 처리할 현재 문제

| 현재 코드 | M3 목표 |
|---|---|
| `shared/api/db/drizzle/index.ts` | `src/server/db` DB singleton |
| `shared/api/db/drizzle/schema.ts` | `src/server/db` persistence schema |
| `shared/api/db/drizzle/queries.ts` | `src/server/repositories` domain-specific read functions |
| `shared/api/db/drizzle/commands.ts` | `src/server/repositories` write functions |
| page의 DB 직접 호출 | page → server service |
| feature action의 DB/validation/cache 혼합 | action/HTTP adapter → service → repository |
| Drizzle row의 UI 직접 노출 | service boundary에서 DTO mapping |
| transaction 부재 | service가 transaction ownership 보유 |

## M3에서 하지 않을 것

- TanStack Query 전면 도입: M4
- Route Handler/ky 전면 도입: M4
- Auth.js/CASL 전환: M5
- URL/locale routing 변경
- DOMAIN_SPECIFICATION 전체 데이터 migration

M3는 서버 경계와 persistence 책임을 먼저 확립한 뒤 M4의 API/Query 도입이 안전하게 진행될
수 있도록 하는 단계다.
