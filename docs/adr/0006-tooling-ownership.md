---
title: "ADR 0006: 모노레포 검사와 캐시의 실제 소비처 소유권"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-10-23~25"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0006: 모노레포 검사와 캐시의 실제 소비처 소유권

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

workspace로 나눈 뒤에도 루트 설정·도구·캐시가 모든 앱에 결합해 변경 영향과 검사 비용이 과도했다.

## 결정과 대안

설정·테스트·하네스·운영 명령의 실행 주체와 직접 의존성을 실제 workspace에 둔다. task별 입력·앱별 prune/build/cache를 분리하고 동일 실행의 배포 candidate 검증은 유지한다.

미관을 위한 모든 설정의 configs 이동이나 unused 분석만으로 삭제하는 방식을 택하지 않았다. 자동 탐색 진입점을 보존하고 CLI·peer·검사 경계를 함께 확인했다.

## 결과와 한계

affected·캐시 적중과 전체 verify를 구분해 관측해야 한다. 공통 정책 변경의 재검사 범위와 도구 소유권을 회귀 검사로 유지한다.

## 근거

- [구현·검증 기록](../migration/implementation/MONOREPO-BOUNDARIES-AND-EXECUTION-RESULT.md)
- [관련 기준 또는 이전 결정](../migration/implementation/MONOREPO-BEFORE-AFTER.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/c6c2f71b)
- [시간순 devlog](../devlog/README.md)
