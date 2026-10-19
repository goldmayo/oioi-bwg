---
title: "P06 세션 간 작업 인계"
kind: migration-handoff
status: active
updated_at: "2026-10-20"
revision: 43
---

# P06 작업 인계

단계별 사실·검증의 소유자는 PLAN/RESULT이며
여기는 현재 작업과 다음 진입점만 남긴다. 운영 원문 식별자는 비공개 Notion 기록에 둔다.

- 계획: [P06-PLAN](P06-PLAN.md), [작업 순서](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541).
- 현재 C 진입점: **#164 HTTP 공동 배포·새 보호 백업·DNS 전 HTTP 차단/외부 검증 완료 / 사용자 DNS/cache 변경 완료·공개 HTTP 경로 확인 / 인증서·제한 HTTPS 창 별도 승인 대기**.
  #165 merge `ed19b6d` 후 두 merge 허용 설정을 원복했다. [#164](https://github.com/goldmayo/oioi-bwg/pull/164)는 승인된 고정 후보를 `64dca4c`로 squash 병합했고 정상 receipt가 발행됐다. #166은 Draft·미병합이다.
  검증 source/CI·후보 및 사용자의 Cloudflare 사전 점검 사실은 [P06-C RESULT](P06-C-RESULT.md)가 소유한다.
  이미 확인된 Cloudflare 항목을 재조사하지 않는다. 남은 서버 조건과 인증서 단계 승인 범위는 [사전 준비 §2](P06-PREPARATION.md#2-c의-제한된-cloudflare-https-검증-준비)를 따른다.
  임시 헤더의 upstream 제거·matcher 제거 후 403은 실제 로컬 Caddy에서 검증했다. 보호 백업과 HTTP 배포의 실제 결과/receipt·정확한 source와 digest는 RESULT에 기록했다. 실제 HTTPS VM/Cloudflare 실증은 아직 아니다.
  새 정상 HTTP pair와 preview, 사용자 root의 `p06_c_postdeploy_snapshot_verified`로 보호 백업·current/previous 복구 snapshot과 현재 env/config 일치·pending 부재를 확인했다. 정확한 링크 대상과 검증 범위는 RESULT를 따른다. 후속 host asset/HTTPS Origin·Caddy·인증서는 별도 승인 대상이며 일반 공개는 F다. C 전체 완료가 아니다.
  2026-10-20 Let's Encrypt 우선 경로의 DNS 전 백업/HTTP 차단 묶음을 사용자 승인 후 실행했다. root exit0·외부 HTTP403/TLS 거절·preview200·Caddy PID/세 컨테이너/env/snapshot 보존을 확인했다. 복구 백업/명령은 보존했고 실제 원복은 불필요해 실행하지 않았다. 정확한 hash·실행 결과는 RESULT, 다음 별도 승인 순서는 PREPARATION §2를 따른다. Always Use HTTPS OFF는 사용자 확인이며 재조사/변경하지 않았다. 당시 DNS/cache·인증서·HTTPS Origin은 미변경이었다. 이후 사용자가 캐시 규칙 활성화·Proxied Console A 생성을 완료했다. 공개 DNS 두 resolver·Cloudflare HTTP/임의 ACME 경로403/no-store/DYNAMIC·현재 HTTPS525와 preview/기존 pair 보존을 읽기 확인했다. 인증서 발급의 새 보호 백업/비프록시 HTTPS403/180초 관찰·HTTP403 복구 후보는 로컬 준비만 했고 VM 전달·Caddy 변경·CA 요청은 하지 않았다. 정확한 실행물/hash·명령·제외/중단 범위는 PREPARATION §2, 실제 근거·로컬 모사 한계는 RESULT를 따른다.
- 후속 보류: #143/#161/#165에서 반복된 squash Promotion 조상 연결의 브랜치 전략을 C 이후 별도 검토한다.
  현재 C의 차단 이슈로 취급하지 않고 #164 후보·파이프라인·브랜치 정책을 이번 작업에서 변경하지 않는다.
- B 종료 시 진입점: **P06-B 완료 / 첫 정상 pair 유지 / preview 원복 완료 / 다음 단계 C**.
  호스트 보호·백업/업그레이드·Console 설정과 승인된 기존 0005 적용, 첫 공동 배포와 기존 Web 복구,
  공동 rollback·실제 두 앱 IMDS 차단/host 양성 대조·두 앱 재생성·Docker/VM 재시작 지속성을 확인했다.
  사용자 root의 `verify-reboot`·`record-resources`·`finish`가 성공했고 SSH에서도 두 앱/DB healthy,
  Docker/Caddy/IMDS guard active·네 loopback health/readiness 200·preview 원본 `/`/`/healthz`/`/readyz` 200을 대조했다.
  실제 수치·원격 종료·digest·승인/예외 이력의 canonical 결과는 [B2-3 RESULT](P06-B2-3-RESULT.md#2026-10-18-b-운영-실증-완료와-최종-상태)가 소유한다.
  #158 Deploy `39042193932` attempt 2의 첫 정상 pair와 receipt를 유지한다. #159는 새 두 digest로
  의도적 smoke 실패·공동 rollback(exit 20)을 검증했으므로 새 성공 receipt는 없고 재실행하지 않는다.
  #160 baseline 수정·#161 한정 이력 연결은 승인 병합됐다. #161 직후 두 merge 방식 설정은 원본으로 복원했다.
  #142는 병합 없이 CLOSED다. B0 게시 최소 권한 재설계의 승인된 후속 보류도 유지한다.
  다음은 C의 제한된 HTTPS/cookie/신뢰 IP 경계다. 실물 MFA·CLI/키 복구 검증은 D,
  Web 관리/가입 경로 종료는 E, www 전환·레거시 종료는 F에 둔다. 운영 적용·새 PR 병합은 별도 승인이다.
  자원은 유휴 단일 관찰이며 동시 CRUD/부하 수용량을 증명하지 않는다. 공개 gate의 추가 관측은 C/D/F에서 유지한다.
  결과 작업 경로는 `.local/worktrees/p06b-completion`이다. 아래 대기·OPEN 표시는 당시 이력이다.
- 이전 호스트·DB 준비 기록: **호스트·Console 설정 준비 및 승인된 DB 0005 적용 완료 / 실제 공동 배포 전**.
  #155는 `296e463`에 병합됐고 이 head의 #142 Verify `39033668584`가 두 ARM64 새 후보까지 전체 성공했다.
  자세한 실제 결과는 [B2-3 RESULT](P06-B2-3-RESULT.md#2026-10-17-첫-운영-작업-완료와-db-사전-확인)가 소유한다.
  실행 자료는 원래 worktree의 ignored `.local/p06-b2-operation1`, `.local/p06-b2-operation2`에 있다.
  0005는 root-only 전체 백업 후 기존 migrator로 적용했다. 후속 READ ONLY 조회에서 journal 6건·원본 hash,
  admin_mfa 소유권과 앱 DML 4종 권한을 대조했다. 추가 DB 변경은 승인 범위에 포함하지 않는다. 다음은 첫 pair 배포·기존 Web 복구·공동 rollback·IMDS 실증이며 C/D/E를 끌어오지 않는다.
  임시 workflow 차단 제거를 같은 실제 준비 checkpoint에서 구현했다(main 미반영). integration 병합은 배포하지 않으며
  새 Promotion 병합·실제 배포는 별도 승인이다. #142는 검증을 완료해 병합 없이 CLOSED로 정리했다. 아래 host upgrade 대기는 당시 이력이다.
  현재 결과/활성화 변경은 #157 `feature/p06b2-live-verification`이며 #156 병합 head `73b03fb`를 반영했다.
- 문서 전용 검사 생략 #156은 Verify `39037084058` 전체 성공 후 `73b03fb`에 병합했다.
  결과는 [문서 검증 RESULT](../DOCUMENTATION-VERIFICATION-RESULT.md)가 소유한다.
- 이전 host 전환 준비 이력: **#149~#154 병합 완료 / 실제 VM은 단일 Web 유지 / host upgrade 승인안 준비**.
  env #149 `8a46e3f`, 후보 계약 #150 `ac729af`, paired host #151 `a8b66d8`, workflow 연결 #152 `5a8e31c`,
  설치 누락 수정 #153 `998f46b`, root 경로 보호 #154 `d95d368`을 GitHub에서 재확인했다.
  [B2-3 RESULT](P06-B2-3-RESULT.md)의 최신 관찰과 [PLAN의 host 전환 순서](P06-PLAN.md#2026-10-17-host-전환-준비)를 따른다.
  B1 최초 실제 후보 증거는 [B1 RESULT](P06-B1-RESULT.md), 선택적 재사용 구현은 [재사용 RESULT](P06-REUSE-RESULT.md)가 소유한다.
  B0 완료와 게시 최소 권한 재설계의 승인된 보류는 유지한다.
- 브랜치: `feature/p06-host-transition-plan`, fetch한 main `d95d368a425ca59991ac3834b421508b56447919`에서 분기했다.
- 작업 경로: `.local/worktrees/p06-host-transition-plan`. 원래 worktree·개인 env는 수정하지 않았다.
- 완료 PR: [#134](https://github.com/goldmayo/oioi-bwg/pull/134) → `0e21208`, [#135](https://github.com/goldmayo/oioi-bwg/pull/135) → `9a31a90`.
  각각 최신 base/head CI 전체 성공 후 사용자 지시로 squash 병합했다. #136은 사용자 병합을
  GitHub에서 확인했으며 merge head는 `b8aa61b`, 최신 PR Verify는 성공이다.
- B0-1 PR: [#136](https://github.com/goldmayo/oioi-bwg/pull/136). 검증 코드 `0da834d57017c403c58f52f31e2bf0f3b98392e3`, 병합 전 PR Verify `38275418704` 전체 성공을 재확인했다.
  직접 기본 검사·ops 82건·두 앱 build·격리 namespace 검증은 RESULT 참조. 실제 VM 완료 증거가 아니다.
- ENV-1은 별도 PR로 처리하고 ENV-2는 P06-A를 차단하지 않는다. 운영 APP_ENV 전환은 새 candidate 검증과 연결한다.
- B1 실제 증거: source `f31471b`의 Verify `38754229290` attempt 1 전체 성공과 두 digest artifact를 대조했다. 상세 값과 한계는 B1 RESULT가 소유한다.
- #148도 사용자 지시로 전체 CI 성공 확인 후 `18de205`에 squash 병합했다. 상세 후속 검증은 B2-1 RESULT 참조.
- 이전 host 준비 단계의 순서: 기존 SSH 계정 `oioi`로 접속한다. sudo는 사용자 터미널의 기존 인증을 사용한다.
  두 사용자 소유 디렉터리 보호·백업·명시적 asset upgrade → Console 보호 설정 → DB 준비 별도 승인 → 첫 pair 검증 순서다.
  세부 명령과 설치 실패/첫 배포 실패/중단의 복구 구분은 [운영 절차](../../../../ops/oci/README.md#9-p06-최초-host-전환)를 따른다.
  이전 #142 Verify `38944025086`은 ops fixture 전체 180초 제한에서 실패했고 후보 생성은 skipped였다.
  #155 후속 run `39033668584`의 unit/ops는 성공했다. 후보 최신 상태는 GitHub에서 대조하며 무조건 전체 재실행하지 않는다.
  OCI/Run Command 전 차단과 #142 OPEN을 유지한다. 실제 설치·DB·배포·차단 해제는 이번 준비 승인에 포함되지 않는다.
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

## 2026-10-17 선택적 릴리스 작업 — 병합 전 이력

#147/#148 MERGED, #149 OPEN(`c19d0a7`)을 재확인했다. 후보 계약은 독립 Draft #150,
paired host는 #149를 전제로 별도 concern에서 구현한다. 원래 worktree·미커밋/개인 env·MFA/DB는 보존한다.
기존 B2-2 기록은 역사적 결과로 유지하며 현재 변경/검증은 [B2-3 결과](P06-B2-3-RESULT.md)가 소유한다.
다음 연결은 실제 배포 exit 0 receipt → B1 재사용 → B2 baseline 대조다. workflow 배포 차단과 #142 OPEN은 유지한다.
의존 PR 병합·host upgrade·실제 OCI/DB/Secret 변경은 별도 승인이다.

- 선택적 후보 계약 Draft [#150](https://github.com/goldmayo/oioi-bwg/pull/150) `9c78f8f`는 전체 원격 CI 성공이다.
- paired host Draft [#151](https://github.com/goldmayo/oioi-bwg/pull/151) `68a01fb`는 #149 기반이다.
  #149 → #150/#151 → workflow 연결 순서로 승인 병합하고, 의존 PR의 최종 base는 migration_main으로 갱신한다.
- workflow 연결은 `feature/p06-selective-integration`에서 두 concern을 merge해 검증한다. 변경·검증의
  canonical 결과는 [재사용 RESULT](P06-REUSE-RESULT.md)이며 실제 OCI 배포 차단은 유지한다.

- 최종 로컬 구현 `0ec969d`: 기본 여섯 검사·ops 154건·두 앱 build·actionlint 성공.
  #151도 Verify 38928227575 전체 성공이다. 새 실제 Compose ID/StartedAt 검사는 workflow 연결 PR의
  CI 결과를 확인한다. 실제 선택적 ARM64/OCI·host upgrade 검증과 배포 활성화는 아직 보류다.

- 통합 push의 Git fixture 환경 상속 문제는 `0c4e9a0`에서 격리했다. 작업 ref/index·공통 Git 설정을
  복구하고 원래 worktree 무변경을 확인했다. 상세 원인·복구·검증은 재사용 RESULT에 기록했다.
