---
title: "ADR 0004: 검증한 이미지 쌍의 Promotion과 운영 전환"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-09~10-25"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0004: 검증한 이미지 쌍의 Promotion과 운영 전환

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

통합 성공과 배포 성공이 섞이고 재빌드된 이미지가 검증한 candidate와 달라질 수 있었다. 두 앱을 함께 복구할 근거도 필요했다.

## 결정과 대안

migration_main 통합과 migration_develop Promotion을 분리하고 검증한 두 immutable digest와 출처·receipt를 배포한다. www를 OCI Web으로 전환한 뒤 옛 Web Worker·staging·preview를 종료했다.

통합 브랜치 push 자체를 배포로 간주하거나 배포 시 이미지를 다시 만드는 방식을 채택하지 않았다. 이력 연결은 파일 tree를 보존하는 한정 작업으로 수행하고 squash-only 설정을 복원했다.

## 결과와 한계

배포는 두 앱의 공동 release와 정상 baseline을 확인한다. DB·MFA·R2 보존과 hostname·인증 검증이 별도로 필요하며 CI 성공만으로 DNS/TLS 전환 완료를 주장할 수 없다.

## 근거

- [구현·검증 기록](../migration/implementation/console-guide-editor/P06-RESULT.md)
- [관련 기준 또는 이전 결정](../migration/oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/7f16a9d7)
- [시간순 devlog](../devlog/README.md)
