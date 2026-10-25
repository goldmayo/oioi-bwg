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

완료 설계 삭제 전 다음 결정의 원문과 결과도 대조했다. persistence의 known physical constraint는
repository에서 semantic error로 번역하고 service는 기존 AppError로 연결한다. unknown error identity는 보존한다.
R2는 기존 canonical URL·자산을 유지하기 위해 선택했고 범용 storage framework나 자산 일괄 이관은 추가하지 않았다.
이메일 OTP는 검증과 계정 생성을 나누고 최종 consume/계정 생성만 transaction으로 묶었다.
작은 메일 infrastructure를 유지한 결정이며 현재 공개 가입 재개·메일 실발송 승인이나 전체 인증 구현 완료를 뜻하지 않는다.

## 근거

- [Album 구현·검증](../migration/implementation/M6-ADMIN-ALBUM-CLIENT-TRANSPORT-RESULT.md), [Song](../migration/implementation/M6-ADMIN-SONG-CLIENT-TRANSPORT-RESULT.md), [Lyrics](../migration/implementation/M6-ADMIN-LYRICS-CLIENT-TRANSPORT-RESULT.md)
- [persistence 결과](../migration/implementation/PERSISTENCE-ERROR-BOUNDARY-RESULT.md), [R2 결과](../migration/implementation/M5-R2-ADMIN-IMAGE-UPLOAD-RESULT.md), [가입 완료 결과](../migration/implementation/M5-COMPLETE-SIGNUP-RESULT.md)
- [삭제 설계별 고정 원문과 후속 대응](../migration/implementation/COMPLETED-DESIGN-INDEX.md#2026-10-26-파일별-삭제대응-기록)
- [관련 기준 또는 이전 결정](../migration/oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/a92959d6)
- [시간순 devlog](../devlog/README.md)
