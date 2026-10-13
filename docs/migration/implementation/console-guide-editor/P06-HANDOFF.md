---
title: "P06 세션 간 작업 인계"
kind: migration-handoff
status: active
updated_at: "2026-10-14"
revision: 7
---

# P06 작업 인계

사용자 요청으로 이 파일 하나를 갱신한다. 단계별 사실·검증의 소유자는 PLAN/RESULT이며
여기는 현재 작업과 다음 진입점만 남긴다. 운영 원문 식별자는 비공개 Notion 기록에 둔다.

- 계획: [P06-PLAN](P06-PLAN.md), [작업 순서](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541).
- 현재 단계: **B0-1 실제 VM의 현재 Web 차단 1차 적용 완료, 재시작 지속성 검증 대기**, [B0 PLAN](P06-B0-PLAN.md) / [B0-1 RESULT](P06-B0-1-RESULT.md).
- 브랜치: `feature/p06b0-guard-install-hardening`, 기준 merge head `b8aa61be2594f6e95c5ceaf9de979033e742c08b`.
- 작업 경로: `.local/worktrees/p06b0-guard-install-hardening`. 원래 worktree의 사용자 P06-PLAN 수정은 별개로 보존했다.
- 완료 PR: [#134](https://github.com/goldmayo/oioi-bwg/pull/134) → `0e21208`, [#135](https://github.com/goldmayo/oioi-bwg/pull/135) → `9a31a90`.
  각각 최신 base/head CI 전체 성공 후 사용자 지시로 squash 병합했다. #136은 사용자 병합을
  GitHub에서 확인했으며 merge head는 `b8aa61b`, 최신 PR Verify는 성공이다.
- B0-1 PR: [#136](https://github.com/goldmayo/oioi-bwg/pull/136). 검증 코드 `0da834d57017c403c58f52f31e2bf0f3b98392e3`, 병합 전 PR Verify `38275418704` 전체 성공을 재확인했다.
  직접 기본 검사·ops 82건·두 앱 build·격리 namespace 검증은 RESULT 참조. 실제 VM 완료 증거가 아니다.
- ENV-1은 별도 PR로 처리하고 ENV-2는 P06-A를 차단하지 않는다. 운영 APP_ENV 전환은 새 candidate 검증과 연결한다.
- 다음 단계: 보완 PR #137 리뷰/병합 → 별도 승인된 작은 probe·Web/Docker/VM 재시작·이전 Web 복구 proof.
  SSH 읽기 및 사용자 sudo firewall 요약은 RESULT에 기록했다. 기존 키를 인증 selector로만 사용했고 원문은 수집하지 않았다.
  기존 sudo 인증이 필요한 설치·probe는 사용자 터미널 실행으로 준비한다. 기존 credential 대응은 #133에서 확인 완료이며 재조사하지 않는다.
- 2026-10-14 사용자 `시작하자` 지시로 1차 파일 전달·백업·guard 설치·현재 Web 검증을 승인받았다.
  [보완 PR #137](https://github.com/goldmayo/oioi-bwg/pull/137)의 직접 검사·격리 설치 검증은 성공했다.
  소스 `280710e`의 다섯 파일 archive와 1차 실행 스크립트를 VM 사용자 staging에 전달하고 hash를 대조했다.
  사용자가 기존 sudo 인증으로 1차 스크립트를 실행해 `p06_b0_first_phase_passed`·exit 0을 공유했다.
  실제 Web v1/v2 여섯 경로 차단/counter·host 양성 대조·DNS/outbound/health와 재시작 없음이 확인됐다.
  이후 agent 읽기에서도 guard unit·root 보호 파일·Docker 의존·Web health를 확인했다.
  실제 repo pull/Vault read·재시작 지속성은 아직 미검증이다. PR 병합·CI는 실제 최신 상태로 확인한다.
  재시작·Secret 읽기·IAM/Stack 변경·전체 ARM64 빌드는 미승인·미실행이다.
- B0 추가 검토: 기존 광범위 게시 정책을 두 repo READ/UPDATE로 교체하고, 기존 Stack의
  `migration_develop` 소스와 검토할 B0 코드의 차이를 해소한다. 같은 CI의 작은 probe가 기존 전체
  ARM64 candidate·배포를 시작하지 않도록 gate를 먼저 구현한다. 상세 변경·복구안은 B0 PLAN 참조.
- 운영 gate: Web IMDS 차단 → 새 Console 권한 → Plan/Apply·push/pull·secret 읽기·신규 명령 → ARM64 B1.
- B1+B2 병합·host upgrade 전 Promotion 금지. DB 준비는 B2 첫 배포 전, 동기화 범위는 B2/D 전에 판단한다.
- D의 MFA/version·계정 상태를 F 동기화로 덮어쓰지 않는다. DNS 전 인증서 발급·검증 방식은 C에서 확정한다.

다음 세션은 AGENTS·active Runtime/배포 문서·현재 PLAN/RESULT를 읽고 실제 branch/status·PR을
확인한다. 개인 env·DB 볼륨·MFA 키를 덮어쓰지 않으며 OCI/운영 DB/공개 전환을 암묵 실행하지 않는다.
