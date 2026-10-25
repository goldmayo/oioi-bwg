---
title: "ADR 0002: 공개 Web과 운영 Console의 워크스페이스 분리"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-10-06~07"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0002: 공개 Web과 운영 Console의 워크스페이스 분리

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

하나의 앱에 공개 조회·운영 편집·서버 코드가 함께 있어 독립 배포와 권한 경계를 만들기 어려웠다.

## 결정과 대안

apps/web·apps/console을 분리하고 실제 양쪽 consumer가 사용하는 계약과 서버 core를 packages/contracts·packages/server로 추출했다. Next/Auth.js/request context·HTTP adapter는 각 앱에 남겼다.

패키지를 먼저 빈 틀로 만들거나 앱끼리 소스를 직접 참조하는 방식 대신 기존 동작을 보존하는 이동 → 설정 → 실제 공통 코드 추출 → Console 이관 순서를 택했다.

## 결과와 한계

각 앱은 독립 build·FSD root를 가진다. 공유 DB·VM이므로 앱 분리가 물리적 인프라 격리까지 뜻하지 않는다.

## 근거

- [구현·검증 기록](../migration/implementation/console-guide-editor/P03-SERVER-RESULT.md)
- [관련 기준 또는 이전 결정](../migration/oioi-bwg-architecture-clean-v1/01-architecture-constitution.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/af801d62)
- [시간순 devlog](../devlog/README.md)
