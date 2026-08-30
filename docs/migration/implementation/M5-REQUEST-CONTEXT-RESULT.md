---
title: "M5 RequestContext Result"
document_id: "M5-REQUEST-CONTEXT-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-08-30"
depends_on:
  - "M5-AUTHJS-FOUNDATION-RESULT"
---

# M5 RequestContext Result

## 완료 범위

- `getRequestContext()`를 React `cache()`로 요청 단위 memoization했다.
- Auth.js session의 `user.id`를 bigint Account id로 변환해 DB authorization facts를 조회한다.
- Account status가 `ACTIVE`가 아니거나 계정이 없으면 guest context를 반환한다.
- context에는 `{ user, ability }`만 노출하고 role raw fact는 내부에서만 다룬다.
- `requireUser()`는 guest context에 `UNAUTHENTICATED` AppError를 발생시킨다.
- Route Handler error mapping에 `UNAUTHENTICATED`(401)와 `FORBIDDEN`(403)을 추가했다.

## CASL 경계

이번 checkpoint에서는 CASL `AppAbility` 타입과 빈 deny-by-default Ability만 연결했다.
role별 정책과 실제 `can/cannot` rule은 다음 M5 CASL policy checkpoint에서 추가한다.

## 보류 범위

- admin service, Route Handler, RSC/layout의 실제 인증·인가 검사는 추가하지 않았다.
- Proxy는 UX redirect만 담당하도록 다음 보안 경계 checkpoint에서 정리한다.
- locale 및 album/locale assignment 정책은 지원하지 않는다.

## 검증

- `pnpm type-check`
- `pnpm test:harness`
- `pnpm lint`
- `pnpm lint:fsd`
- `pnpm test:unit:run` (13개 파일, 43건 통과)
- `pnpm format:check`

운영 DB에는 연결하거나 변경하지 않았다.
