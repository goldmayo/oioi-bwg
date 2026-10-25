---
title: "OCI 배포와 오류 관측의 출처"
kind: devlog
recorded_at: "2026-10-25"
work_period: "2026-09-11~09-30"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# OCI 배포와 오류 관측의 출처

## 해결하려던 문제

배포 실행 권한·이미지 runtime·오류 발생 위치를 운영 환경에서 확인할 근거가 필요했다.

## 진행과 결정

OCI CI/CD와 native ARM64 빌드를 연결하고 Run Command의 IAM·조회 경계를 보완했다. Sentry 초기화·source map·Slack relay와 structured logging을 정비했다.

## 시행착오와 회고

설계가 허용하는 경로와 실제 IAM·endpoint가 동작하는 경로는 다를 수 있었다. 실패 응답을 숨기지 않고 보완을 기록하며 오류 수집에서는 민감 정보를 제거했다.

## 검증과 한계

9월 구축을 10월 두 앱 배포 완료로 간주하지 않는다. 현재 배포 절차는 후속 Promotion·paired receipt 개정을 따른다.

이 글은 블로그 초안용 소급 기록이며 새 검증 결과나 당시 기록에 없는 동기를 만들어 넣지 않았다.

## 연결

- [관련 ADR](../adr/0005-observability.md)
- [원본 설계·결과](../migration/implementation/M9-CICD-OCI-OPERATIONS-RESULT.md)
- [병합 이력의 기준 커밋](https://github.com/goldmayo/oioi-bwg/commit/9cfa5548)
- [시간순 목차](README.md)
