---
title: "P06 세션 간 작업 인계"
kind: migration-handoff
status: active
updated_at: "2026-10-12"
revision: 1
---

# P06 작업 인계

사용자 요청으로 이 파일 하나를 갱신한다. 단계별 사실·검증의 소유자는 PLAN/RESULT이며
여기는 현재 작업과 다음 진입점만 남긴다. 운영 원문 식별자는 비공개 Notion 기록에 둔다.

- 계획: [P06-PLAN](P06-PLAN.md), [작업 순서](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541).
- 현재 단계: **P06-A 구현·검증 완료, 리뷰/병합 대기**, [PLAN](P06-A-PLAN.md) / [RESULT](P06-A-RESULT.md).
- 브랜치: `feature/p06a-two-app-images`, 기준 merge head `699b41a15a84af5adc2c05eda70e1ac0007ea1cd`.
- 작업 경로: `.local/worktrees/p06a-two-app-images`. 원래 worktree의 사용자 P06-PLAN 수정은 별개로 보존했다.
- PR: [#134](https://github.com/goldmayo/oioi-bwg/pull/134), 코드 `434a685e2ad15e924d471491495f68fa5ed88905`.
- 검증: [Verify 38263561625](https://github.com/goldmayo/oioi-bwg/actions/runs/38263561625) 전체 성공. 두 실제 이미지와 PG/인증 회귀의 상세 결과는 RESULT 참조.
- ENV-1은 별도 PR로 처리하고 ENV-2는 P06-A를 차단하지 않는다. 운영 APP_ENV 전환은 새 candidate 검증과 연결한다.
- 다음 단계: A 리뷰·병합 후 **B0**. 기존 credential 대응은 #133에서 확인 완료이며 재조사하지 않는다.
- 운영 gate: Web IMDS 차단 → 새 Console 권한 → Plan/Apply·push/pull·secret 읽기·신규 명령 → ARM64 B1.
- B1+B2 병합·host upgrade 전 Promotion 금지. DB 준비는 B2 첫 배포 전, 동기화 범위는 B2/D 전에 판단한다.
- D의 MFA/version·계정 상태를 F 동기화로 덮어쓰지 않는다. DNS 전 인증서 발급·검증 방식은 C에서 확정한다.

다음 세션은 AGENTS·active Runtime/배포 문서·현재 PLAN/RESULT를 읽고 실제 branch/status·PR을
확인한다. 개인 env·DB 볼륨·MFA 키를 덮어쓰지 않으며 OCI/운영 DB/공개 전환을 암묵 실행하지 않는다.
