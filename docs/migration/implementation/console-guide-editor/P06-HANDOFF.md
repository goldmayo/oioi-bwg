---
title: "P06 세션 간 작업 인계"
kind: migration-handoff
status: active
updated_at: "2026-10-15"
revision: 14
---

# P06 작업 인계

사용자 요청으로 이 파일 하나를 갱신한다. 단계별 사실·검증의 소유자는 PLAN/RESULT이며
여기는 현재 작업과 다음 진입점만 남긴다. 운영 원문 식별자는 비공개 Notion 기록에 둔다.

- 계획: [P06-PLAN](P06-PLAN.md), [작업 순서](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541).
- 현재 단계: **B0 실제 지속성·push/pull·Secret 형식·신규 command 실증 통과 / 게시 최소 권한 조정은 승인된 보류 / 다음 B1**, [B0 PLAN](P06-B0-PLAN.md) / [B0-2 RESULT](P06-B0-2-RESULT.md).
- 브랜치: `feature/p06b0-completion-record`, fetched 최신 main `439f824ee060321130e499cb07cfdd8724d96d6c`에서 분기했다.
- 작업 경로: `.local/worktrees/p06b0-live-evidence`. 원래 worktree의 사용자 P06-PLAN·개인 env는 수정하지 않았다.
- 완료 PR: [#134](https://github.com/goldmayo/oioi-bwg/pull/134) → `0e21208`, [#135](https://github.com/goldmayo/oioi-bwg/pull/135) → `9a31a90`.
  각각 최신 base/head CI 전체 성공 후 사용자 지시로 squash 병합했다. #136은 사용자 병합을
  GitHub에서 확인했으며 merge head는 `b8aa61b`, 최신 PR Verify는 성공이다.
- B0-1 PR: [#136](https://github.com/goldmayo/oioi-bwg/pull/136). 검증 코드 `0da834d57017c403c58f52f31e2bf0f3b98392e3`, 병합 전 PR Verify `38275418704` 전체 성공을 재확인했다.
  직접 기본 검사·ops 82건·두 앱 build·격리 namespace 검증은 RESULT 참조. 실제 VM 완료 증거가 아니다.
- ENV-1은 별도 PR로 처리하고 ENV-2는 P06-A를 차단하지 않는다. 운영 APP_ENV 전환은 새 candidate 검증과 연결한다.
- 다음 단계: B1의 두 ARM64 candidate 계약·게시 digest smoke·artifact/summary/Slack을 준비한다.
  기존 준비와 B0 검증은 반복하지 않는다. B1+B2 병합·host upgrade 전 실제 Promotion은 금지한다.
  #142는 검증용으로 계속 열어 두며 병합하지 않는다. 운영 APP_ENV 전환은 새 후보 검증과 연결한다.
- 이전 진행 기록(아래 실패·대기는 당시 상태이며 최종 통과 증거는 RESULT가 소유한다):
  검증용 [#142](https://github.com/goldmayo/oioi-bwg/pull/142)의 작은 두 repo push 재검증 →
  VM Instance Principal pull·두 CURRENT Secret 형식 검사 → 같은 CI 계정 신규 command exit 0.
  사용자는 #140 병합·GitHub VM/compartment variable 등록·위 실제 probe 전체를 승인했다.
  #140은 전체 CI 성공 후 `ab02551`로 병합했고 두 variable 등록·값 대조도 끝났다.
  게시 정책을 검토한 두 repo READ/UPDATE로 교체했다는 사용자 확인을 받았다. 실제 권한 성공은 아직 별개다.
  #142는 이전 squash 승격 이력으로 충돌해 처음에는 CI가 시작되지 않았다. develop tree가 이전 승격 원본과
  같고 그 원본이 main 조상임을 대조했다. 파일 변경 0개인 #143은 전체 CI 성공·사용자 별도 승인 후
  일반 merge `7734be3`로 이력을 연결했다. 저장소와 main ruleset의 일반 merge 허용은 즉시 원복·대조했다.
  source와 가상 merge tree는 같으며 #142 Verify `38587311262` attempt 2의 일반 verify는 성공했다.
  attempt 1은 Console smoke의 즉시 Email count가 0이라 실패했다. 로컬 30회에서 4회 재현하고
  기다리면 모두 1로 복구됨을 확인했다. Playwright 대기 assertion 보완 후 전체 smoke 20회가 성공했다.
  실제 게시 job은 로그인 뒤 `b0_ci_probe_failed`로 실패해 아직 두 repo 게시 성공 증거가 없다.
  코드 보완 ref `6f0b3bfd1b69924de5045fad19467513e26dff75`는 고정 단계·제한된 실패 분류만 남긴다.
  #144는 전체 CI 성공 후 `106bbf6`에 병합했다. 이 source의 #142 Verify `38591227653`에서
  일반 verify·작은 이미지 build·Docker login은 성공했지만 첫 Web push가 `permission_denied`다.
  사용자는 이전 tag가 양쪽에 없고 Console repo가 비어 있음을 확인했다. 저장된 정책·GitHub
  설정은 검토안과 일치하고 지정 Audit 조회에서는 단서를 얻지 못했다. 사용자는 실제 push
  오류 원문을 보이게 하고 직접 확인할 것을 요청했다. 상세 진단과 한계는 RESULT가 소유한다.
  #142는 병합하지 않으며 새로운 실패를 OCI provider HTTP 500 같은 과거 장애로 분류하지 않는다.
  full ARM64 앱 후보는 이 실증 전까지 보류한다. 상세 source/범위/한계는 [B0-2 RESULT](P06-B0-2-RESULT.md) 참조.
  #141은 `801917c`에 병합했고 실제 Plan 소스 SHA도 일치했다. 사용자가 Logging의 기존 time_type
  반영을 포함한 Apply를 승인·실행해 `1 added, 2 changed, 0 destroyed` 성공 로그를 공유했다.
  Apply Job 자체의 소스/저장 Plan 연결 metadata는 아직 미대조다. CI probe 성공을 대신하지 않는다.
  #140의 최초 CI는 job 배치 오류로 workflow 검증에서 실패했다. `b0-publish`를 jobs 아래로 수정하고
  actionlint 정적 검사 후 최신 head `6566ba3`의 실제 Verify `38583267243`도 전체 성공했다.
  기존 SSH key selector만 사용하고 sudo 비밀번호는 수집하지 않는다. 실제 2C는 사용자 실행의
  `p06_b0_reboot_phase_passed`·exit 0이며 상세 지속성 증거는 [B0-1 RESULT](P06-B0-1-RESULT.md) 참조.
- 2026-10-14 사용자 `시작하자` 지시로 1차 파일 전달·백업·guard 설치·현재 Web 검증을 승인받았다.
  [보완 PR #137](https://github.com/goldmayo/oioi-bwg/pull/137)의 직접 검사·격리 설치 검증은 성공했다.
  소스 `280710e`의 다섯 파일 archive와 1차 실행 스크립트를 VM 사용자 staging에 전달하고 hash를 대조했다.
  사용자가 기존 sudo 인증으로 1차 스크립트를 실행해 `p06_b0_first_phase_passed`·exit 0을 공유했다.
  실제 Web v1/v2 여섯 경로 차단/counter·host 양성 대조·DNS/outbound/health와 재시작 없음이 확인됐다.
  이후 agent 읽기에서도 guard unit·root 보호 파일·Docker 의존·Web health를 확인했다.
  재시작 지속성은 이후 실제 2A·2B·2C에서 완료했다. 당시 repo pull/Vault read는 미검증이었다.
  최초 Stack Plan의 빈 입력은 #141에서 보완했고 이후 승인된 Plan/Apply는 성공했다.
  당시 새 Secret 읽기·신규 CI command도 미실행이었다. 아래 최종 증거와 구분한다. 전체 ARM64 후보는 아직 미실행이다.
- B0 최종 증거: source `439f824`의 Verify `38597712962` attempt 2 게시 job `115978635176`에서
  두 repo push가 성공했다. 사용자가 기존 광역 게시 정책으로 복원한 뒤 실패한 job만 재실행했으며
  Admin E2E는 다시 실행하지 않았다. 최소 권한 교체는 완료로 처리하지 않고 후속 보류한다.
  전달한 세 파일을 root 보호 경로로 복사·해시 대조한 사용자 실행에서 `b0_host_probe_passed`,
  Auth/MFA version 각 1·exit 0을 확인했다. SSH 읽기에서도 Web/PostgreSQL healthy·임시 probe 없음이다.
  이후 같은 source의 신규 명령 workflow `38601706992`가 `SUCCEEDED`·exit 0을 확인했다.
  artifact와 별도 OCI 읽기에서 새 ID/대상/시각/실행 결과를 대조했고 원문 ID는 비공개 Notion에 둔다.
  상세 digest·파일 hash·실행 순서·한계는 RESULT 참조. 실제 앱 배포나 DB migration 완료를 뜻하지 않는다.
- 운영 gate: Web IMDS 차단 → 새 Console 권한 → Plan/Apply·push/pull·secret 읽기·신규 명령 → ARM64 B1.
- B1+B2 병합·host upgrade 전 Promotion 금지. DB 준비는 B2 첫 배포 전, 동기화 범위는 B2/D 전에 판단한다.
- D의 MFA/version·계정 상태를 F 동기화로 덮어쓰지 않는다. DNS 전 인증서 발급·검증 방식은 C에서 확정한다.

다음 세션은 AGENTS·active Runtime/배포 문서·현재 PLAN/RESULT를 읽고 실제 branch/status·PR을
확인한다. 개인 env·DB 볼륨·MFA 키를 덮어쓰지 않으며 OCI/운영 DB/공개 전환을 암묵 실행하지 않는다.
