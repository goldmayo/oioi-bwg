---
title: "ADR 0005: 안전한 오류 추적과 Slack relay의 책임"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-09-20~10-25"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0005: 안전한 오류 추적과 Slack relay의 책임

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

발생 위치와 처리 결과를 구분하면서 민감한 요청·사용자·DB 정보를 외부 오류 수집으로 보내지 않아야 했다.

## 결정과 대안

structured logging과 Sentry 오류 추적의 책임을 분리한다. scoped SDK tags와 최종 allowlist sanitizer를 사용하고 독립 Worker는 서명된 Sentry webhook을 정규화해 Slack에 전달한다.

원본 payload를 그대로 전송하거나 global setTag만으로 식별 정책을 보장하는 방식을 택하지 않았다. 앱 이름의 notification/alert 변경은 실제 기능 확장 없이 수행하지 않았다.

## 결과와 한계

SDK 태그 검토와 원격 Sentry rule/event 감사는 서로 다른 검증 범위다. relay의 두 secret과 앱 build/runtime 환경의 소유권을 구분한다.

FWA-01/02 오류 복구·FWA-03 Dialog 구현과 FWA-04의 설계 산출물 완료는 [프레임워크 결과](../migration/implementation/FRAMEWORK-IMPROVEMENT-RESULT.md)를 따른다.
순수 정책 공통화의 runtime 구현은 [미완료 제안](../migration/implementation/OBSERVABILITY-POLICY-SHARING-PLAN.md)이다.
공통화 package 예외가 이미 승인된 현행 계약이라고 해석하지 않는다.

## 근거

- [구현·검증 기록](../migration/implementation/SENTRY-SLACK-RELAY-RESULT.md)
- [관련 기준 또는 이전 결정](../migration/oioi-bwg-architecture-clean-v1/09-error-ux-observability.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/088532cc)
- [시간순 devlog](../devlog/README.md)
