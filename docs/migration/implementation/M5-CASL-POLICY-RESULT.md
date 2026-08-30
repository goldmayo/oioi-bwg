---
title: "M5 CASL Policy Result"
document_id: "M5-CASL-POLICY-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-08-30"
depends_on:
  - "M5-REQUEST-CONTEXT-RESULT"
---

# M5 CASL Policy Result

## 완료 범위

- `APP_ACTIONS`, `APP_SUBJECTS`, `AppAbility` 공용 계약을 추가했다.
- DOMAIN_SPECIFICATION permission matrix 기준으로 Guest/USER/REVIEWER/ADMIN rule을 정의했다.
- Guest는 공개 조회만 가능하다.
- USER는 Contribution/Discussion/Report 생성과 본인 Profile/OAuthIdentity/Comment 변경이 가능하다.
- REVIEWER는 DiscussionThread 검토와 resolve/reject/carry-over를 수행할 수 있다.
- ADMIN은 전체 subject를 관리할 수 있다.
- Profile과 DiscussionComment는 account id 소유자 조건으로 제한한다.

## 제외 범위

- locale 및 album/locale assignment는 지원하지 않는다.
- DB policy table, rule release/version, 동적 permission DSL은 만들지 않았다.
- 실제 service/Route Handler/RSC 보안 경계 적용은 후속 checkpoint다.

## 검증

- Guest public read/write denial
- USER 생성 권한과 own-comment 조건
- REVIEWER thread decision 및 revision approval 거부
- ADMIN global manage 권한
- `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`
- `pnpm test:unit:run` (14개 파일, 47건 통과)
- `pnpm format:check`, `pnpm build`

운영 DB에는 연결하거나 변경하지 않았다.
