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

공용 action/subject vocabulary와 role별 `can/cannot` rule을 CASL `AppAbility`로 정의했다.
guest는 public read만 가능하고, USER/REVIEWER/ADMIN 권한은 DOMAIN_SPECIFICATION의 matrix를 따른다.
소유자 조건이 필요한 Profile/OAuthIdentity/Comment rule은 account id 조건으로 제한한다.

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
