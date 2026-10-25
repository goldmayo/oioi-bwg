---
title: "ADR 0007: 공용 테이블 지원 범위와 소비처 조합 책임"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-10-25"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0007: 공용 테이블 지원 범위와 소비처 조합 책임

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

최초 구현은 Console에서 쓰는 정렬·페이징 두 기능만 수용하고 Body 내부 구조와 버튼을 고정해 사용자의 요구를 충족하지 못했다.

## 결정과 대안

공용 UI는 15개 기능의 조합 부품을 제공하고, 소비처는 공식 tableFeatures·createTableHook/useTable·ColumnDef·state/on\*Change와 배치 구성을 소유한다. Console은 필요한 정렬·페이징만 선택하고 기존 Button을 주입한다.

Console의 현재 기능 수를 공용 패키지의 지원 한도로 삼는 부분 수용을 철회했다. 모든 화면에 15개를 강제하는 기본 factory나 자체 Controller/Plugin/열 DSL도 만들지 않았다.

## 결과와 한계

packages/ui의 도메인 독립성과 앱→package 의존 방향을 지킨다. 서버 페이징·URL·계정별 저장 정책은 소비처 계약이다. 15개 기능 구현의 통합 완료와 실제 운영 배포는 같은 사실이 아니다.

## 근거

- [구현·검증 기록](../migration/implementation/COMPOSABLE-DATA-TABLE-RESULT.md)
- [관련 기준 또는 이전 결정](../migration/implementation/CONSOLE-DATA-TABLE-RESULT.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/4a517def)
- [시간순 devlog](../devlog/README.md)
