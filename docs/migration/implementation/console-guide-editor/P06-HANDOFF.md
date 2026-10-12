---
title: "P06 세션 간 작업 인계"
kind: migration-handoff
status: active
updated_at: "2026-10-13"
revision: 4
---

# P06 작업 인계

사용자 요청으로 이 파일 하나를 갱신한다. 단계별 사실·검증의 소유자는 PLAN/RESULT이며
여기는 현재 작업과 다음 진입점만 남긴다. 운영 원문 식별자는 비공개 Notion 기록에 둔다.

- 계획: [P06-PLAN](P06-PLAN.md), [작업 순서](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541).
- 현재 단계: **B0-1 코드 구현·로컬 검증 완료, 리뷰/실제 VM 적용 대기**, [B0 PLAN](P06-B0-PLAN.md) / [B0-1 RESULT](P06-B0-1-RESULT.md).
- 브랜치: `feature/p06b0-metadata-guard`, 기준 merge head `9a31a90e565847cf04b704403339b31765bbca79`.
- 작업 경로: `.local/worktrees/p06b0-metadata-guard`. 원래 worktree의 사용자 P06-PLAN 수정은 별개로 보존했다.
- 완료 PR: [#134](https://github.com/goldmayo/oioi-bwg/pull/134) → `0e21208`, [#135](https://github.com/goldmayo/oioi-bwg/pull/135) → `9a31a90`.
  각각 최신 base/head CI 전체 성공 후 사용자 지시로 squash 병합했다.
- B0-1 검증 코드: `0da834d57017c403c58f52f31e2bf0f3b98392e3`. 새 PR은 위 head branch로 조회하며 CI는 실제 최신 head에서 확인한다.
  직접 기본 검사·ops 82건·두 앱 build·격리 namespace 검증은 RESULT 참조. 실제 VM 완료 증거가 아니다.
- ENV-1은 별도 PR로 처리하고 ENV-2는 P06-A를 차단하지 않는다. 운영 APP_ENV 전환은 새 candidate 검증과 연결한다.
- 다음 단계: B0-1 리뷰 후 준비한 host diff·복구/중단 검토 → 승인된 실제 Web 차단·재시작 proof.
  SSH 읽기 및 사용자 sudo firewall 요약은 RESULT에 기록했다. 기존 키를 인증 selector로만 사용했고 원문은 수집하지 않았다.
  기존 sudo 인증이 필요한 설치·probe는 사용자 터미널 실행으로 준비한다. 기존 credential 대응은 #133에서 확인 완료이며 재조사하지 않는다.
- B0 코드는 사용자 지시로 시작했지만 운영 적용·Secret 읽기·IAM/Stack 변경·전체 ARM64 빌드는 미승인·미실행이다.
- B0 추가 검토: 기존 광범위 게시 정책을 두 repo READ/UPDATE로 교체하고, 기존 Stack의
  `migration_develop` 소스와 검토할 B0 코드의 차이를 해소한다. 같은 CI의 작은 probe가 기존 전체
  ARM64 candidate·배포를 시작하지 않도록 gate를 먼저 구현한다. 상세 변경·복구안은 B0 PLAN 참조.
- 운영 gate: Web IMDS 차단 → 새 Console 권한 → Plan/Apply·push/pull·secret 읽기·신규 명령 → ARM64 B1.
- B1+B2 병합·host upgrade 전 Promotion 금지. DB 준비는 B2 첫 배포 전, 동기화 범위는 B2/D 전에 판단한다.
- D의 MFA/version·계정 상태를 F 동기화로 덮어쓰지 않는다. DNS 전 인증서 발급·검증 방식은 C에서 확정한다.

다음 세션은 AGENTS·active Runtime/배포 문서·현재 PLAN/RESULT를 읽고 실제 branch/status·PR을
확인한다. 개인 env·DB 볼륨·MFA 키를 덮어쓰지 않으며 OCI/운영 DB/공개 전환을 암묵 실행하지 않는다.
