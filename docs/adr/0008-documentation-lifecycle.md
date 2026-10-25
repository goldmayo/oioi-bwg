---
title: "ADR 0008: 현재 작업과 문서의 종료 수명"
kind: adr
status: accepted
recorded_at: "2026-10-26"
decision_period: "2026-10-25~26"
source_commit: e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f
---

# ADR 0008: 현재 작업과 문서의 종료 수명

## 배경

M0~M9와 P01~P06의 과거 계획, 현재 계약, 미착수 제품 설계가 함께 노출돼 작업 상태와 적용 범위를 찾기 어려웠다.
ADR/devlog를 추가한 #256 뒤에도 완료 계획과 반복 인계가 남았다. 사용자는 감사 #257을 읽고
완료 설계를 실제 삭제하되 결정·실패·운영 절차·미완료 작업을 잃지 않도록 요청했다.

## 결정과 대안

문서 입구는 docs/README, 현재·보류 작업은 docs/WORK 한 곳이 소유한다. WORK는 상태·다음 행동·
완료 조건·근거 링크만 유지하고 상세 계약·명령·검증 결과는 복제하지 않는다.
결정은 ADR, 개발 과정은 날짜순 devlog, 실제 변경·검증·실패는 기존 RESULT 또는 고정 Git 근거로 연결한다.

파일마다 네 대응을 확인한 완료 PLAN/DESIGN을 삭제한다. 보관 폴더로 일괄 이동하거나 삭제 후보 목록만
추가하는 안은 사용자 요청을 충족하지 않는다. 원래 의도·승인을 RESULT의 최종 성공에 맞춰 재작성하지 않는다.
고유 증거가 있는 중간 RESULT·M7 finding/최종 보고서·현행 안내·미완료 계획은 보존한다.

최종 product/design/engineering/audits/devlog 구조로의 전면 이동은 P10 이후다. 미래 PRODUCT.md·DESIGN.md는
요약·방향·상세 링크를 제공하고 상세 소유권을 중복하지 않는다. audits/to-be의 제안은 승인된 구현 기준과 구분한다.

## 영향과 한계

작업 종료 시 WORK·결정·결과·후속 연결을 갱신하고 새 세션마다 비슷한 PLAN/CHECKPOINT/HANDOFF를 만들지 않는다.
고정 Git 링크는 원문 추적 수단이며 현재 실행 지시가 아니다. unknown source와 미실행 검증은 그대로 명시한다.
M0~M9 전체 완료, 미래 기능 승인, P07 또는 DB 전환 착수로 확대하지 않는다.

## 근거

- [감사 고정본](https://github.com/goldmayo/oioi-bwg/blob/6a3c714795f511e8f673b54f13020b9138ded49d/docs/migration/implementation/DOCUMENTATION-GOVERNANCE-AUDIT.md)
- [파일별 대응과 보존 경계](../migration/implementation/COMPLETED-DESIGN-INDEX.md)
- [문서 입구·WORK·종료 규칙 PR](https://github.com/goldmayo/oioi-bwg/pull/258)
- [현재·보류 작업](../WORK.md)
