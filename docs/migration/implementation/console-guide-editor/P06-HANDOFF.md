---
title: "P06 세션 간 작업 인계"
kind: migration-handoff
status: active
updated_at: "2026-10-13"
revision: 2
---

# P06 작업 인계

사용자 요청으로 이 파일 하나를 갱신한다. 단계별 사실·검증의 소유자는 PLAN/RESULT이며
여기는 현재 작업과 다음 진입점만 남긴다. 운영 원문 식별자는 비공개 Notion 기록에 둔다.

- 계획: [P06-PLAN](P06-PLAN.md), [작업 순서](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541).
- 현재 단계: **P06-A 구현·검증 완료, 리뷰/병합 대기**, [PLAN](P06-A-PLAN.md) / [RESULT](P06-A-RESULT.md).
- 브랜치: `feature/p06a-two-app-images`, 기준 merge head `699b41a15a84af5adc2c05eda70e1ac0007ea1cd`.
- 작업 경로: `.local/worktrees/p06a-two-app-images`. 원래 worktree의 사용자 P06-PLAN 수정은 별개로 보존했다.
- PR: [#134](https://github.com/goldmayo/oioi-bwg/pull/134), 코드 `434a685e2ad15e924d471491495f68fa5ed88905`.
  2026-10-13 재조회 당시 head `1c3bff1c3f72cf273de646fabd79b8dcec7baa30`, Open·리뷰 기록 없음·mergeable/CLEAN.
- 검증: 위 head의 [Verify 38265204560](https://github.com/goldmayo/oioi-bwg/actions/runs/38265204560)
  attempt 2 전체 성공. provider 다운로드 HTTP 500은 실패 job 재실행으로 해소됐다.
  이번 인계 갱신 commit의 CI는 PR 최신 head에서 별도로 확인한다. 실제 runtime 상세는 RESULT 참조.
- ENV-1은 별도 PR로 처리하고 ENV-2는 P06-A를 차단하지 않는다. 운영 APP_ENV 전환은 새 candidate 검증과 연결한다.
- 다음 단계: A 리뷰·병합 후 **B0**. 기존 credential 대응은 #133에서 확인 완료이며 재조사하지 않는다.
- B0 사전 계획: [#135](https://github.com/goldmayo/oioi-bwg/pull/135)의 `P06-B0-PLAN.md`.
  fetch한 최신 integration `699b41a`에서 별도 `feature/p06b0-iam-plan`으로 준비했다.
  A 미병합이므로 B0 코드 구현·운영 적용은 미실행이다. 계획 PR은 실행 승인이 아니다.
- B0 추가 검토: 기존 광범위 게시 정책을 두 repo READ/UPDATE로 교체하고, 기존 Stack의
  `migration_develop` 소스와 검토할 B0 코드의 차이를 해소한다. 같은 CI의 작은 probe가 기존 전체
  ARM64 candidate·배포를 시작하지 않도록 gate를 먼저 구현한다. 상세 변경·복구안은 B0 PLAN 참조.
- 운영 gate: Web IMDS 차단 → 새 Console 권한 → Plan/Apply·push/pull·secret 읽기·신규 명령 → ARM64 B1.
- B1+B2 병합·host upgrade 전 Promotion 금지. DB 준비는 B2 첫 배포 전, 동기화 범위는 B2/D 전에 판단한다.
- D의 MFA/version·계정 상태를 F 동기화로 덮어쓰지 않는다. DNS 전 인증서 발급·검증 방식은 C에서 확정한다.

다음 세션은 AGENTS·active Runtime/배포 문서·현재 PLAN/RESULT를 읽고 실제 branch/status·PR을
확인한다. 개인 env·DB 볼륨·MFA 키를 덮어쓰지 않으며 OCI/운영 DB/공개 전환을 암묵 실행하지 않는다.
