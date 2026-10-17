---
title: "P06-B2-3 paired 배포·복구 구현 결과"
kind: migration-result
status: active
source_commit: c19d0a777f41e3ef4bcab571044e64a89714d4a4
verified_at: "2026-10-18"
---

# P06-B2-3 결과

[P06 계획](P06-PLAN.md) §5의 독립 container 교체와 공동 rollback을 #149의 env helper 위에 구현했다.
최신 main `18de205`에서 분기하고 #149 head `c19d0a7`을 fast-forward로 반영했다. #149 브랜치는 변경하지 않았다.
후보 source/build source 분리는 사용자 요청을 적용하며, 상세 계약은 active 배포 runbook §19/21이 소유한다.
후보 계약 Draft #150과 host 변경은 분리하고 마지막 workflow 연결 PR에서 결합한다.

root 보호 파일·배포 lock 아래 두 env와 cross-app Secret/DB 일치·두 immutable digest/revision·Compose를
사전 검증한다. 현재 pair ID·실행 image/config hash·env drift 및 재사용 출처 불일치는 변경 전에 거절한다.
안정된 env 경로로 `up -d --wait web console`을 실행하며 공통 release metadata를 서비스 설정에 넣지 않는다.
두 앱 smoke 후 current-pair symlink를 확정한다. 실패 시 직전 snapshot의 env/Compose/설정/pair를 복구한다.
exit 0/20/21을 유지하며 pending 기록은 중단/복구 실패 후 후속 배포를 차단한다.

installer의 명시적 upgrade는 기존 Compose/script/config backup을 보존하고 기존 설정을 덮어쓰지 않는다.
첫 전환은 기존 app을 정지하고 성공 후만 제거한다. 실패 시 새 서비스를 정지하고 기존 app/digest/env를 복구한다.

기본 여섯 검사와 `pnpm test:ops` 116건, `pnpm build` 두 앱이 성공했다. harness 18건·unit 459건,
unit/build 캐시 0이다. ops 한 테스트 안에서 Python CLI fixture 15개 시나리오를 실행했다.
앱별 변경/무변경/유효 env 변경·baseline/출처/실행 drift 거절·Vault/pull/config 실패 무변경·lock·
한쪽 실패 복구·smoke 및 복구 실패 exit 21/pending 유지·최초 app 전환 성공과 복구를 확인했다.
`bash -n` 세 script와 Python AST 구문 검사가 성공했다. 구현 commit/PR·원격 CI는 PR 본문에서 추적한다. 실제 WSL Docker CLI가 실행 불가하므로 fake Docker/OCI의 ID/시작 시각
보존은 실제 Compose 증거가 아니다. 실제 OCI/VM 배포·Terraform·Secret/DB·개인 env 변경은 없다.
workflow 배포 차단과 #142 OPEN을 유지한다. 실제 host upgrade/metadata 차단·중단 후 수동 복구 proof는 보류다.

## 2026-10-17 host installer 누락 보완

#149~#152 병합 후 main `5a8e31c32e636d2179c32b6aef9ac183777309e5`에서 후속 수정했다.
위 installer 설명과 달리 설치 목록에 `paired-release.py`가 빠져 있어 신규 설치 후 preflight와
배포 진입점의 필수 파일 검사가 실패할 수 있었다. `300f73f97d096f738f64850d4c75bd691d986de7`은
기존 목록에 helper를 추가하며, 설치 경로·0755 권한·보호 설정 보존·명시적 upgrade 계약은 유지한다.

회귀 테스트는 수정 전 helper 누락(ENOENT)으로 실패했고 수정 후 성공했다. 임시 경로에서 실제
installer의 `install`/`flock`을 실행해 여섯 스크립트의 내용·0755 권한, 재설치 시 stale helper 교체,
기존 설정 세 파일의 값·0600 권한 보존을 확인했다. root 검사는 fixture에서 우회하고
sudoers 검증·systemd 호출은 대체했다. 실제 root 소유권·legacy host upgrade의 실증은 아니다.

기본 여섯 검사(harness 18건·unit 459건)와 두 앱 `pnpm build`(캐시 0), `bash -n`,
`git diff --check`가 성공했다. ops 최초 실행은 앱 검사/build와 동시 실행 중 기존 Python fixture의
10초 timeout 두 건으로 실패했다. 코드·timeout 변경 없이 단독 재실행한 `pnpm test:ops`는 155건 모두 성공했다.
commit hook ESLint/Prettier·commitlint도 성공했다. 후속 PR과 원격 CI 결과는 PR 본문에서 추적한다.

실제 VM 설치/배포·OCI/Vault·Terraform·Secret/DB 변경은 실행하지 않았다.
OCI 인증 전 배포 차단과 #142 OPEN을 유지하며, 실제 첫 paired 전환·공동 복구·두 앱 IMDS 검증은 남아 있다.

## 2026-10-17 root 실행 경로 보호 보완

[B0-1 결과](P06-B0-1-RESULT.md)에 기록된 사용자 소유 runtime/scripts 경로와 달리 기존 installer는
상위 경로를 검사하지 않았다. 최신 main `5a8e31c`를 대조하고 #153 head `3c4bf31` 위의 별도 PR로
보완했다. #153의 파일 누락 concern은 유지하며 #153 병합 뒤 main을 반영해 후속 PR을 검증한다.

구현 `1eba2ac7224d999cade49f9a7e2e1f54deb96a02`는 installer의 첫 mkdir/lock 전 runtime·scripts·deploy·
config의 전체 ancestor를 검사한다. 사용자 소유·쓰기 가능 경로·symlink, 기존 설치 대상/lock의
symlink·hardlink·비보호 파일은 거절한다. preflight는 Docker/OCI 전 디렉터리를 검사하고 필수 파일의
symlink/hardlink도 거절한다. 새 디렉터리만 root 소유로 만들며 비보호 기존 경로는 자동 수정하지 않는다.
현재 소유권 확인과 수동 검토 절차는 [운영 문서 §1](../../../../ops/oci/README.md#1-install-and-configure)이 소유한다.

기본 여섯 검사(harness 18건·unit 459건), ops 194건, 두 앱 build(캐시 0), actionlint,
변경한 두 script의 `bash -n`, Python fixture AST, `git diff --check`가 성공했다.
새 경로 검사에서는 UID/임시 ancestor만 모사하고 실제 mode·symlink·hardlink를 사용했다.
설치 fixture는 실제 복사·lock·권한과 명시적 `--upgrade-paired`의 기존 세 파일 백업·설정/env 보존을 확인했다.
이 fixture의 root 소유권·sudoers/systemd 검증은 모사다. CI에는 별도 임시 root 경로에서 실제 소유권과
쓰기 권한·symlink 거절 및 upgrade 백업의 root/0600을 확인하는 검사를 추가했다. 원격 결과는 PR 본문에서 추적한다.

실제 VM의 현재 경로 소유권은 재조회하지 않았고 운영 소유권·설치·배포·Secret/DB를 변경하지 않았다.
#153 Verify `38938988484`의 최종 전체 성공을 확인했다. #153/#142는 병합하지 않으며 배포 차단도 유지한다.

## 2026-10-17 병합 후 VM 읽기 조회

이번 사실 확인 기준은 main `d95d368a425ca59991ac3834b421508b56447919`다. #149~#154는 모두 MERGED다.
위의 Draft/병합 대기는 당시 기록이며 현재 진입점은 [HANDOFF](P06-HANDOFF.md)다.
#154 Verify [38943292146](https://github.com/goldmayo/oioi-bwg/actions/runs/38943292146)은 전체 성공이며
실제 CI Compose 보존/복구 step과 root 소유권·upgrade fixture step도 성공했다. 실제 OCI VM 배포 증거와 구분한다.

반면 최신 main을 검증한 #142 Verify [38944025086](https://github.com/goldmayo/oioi-bwg/actions/runs/38944025086)은
unit job의 `pnpm test:unit:run` 성공 후 `pnpm test:ops`에서 실패했다. ops 193/194 통과이며
`deploy-release.test.ts`가 Python fixture의 14개 완료 표시 후 전체 180,000ms 제한에 도달해 status=null이다.
개별 배포 assertion 실패나 OCI 권한 오류로 확정하지 않는다. 후보 job은 skipped이며 최신 후보 성공을 주장하지 않는다.
원격 재실행·코드 수정은 하지 않았다. 실패 로그는 Actions job API로 읽었다(gh log 출력은 빈 결과였다).

SSH 선택 오류는 사용자가 지정한 기존 `oioi` 계정으로 바로잡았다. 12:25 UTC(21:25 KST) 읽기 조회에서:

- 기존 project의 `app`과 별도 `postgres`는 healthy, 시작 시각은 각각 2026-10-14 13:25:05 UTC다.
  후속 비교용 ID/정확한 시각은 로컬 비공개 조사 출력에 보존했다. root app.env는 0600, 새 web.env/console.env와 두 helper는 없다.
- `/srv/oioibawige`와 `scripts`는 UID/GID 1002:1002·0750이고, `/srv`는 root/0755,
  deploy·`/etc/oioibawige`는 root/0750이다. 현재 installer는 이 두 사용자 소유 디렉터리에서 설치를 거절한다.
- 사용자가 별도 sudo metadata 조회를 실행한 결과 기존 설정 세 파일·current/previous/lock은 root/0600·일반 파일·link 1이다.
  Console 설정 두 파일, current-pair/previous-pair/pending-pair/legacy-host는 없다. 일반 SSH의 unreadable을 absent로 오인하지 않았다.
- Compose 5.5.0, 기존 Compose는 app만 있다. Web은 host loopback 3000, PostgreSQL은 loopback 5432이며 3001 listener는 없다.
  Docker/guard/Caddy active, NTP 동기화 yes다. Web은 bridge·privileged=false·추가 cap 없음·mount 0이다.
- Caddy 선택 조회는 preview와 `127.0.0.1:3000` upstream을 확인했고 Console 참조·maintenance/503 설정은 없다.
  메모리 available 10,749MiB, 디스크 available 79,084MiB다. DB 연결 수/권한/journal은 조회하지 않았다.

조회는 stat/lstat·선택 Docker inspect·서비스/포트/자원·공개 Caddy 구조 확인뿐이다. guard active를 실제 IMDS 차단 재실증으로 보지 않는다.
설치·chown·설정/Secret 읽기·DB 접속·Caddy reload·container 재시작·Promotion 병합은 실행하지 않았다.
다음 적용안은 [PLAN](P06-PLAN.md#2026-10-17-host-전환-준비)과 [운영 절차](../../../../ops/oci/README.md#9-p06-최초-host-전환)에 기록한다.

## 2026-10-17 첫 운영 작업 완료와 DB 사전 확인

사용자가 B를 두 운영 작업으로 마무리하도록 지시했다. HTTPS·Secure cookie·실제 MFA 운영·Web 관리 제거는 C/D/E에 유지한다.
첫 운영 실행의 `p06_operation1_passed`, Web/DB 무변경·oioi 접근 유지·Console 설정 준비/등록 닫힘 출력을 받았다.
설치 원본은 `d95d368`이며 main `296e463`의 host asset과 같다. 복구본은 VM의 root-only
`/var/lib/oioi-p06-operation1/before`, 설치 로그는 같은 보호 경로의 operation.log에 보존했다.
두 부모 디렉터리는 `root:oioi 0750`으로 보호하고 installer의 root 그룹 덮어쓰기 후에도 oioi의 진입을 복원했다.
하위 DB/앱/백업 파일의 소유권은 재귀 변경하지 않았다. 후속 SSH에서 두 경로 소유권/권한, 설치한
Compose·deploy/paired/env/preflight 네 script의 원본 hash 일치, 기존 app/DB ID·healthy와 guard/Docker/Caddy active를 대조했다.

#142의 Verify `39033668584` attempt 1은 main `296e463`에서 전체 성공했다. 미만료 candidate artifact의
두 repository/digest와 source/run/attempt를 대조했으며 baseline=null·두 origin=built·buildSourceSha=현재 source다.
이는 최초 두 앱 새 빌드 조건을 충족한다. #142는 OPEN이며 병합하지 않았다.

DB는 명시적 READ ONLY transaction으로만 조회했다. PostgreSQL 17.11, max_connections 50·관찰 연결 7,
journal의 0000~0004 hash/timestamp가 repo와 모두 일치한다. `admin_mfa`와 0005 journal은 없다.
기존 migrator는 schema DDL 가능·database CREATE 불가, app은 DML 가능·schema/database CREATE 불가이며
migrator의 새 public table에 app DML을 주는 default ACL도 확인했다. 기존 migrator 역할로 실행한
읽기 전용 journal/identity 사전 조건 검사는 성공했다. 기존 0005만 적용하는 보호 SQL·백업/검증 실행안을 준비했으나
DB 변경은 별도 승인 대기이며 아직 적용하지 않았다. 신규 계획 PR은 만들지 않는다.

## 2026-10-17 승인된 0005 적용 완료

사용자가 기존 `0005_p05a_admin_mfa.sql` 적용을 명시적으로 승인했다. operator의 sudo 실행은
`p06_db_prepare_passed`, `existing_0005_applied_as_migrator`,
`journal_and_runtime_permissions_verified`, `existing_web_and_database_not_restarted`로 완료됐다.
root-only `/var/lib/oioi-p06-operation2-db`에 전체 custom-format DB 백업과 catalog·작업 로그를 보존했다.
SQL은 기존 journal 5건/대상 identity/테이블 부재를 확인한 transaction 안에서 기존 migrator 역할로
원본 0005와 journal 1건만 적용했다. Secret·키·비밀번호·기존 application row는 변경하지 않았다.

후속 SSH의 READ ONLY 조회에서 journal 6건과 최신 timestamp `1791598021368`,
원본 0005 hash `043a1ef48effae34b499e04e23b6d3e59797ba5578eba49272ca273209cf6cac`가 일치했다.
`admin_mfa` owner는 `oioi_migrator`, `oioi_app`의 SELECT/INSERT/UPDATE/DELETE는 모두 true다.
앞 절의 미적용/승인 대기는 실행 전 상태다. 호스트·Console 설정·DB 준비는 완료했으며
실제 첫 paired 배포·기존 Web 복구·공동 rollback·두 앱 IMDS 및 재시작 지속성 실증은 남아 있다.
main의 배포 workflow 차단과 검증용 #142 OPEN은 유지한다. 새 계획 PR은 만들지 않았다.

## 2026-10-17 준비 완료 후 paired Promotion 활성화 변경

같은 checkpoint에서 host/Console 설정/DB 준비의 실제 결과를 근거로 workflow의 임시 무조건 실패 step과
그 전용 Slack 출력 연결을 제거했다. main 반영 전이며 실제 배포는 실행하지 않았다. 새 설정 flag나
SSH 정상 배포 우회는 만들지 않았다. source/merge SHA·tree·성공한 candidate artifact·두 repository/digest·
baseline 검증, OCI Run Command의 세 인자와 exit 0/20/21, 성공한 실제 배포만 receipt를 기록하는 계약을 유지한다.

기존 차단 회귀 검사는 workflow의 실제 shell step을 실행해 두 digest와 candidate가 adapter에 전달되고
0/20/21이 보존되는 검사로 교체했다. CI Compose의 예상 실패도 `up && healthy`로 판정하도록
#156의 보완을 포함했다. 동일 보완의 실제 CI `39037084058`에서 Compose 보존/복구 step이 성공했다. candidate 검증이 OCI 인증 전이라는 순서도 확인한다.
최초 테스트는 pipe stdout을 `/dev/stdout` 파일로 열 수 없어 실패했고, 출력 파일 대상을 `/dev/null`로
수정한 뒤 promotion 검사 42건이 성공했다. actionlint 1.7.12(`-shellcheck=`)와 diff 공백 검사도 성공했다.

이 PR의 integration merge는 배포하지 않는다. 실제 실행 전에 최신 source로 두 앱을 새로 빌드한
후보를 검증하고 유지보수·실패/중단 복구 절차를 확인한 뒤 별도 Promotion 승인을 받는다. #142는 병합하지 않는다.
B의 남은 범위는 첫 pair·기존 Web 복구·공동 rollback·두 앱 IMDS/재시작 지속성 실증이며 C/D/E는 유지한다.

기본 여섯 검사(type-check·harness 18건·lint·lint:fsd·unit 459건·format)와 ops 196건이 성공했다.
harness와 lint는 순차 실행했고 unit 캐시는 0이다. 두 앱 `pnpm build`도 캐시 0으로 성공했다.
원격 검증과 push hook 결과는 PR 본문에서 추적한다.

## 2026-10-17 검증 PR 정리와 통합

사용자의 진행 지시로 #142를 병합 없이 CLOSED로 정리했다. 검증 증거는 기존 RESULT/Actions에 보존하며
실제 배포는 새 Promotion에서 승인한다. #156은 Verify `39037084058` 전체 성공 후 `73b03fb`에 squash 병합했다.
#157에 해당 main을 merge하며 HANDOFF의 양쪽 결과를 보존하고 active 문서 version을 갱신했다.
이는 기존 검증 코드와 활성화 변경의 결합이며 추가 운영 변경·기존 Web/DB 재시작을 실행하지 않았다.

## 2026-10-17 통합 완료와 실제 승격 후보 검증

#142는 사용자 진행 지시에 따라 병합 없이 CLOSED다. #156은 `73b03fb`, #157은 최종 Verify
[39038838955](https://github.com/goldmayo/oioi-bwg/actions/runs/39038838955) 전체 성공 후
`3a69948f1e459e3c02233e588653601c1795d328`에 squash 병합했다. 최종 통합 push hook의
repo type/lint·harness 18건·ops 208건·format은 모두 성공했다. 앞 절의 main 미반영/OPEN은 당시 이력이다.

실제 배포용 [Promotion #158](https://github.com/goldmayo/oioi-bwg/pull/158)을 생성했다.
source는 위 main이며 source/virtual merge tree `7094c566ce5ca246401a9c431341663ab84bfdbc`가 일치한다.
Verify [39039512429 attempt 1](https://github.com/goldmayo/oioi-bwg/actions/runs/39039512429)은
일반 verify·ARM64 후보·필수 promotion까지 전체 성공했다. artifact `12103941074`를 내려받아
PR/source/tree/run/attempt·고정된 두 repository와 schema를 실제 대조했다. baseline=null이고
두 origin=built·buildSourceSha=현재 source다. 첫 배포에서 두 앱을 새로 빌드하는 조건을 충족한다.

- Web: `sha256:8b05ce50204a6990ecc4a378162aa9567c6faa8712046c18d982ee54e24618f9`
- Console: `sha256:54877980d6648ef38b1a6ae4d5f643d781beba0ef1687a7217b02a0773f36260`
- candidate JSON SHA-256: `d8395a6a28f52cff5de956576c8785aee810d50b1b3197c237fb922ba7a0d957`

기존 ignored `.local/p06-b2-operation2`에 후보와 유지보수·설정·수동 복구·metadata/재시작 검증용
operator 자료를 준비했다. 최종 Python 구문/CLI와 shell 구문 검사가 성공했고 fixture 13개가 성공했다.
fixture의 root ownership·Docker·Caddy·systemd는 모사이며 실제 운영 실증과 구분한다.
운영 승인안은 `operation2-review.txt`, 실행 script는 `pair-operation.py`이고 SHA-256은
`2e78b87b0fe93cd9fa924a94a20c4558e2d4faed845852dc9d68159638f2593b`다.

두 파일의 VM 사용자 staging 전달과 hash 대조까지 진행했다. 실제 root 작업·maintenance·앱 교체·
Docker/VM 재시작과 #158 병합은 승인 대기다. B의 첫 pair·기존 Web 복구·공동 rollback·두 앱 IMDS
및 재시작 지속성 실증은 아직 완료되지 않았다. C/D/E 범위와 Auth/MFA 키·DB 보존 조건을 유지한다.

## 운영 작업 2 전체 승인과 sudo 실행 대기

사용자가 검토안과 고정 source/candidate/script를 대상으로 **공동 배포·복구 실증 전체 승인**을 제출했다.
#158과 같은 source/digest·첫 정상 receipt를 사용하는 후속 Promotion 병합, preview 유지보수/원복,
기존 Web·pair 복구 및 두 앱 IMDS/재생성/Docker·VM 재시작 실증이 범위다. 추가 DB 변경·키 재생성·C/D/E는 제외다.
원격 #158의 head와 전체 CI 성공·현재 main 동일성을 재확인했고, VM 사용자 staging의 candidate/script hash와
원본 Caddy hash·새 root 경로 부재를 다시 대조했다. SSH의 `sudo -n true`는 비밀번호 필요로 실패했다.
승인 대기가 아니라 사용자 터미널의 기존 sudo 인증을 통한 최초 root launch 실행 대기다.
아직 maintenance/root 작업이나 Promotion 병합을 실행하지 않았으며 성공 marker 확인 뒤 승인 범위대로 진행한다.

## 2026-10-17 유지보수 준비 완료와 첫 Promotion 병합

사용자가 hash 검증된 root launch를 실행해 `p06_pair_phase_passed: prepare-first-failure`를 확인했다.
보호 backup과 의도적 Console smoke 실패 조건을 준비했고, SSH에서 기존 Web·DB의 ID/StartedAt 유지·healthy와
origin HTTPS 503을 대조했다. 승인 범위대로 #158을 `070dcc94a95f3773ef22dd952a83a16e0ce94d6a`에 squash 병합했다.
실제 [Deploy 39042193932](https://github.com/goldmayo/oioi-bwg/actions/runs/39042193932)는 실행 중이다.
source/tree/candidate 검증은 성공했고 예상 결과는 Console smoke 실패 후 기존 Web 복구 exit 20이다.
실제 복구와 정상 pair·receipt는 아직 확인 전이다. 앞 절의 sudo/병합 대기는 실행 전 이력이다.

첫 실행은 OCI lifecycle FAILED·remote exit 20, `candidate failed; rollback succeeded`로 종료했다.
Actions의 failure 표시는 의도한 복구 실증 결과이며 정상 배포 완료를 뜻하지 않는다. SSH에서 새 web/console의 정지와
기존 app의 healthy 복구, PostgreSQL의 기존 ID/StartedAt 유지를 확인했다. 성공 receipt artifact는 생성되지 않았다.
보호 state·snapshot과 복구 Web IMDS의 root 검증 및 원래 검사 설정 복원이 다음 단계다.

사용자가 `p06_pair_phase_passed: verify-legacy`와 `restore-settings` 성공을 확인했다.
보호 state·복구 Web IMDS와 원래 검사 설정 원복을 검증한 뒤, `gh run rerun 39042193932 --failed`로
실패한 Deploy job만 attempt 2로 재실행했다. 후보 build/Verify는 반복하지 않았고 source·두 digest를 유지한다.
정상 pair와 성공 receipt는 이번 재실행의 실제 결과로 확인한다.

## 2026-10-17 첫 정상 공동 배포와 receipt 검증

같은 Deploy `39042193932` attempt 2는 OCI lifecycle SUCCEEDED·remote exit 0 및 Actions 전체 성공으로 완료됐다.
실제 Web/Console 두 container는 healthy이고 기존 app은 제거됐다. 각 loopback port의 `/healthz`·`/readyz`는
모두 200이다. PostgreSQL은 최초 ID와 StartedAt `2026-10-14T13:25:05.482972749Z`를 유지했다.

immutable artifact `12105120483`(`paired-deployment-39042193932-2`, 미만료)에서 candidate/receipt를 내려받았다.
candidate는 처음 검증한 JSON과 동일하고 release ID는 `37bd0ae9184be182791fcdcab8c08270f08f1c77e331e0f404719bec7bef1874`다.
현재 `validateBaseline` 함수를 실제 GitHub API에 연결해 두 고정 repository, 성공한 deploy run/attempt/job,
PR/merge/source tree, 최초 Verify/필수 check·artifact 및 병합 전 생성 시각을 검증했다.
receipt의 candidateArtifactId는 `12103941074`, mergedSha는 `070dcc94a95f3773ef22dd952a83a16e0ce94d6a`다.
원문 OCI command ID는 비공개 증거에만 보존했다. 새 build나 전체 Verify는 재실행하지 않았다.

다음은 사용자 sudo의 `verify-pair`로 보호 snapshot/env/config와 두 앱 IMDS를 검증하는 단계다.
후속 동일 source/digest Promotion의 공동 rollback, container 재생성·Docker/VM 재시작·preview 원복 실증은 남아 있으며 B 완료로 선언하지 않는다.

## 2026-10-18 정상 pair root 검증과 공동 rollback 후보

사용자 sudo의 `p06_pair_phase_passed: verify-pair`가 성공했다. 첫 정상 pair의 보호 snapshot·두 env/config·
실행 image/health와 두 앱 IMDS 차단·host 양성 대조를 확인했다. 원래 운영 작업 2의 승인 범위에서
같은 source/digest·첫 정상 receipt를 기준으로 [Promotion #159](https://github.com/goldmayo/oioi-bwg/pull/159)를 생성했다.
head는 `3a69948`, base는 #158 squash `070dcc9`이며 두 실제 branch 및 virtual merge tree는
`7094c566ce5ca246401a9c431341663ab84bfdbc`로 일치한다. 새로운 소스 변경은 없다.
Verify `39043458634`의 새 후보에서 baseline `12105120483`/`39042193932`/attempt 2와 두 reused digest를 검증한다.
후보 성공과 root `prepare-pair-failure` 성공을 확인한 뒤에만 승인된 후속 Promotion을 병합한다.

후속 병합의 필수 문제도 읽기 조회로 확인했다. `migration_develop` 전용 active ruleset은
verify/promotion 필수 check와 strict latest-base 요구를 적용한다. #158 squash가 현재 source의 조상이
아니므로 #159는 충돌 없는 동일 tree지만 `mergeable_state=behind`다. source SHA를 바꾸면 고정된 승인 범위를 벗어난다.
동일 source를 유지할 최소 예외는 #159 병합 동안 strict boolean 1개만 false로 바꾸고 병합 API 직후 원복하는 것이다.
원본/임시 ruleset JSON과 검토안을 ignored 로컬 자료에 준비했다. 다른 checks·보호 규칙을 유지하며,
후보 검증과 별도 명시적 승인 전에는 원격 보호 설정을 바꾸지 않는다. 운영 설정/추가 DB 변경은 실행하지 않았다.

## 2026-10-18 반복 승격의 mutable PR 연결 오류 수정

#159 Verify `39043458634`는 전체 성공했다. 하지만 artifact `12105207454`를 내려받은 결과 baseline=null,
두 origin=built이며 두 digest도 승인한 첫 pair와 다르다. 이 후보는 병합하지 않는다. 실제 운영 pair·설정은 유지했다.

실제 API에서 기존 성공 Deploy `39042193932`의 `pull_requests`가 #159 생성 뒤 `[159]`로 바뀌었음을 확인했다.
같은 첫 receipt가 생성 직후에는 validateBaseline을 통과했고 새 PR 생성 뒤에는 `Deployment PR mismatch`로 거절됐다.
공개 build 설정 hash와 source는 변하지 않았고 실제 Turbo dry-run의 affected task는 비어 있어 두 앱 재사용으로 선택됐다.
따라서 baseline 누락은 source/build 설정 변경 때문이 아니라 변경 가능한 GitHub run association 검사 때문이다.

수정은 candidate의 고정 PR과 receipt의 merge/run/attempt를 기준으로 기존 API/tree/CI/artifact 검증을 유지한다.
mutable `run.pull_requests`를 권한 근거로 쓰지 않고 deploy run의 `head_sha=sourceSha`를 명시적으로 검사한다.
새 PR로 재연결되거나 association이 비어도 원래 candidate PR을 조회하는 회귀와 다른 run source 거절을 추가했다.
정확한 파일 필터로 실행한 수정 전 검사에서 재연결/다른 source 두 사례가 실패했고 수정 후 28건 모두 성공했다.
수정 함수에 실제 GitHub API와 첫 배포 receipt를 전달한 검증도 성공했다. 운영/보호 설정을 바꾸지 않았다.

검증 도중 최초 ops 파일 필터 전달이 전체 suite를 실행해 jq 없는 PATH의 adapter 오류를 냈으므로 중단했다.
또 lint/FSD가 harness 종료 전에 겹쳐 fixture ENOENT가 발생해 lint를 중단했다. harness는 18건 성공했고
후속 lint/FSD와 전체 ops는 harness 종료 및 jq PATH 설정 후 순차 재검증한다. 이 시도의 실패를 코드 통과로 보고하지 않는다.

수정 후 기본 여섯 검사(type-check·harness 18건·lint·lint:fsd·unit 459건·format)와
jq PATH를 지정한 전체 ops 211건이 성공했다. 후속 lint/FSD는 harness 종료 후 실행했다.
두 앱 `pnpm build`도 캐시 0으로 성공했다. commit/push hook 및 원격 검증은 PR 본문에서 추적한다.
#159는 실제 후보와 승인 범위 불일치를 본문에 명시하고 Draft로 전환했다. 정상 pair와 유지보수 503을 유지한다.
