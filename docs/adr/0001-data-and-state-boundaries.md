---
title: "ADR 0001: 데이터 접근과 클라이언트 상태 소유권"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-08~09"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0001: 데이터 접근과 클라이언트 상태 소유권

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

기능이 Server Action·DB row·캐시 갱신 방식에 결합해 변경 경계를 찾기 어려웠다.

## 결정과 대안

RSC는 service를 직접 호출하고, 브라우저의 서버 상태는 TanStack Query → ky → Route Handler → service로 연결한다. service가 권한·트랜잭션·DTO를 소유하고 repository는 전달받은 executor로 SQL만 수행한다. 폼 draft는 RHF가 소유한다.

Server Action을 모든 조회·mutation의 기본 transport로 유지하는 안과 범용 Repository·DI framework를 추가하는 안을 채택하지 않았다. 단순 전달보다 도메인·HTTP·persistence의 변경 이유를 나누는 기준을 택했다.

## 결과와 한계

HTTP DTO 검증과 명시적 Query invalidation이 필요하다. RSC와 Client가 같은 HTTP 획득 경로를 강제하지 않고 같은 queryKey로 초기 데이터를 연결한다.

## 근거

- [구현·검증 기록](../migration/implementation/M6-ADMIN-MUTATION-API-PLAN.md)
- [관련 기준 또는 이전 결정](../migration/oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/a92959d6)
- [시간순 devlog](../devlog/README.md)
