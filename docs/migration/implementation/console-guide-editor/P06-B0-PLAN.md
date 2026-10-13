---
title: "P06-B0 Metadata 차단과 OCI 권한 실증 계획"
kind: migration-plan
status: active
authority: plan
source_commit: 699b41a15a84af5adc2c05eda70e1ac0007ea1cd
created_at: "2026-10-13"
updated_at: "2026-10-14"
revision: 4
---

# P06-B0 계획

2026-10-13 승인 기록: 사용자 지시로 [#135](https://github.com/goldmayo/oioi-bwg/pull/135)를
`9a31a90`에 병합하고 B0 코드 작업을 시작했다. 아래 최초 관찰과 계획은 보존한다.
VM 설치·재시작·IAM/Stack 변경·실제 권한 probe는 별도 승인 대상이다.

**기존 Web의 Instance Metadata 접근을 차단한 뒤 Console 권한을 추가하고 실제 주체로 검증한다.**
이 문서는 변경·검증안이며 PR 병합, VM 변경, Stack 소스 변경, IAM Apply 또는 probe 실행 승인이 아니다.
P06-A 병합 전에는 계획 준비만 진행한다. 구현은 A 병합 후 fetch한 최신 `migration_main`에서 분기한다.

2026-10-14 적용 준비 보완: 사용자가 #136을 병합했고 1차 VM 파일 전달·백업·설치·현재 Web
검증을 승인했다. 읽기 조회에서 기존 `/srv/oioibawige`와 scripts가 일반 사용자 소유여서
root 실행 guard의 교체 방지를 위해 `/usr/local/lib/oioi-metadata-guard`를 사용한다.
installer는 상위 경로와 기존 파일의 소유권·쓰기 권한·symlink/hardlink를 검사한다.
기존 배포 디렉터리 권한은 바꾸지 않는다. 이 보완 코드의 검증·리뷰를 먼저 완료한다.
운영 재시작·IAM/Stack 변경·새 Secret 읽기는 이번 1차 승인에 포함되지 않는다.

## 1. 기준과 이번 세션의 관찰

- 2026-10-13 GitHub 재조회: [#133](https://github.com/goldmayo/oioi-bwg/pull/133)은 병합됐고
  fetch한 `origin/migration_main`은 위 source_commit이다. local `migration_main`은
  `5135f6eb1a53782b86a3120b1d8b0134410bf4d4`여서 분기 기준으로 사용하지 않았다.
- [#134](https://github.com/goldmayo/oioi-bwg/pull/134)는 Open, head는
  `1c3bff1c3f72cf273de646fabd79b8dcec7baa30`, 리뷰 기록 없음, mergeable/CLEAN이다.
  [Verify 38265204560](https://github.com/goldmayo/oioi-bwg/actions/runs/38265204560)은
  해당 head의 attempt 2 completed/success다. attempt 1 provider 다운로드 HTTP 500은
  실패 job 재실행으로 해소됐다는 이전 기록을 유지한다. Promotion jobs는 skipped다.
- A worktree의 PLAN/RESULT/HANDOFF를 읽었다. RESULT의 실제 코드 검증 기준은 `434a685`이며
  그 뒤 기록 commit `1c3bff1`의 최신 CI와 구분한다. 이번 세션에서 A runtime 검사를 반복하지 않았다.
- 원래 worktree의 사용자 `P06-PLAN.md` 수정은 별개로 보존한다. 개인 env·키·DB 볼륨을 읽거나 변경하지 않는다.
- [비공개 VM 기록](https://app.notion.com/p/3f5395eb18c28036b8f4e5314ba80541)의 준비 현황,
  작업 순서, 상세 Stack/IAM·Secret 증적을 읽었다. 상단 완료 기록을 과거 상세 기록의 미확인 문구와 구분한다.
  credential 사용자 대응, Secret 생성·복구 사본, Cloudflare 준비, 기존 Stack 조사는 반복하지 않는다.
- OCI/VM/운영 DB에 연결하지 않았다. 실제 firewall backend·규칙·재시작 지속성과 새 Console 권한은 미검증이다.

상위 기준: [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md#41-console의-단계적-전환),
[Runtime §14](../../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md#14-secret),
[배포 §19/21](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md).
단계 순서·완료 조건은 [P06 §4.1~4.2](P06-PLAN.md#41-p06-b0-arm64-빌드-전-iam-준비실증),
환경 보안 연결은 [ENV 계획](../ENVIRONMENT-CONFIGURATION-PLAN.md)과
[ENV 증적 §4~5](../ENVIRONMENT-CONFIGURATION-EVIDENCE.md#4-사용자-제공-oci-auditrun-command-증적)를 따른다.

## 2. 코드 변경을 나눌 단위

| 단위 | 변경안                                                                                                                                 | 완료 경계                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| B0-1 | `ops/oci`의 명시적 Metadata 차단 설치·검사, 부팅 순서, body를 버리는 probe, ops 테스트와 적용/복구 안내                                | 코드 검증·PR과 별개로 승인된 실제 VM Web/작은 probe 차단 증거 확보. 새 Secret 권한은 추가하지 않음          |
| B0-2 | `infra/oci`의 private Console repository·정확한 VM 읽기 정책, 기존 게시 정책 교체안, 같은 CI credential의 작은 image/Run Command probe | 동일 Stack의 검토한 Plan/Apply, 두 repo push/pull, 두 CURRENT Secret 형식 검사, 새 command exit 0 모두 성공 |

각 단위는 하나의 concern으로 PR을 나누고 20파일/400줄 목표를 적용한다. 새로운 release framework,
VM·DB·staging 환경, key rotation, 전체 ARM64 앱 빌드, 두 앱 host 전환은 이 범위에 넣지 않는다.
구현 시 active Runtime/Deployment의 Metadata 경계와 probe 실행 계약을 같은 PR에서 명시한다.
이번 계획은 기존 active 문서의 실행 계약을 바꾸지 않는다.

## 3. B0-1: 새 Secret 권한 이전의 차단

### 호스트에서 먼저 확인할 좁은 범위

기존 SSH로 동일 VM에서 Docker firewall backend, nftables/iptables frontend, 현재 forward 규칙,
Docker systemd unit/drop-in·live-restore, Web의 bridge/network mode만 확인한다. env 전체나
`docker inspect` 전체는 출력하지 않고 network mode·privileged·capability·mount 경로만 선택 조회한다.
Docker socket·host network·privileged·OCI credential/호스트 보호 디렉터리 mount가 있으면 중단한다.
이미 확인한 VM 자원·IAM 사용자·Stack 소속을 다시 조사하지 않는다.

### 제안할 차단 수단과 적용 조건

전용 nftables table `inet oioi_metadata_guard`의 forward hook에 IPv4 목적지
`169.254.169.254` drop을 두는 안을 우선 검토한다. Docker 소유 table을 수정하지 않고
전체 ruleset flush를 하지 않는다. hook priority는 실제 host 규칙과 대조해 확정한다.
이 안은 모든 forwarded 경로의 해당 목적지를 막는다. host 자체의 Instance Principal 요청은 유지하며
다른 forwarded workload의 IMDS 의존성이 발견되면 범위를 조정한 변경안을 다시 검토한다.
[Docker의 별도 nftables table 설명](https://docs.docker.com/engine/network/firewall-nftables/).

backend를 바꾸거나 Docker iptables 관리를 끄지 않는다. nft 지원·기존 firewall 관리자의 호환성을
확인할 수 없으면 적용하지 않는다. `DOCKER-USER`만 추가하고 Docker 시작 후 규칙이 생기는
구성은 자동 시작 container의 차단 공백을 해결하지 못하므로 완료 조건으로 사용하지 않는다.

규칙을 Docker 시작 전에 설치하고, Docker unit에 guard의 필수 의존·시작 전 규칙 검사를 두어
guard 실패 시 새 Docker 시작을 거절하는 안을 구현한다. 실행 중 guard 재적용은 전용 table만
원자적으로 갱신하고 실패 시 기존 차단을 유지한다. Docker 재시작·VM reboot·live-restore 경로를
검증하며 기존 firewall reload가 table을 지우는 구성도 확인한다. 기존 guard가 없어지는 stop 동작을
일반 서비스 중지에 넣지 않는다. 정확한 unit/drop-in·installer diff는 구현 PR에서 리뷰한다.

### 실제 검증과 중단 기준

1. 변경 전 root 소유 규칙·unit 복구 사본을 보존하고 SSH 복구 경로 및 maintenance 범위를 승인받는다.
2. host IMDSv2 요청과 기존 Instance Principal 인증을 양성 대조로 확인한다. body는 버린다.
3. 차단 적용 후 실행 중인 기존 Web 안에서 IMDSv2 metadata·identity 경로를 직접 요청한다.
   `Authorization: Bearer Oracle`, proxy 우회, 제한된 timeout을 사용한다. 활성 v1 경로도 검사한다.
4. HTTP 응답을 받은 401/404/5xx는 차단 성공이 아니다. 네트워크 차단과 규칙 counter 증가,
   동일 시점 host 성공을 함께 확인한다. timeout만으로 성공 판정하지 않는다.
5. 동일 DB bridge의 비밀 없는 작은 probe도 검사한다. DNS·일반 outbound·Web health/readiness가
   유지돼야 한다. 실제 앱 재생성 없이도 probe 재생성으로 우선 지속성을 확인한다.
6. 승인된 maintenance에서 기존 Web 재생성, Docker 재시작, VM 재시작, 이전 Web 복구 후
   차단·host 양성 대조·health를 다시 확인한다. 해당 중단 승인이 없으면 지속성은 보류로 기록한다.

요청 규칙은 [OCI IMDS](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/gettingmetadata.htm)를 따른다.
identity certificate/private key 응답도 body를 저장하거나 출력하지 않는다. Web 차단 proof 전에는
새 Console Secret 권한을 적용하지 않는다. 실제 Console의 최종 검증은 B2에 남긴다.

### 2026-10-14 지속성 검증의 다음 승인 단위

#137은 사용자 지시로 `5db6962572ccea5cf51f34926a71608270458796`에 병합했다.
최신 PR head `855bf2b`의 Verify `38424190112` attempt 1은 전체 성공이다.
이 ref에서 지속성 검증 준비를 분기하며 1차 적용 성공은 [B0-1 RESULT](P06-B0-1-RESULT.md)가 소유한다.

다음 승인은 **2A: 작은 probe 두 차례 생성/삭제와 Docker daemon 한 차례 재시작**으로 한정한다.
현재 Web image·env·컨테이너, PostgreSQL 컨테이너·volume, Caddy 설정은 변경하지 않는다.
재시작 중 연결이 잠시 끊길 수 있으며 live-restore 유지 여부를 실제로 측정한다.
[Docker live restore](https://docs.docker.com/engine/daemon/live-restore/)는 daemon 설정을 유지한
재시작에서 동작하는 기능이므로 backend·network·version 변경을 함께 수행하지 않는다.

| 순서   | 실행할 구체적 변경/검사                                                                        | 성공 및 중단 기준                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 준비   | guard check/probe, Web/PostgreSQL ID·시작 시각, Docker PID·live-restore, Caddy·Web health 확인 | 현재 값과 조건이 다르면 임시 container 생성 전 중단                                                                                                            |
| probe  | 기존 Web의 **local image ID**로 Node idle process를 같은 DB bridge에 두 번 생성·probe·삭제     | runtime env·mount·port를 전달하지 않고 non-root·read-only·cap-drop ALL·no-new-privileges·restart=no 적용. 각 ID가 다르고 여섯 경로·counter·host 대조 성공 필요 |
| daemon | `systemctl restart docker.service` 한 차례, 호출은 60초로 제한                                 | Docker PID 변경/active·live-restore 유지, Web/PostgreSQL ID·시작 시각 동일. guard check·Web probe·health 모두 재검증                                           |
| 종료   | 임시 probe 삭제 확인, 고정 성공/실패 출력만 반환                                               | 실패 시 이후 Web/VM 변경과 IAM/Stack 작업을 중단. 타 container·전체 ruleset·기본 nftables service를 수정하지 않음                                              |

실행 파일은 새 worktree의 ignored `.local/probe-docker-verification.sh`로 준비한다.
승인 후 해시가 같은 파일만 별도 사용자 staging에 전달하고 본인 SSH 터미널에서 실행한다.

```bash
# 2A 실행 승인과 파일 전달·해시 확인 후
sudo bash probe-docker-verification.sh --apply
printf 'exit=%s\n' "$?"
```

최종 `p06_b0_probe_docker_passed`·exit 0과 고정 probe/guard 출력을 수집한다.
생성 실패를 포함해 이 실행이 붙인 고유 label의 임시 probe만 cleanup한다.
Docker/SSH/health 또는 guard가 실패하면 원인을 읽기 조회하고 필요한 복구만 검토한다.
차단 유실 시 기존 보호 경로의 `metadata-guard.py apply`로 **전용 table만** 복구하고 check/probe한다.
Docker startup 검사가 거절되면 차단을 복구한 뒤 Docker 재시작을 한 번 재시도한다.
원인 미해결이면 중단 상태로 기록하고 deny 의존을 제거하거나 전체 ruleset을 replay하지 않는다.

2A 뒤의 **2B: 현재 Web 재생성·유지 전 Web release 복구**, **2C: VM reboot**는 별도 승인 단위다.
2B는 현재 pinned digest·Compose·env를 root/0700 작업 경로에 0600으로 보존하고, 렌더링 결과와
실행 중 Web의 설정을 값 미출력 방식으로 대조한 뒤 해당 app만 검증한다. env 값을 채팅·Git·
artifact로 보내거나 Vault에서 새로 읽지 않는다. 복구 기준은 maintenance 시작 전 Web release다.
같은 digest/env의 명시적 재생성 검증에서만 app 대상 `--no-deps --no-build --pull never
--force-recreate --wait`를 검토하며 일반 배포 기본 명령은 바꾸지 않는다. [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/).
2C는 Web·PostgreSQL·Caddy/Agent가 재시작되는 VM 전체 중단 범위와 SSH 재접속·복구 경로를
승인받는다. boot ID 변경, guard→Docker 순서, Web/DB 자동 기동·health·차단/host 대조를 확인한다.
작은 probe나 daemon 성공만으로 2B/2C 완료를 기록하지 않는다. 모든 지속성 proof 전 새 Console grant는 보류한다.

## 4. B0-2: 저장소와 최소 IAM 변경안

| 대상                         | 구체적인 변경안                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/oci/ocir.tf`          | 기존 `application` resource 주소·Web 이름 유지. `console` private repository `oioi-bwg-console`만 추가                                                                                    |
| `variables.tf` / tfvars 예시 | Console repository 이름 및 Console Secret OCID 두 개의 별도 입력. 중복·잘못된 종류·개수 거절. 기존 runtime Secret 목록 유지, 실제 값/OCID는 예시에 기록하지 않음                          |
| `iam.tf`                     | exact VM dynamic group·domain 유지. Console repo `read repos` 하나, 두 Secret의 exact `target.secret.id` statement만 추가. 기존 Web/4 Secret·metrics/log-content·Run Command 세 정책 유지 |
| `outputs.tf`                 | Console repository 경로 출력 추가. 실제 운영 식별자를 공개 RESULT에 복사하지 않음                                                                                                         |
| 기존 게시 정책               | Stack 밖 `oioi-github-ci-ocir-push`의 광범위 statement를 아래 두 statement로 **교체**. B0에서는 import·중복 policy 생성·새 그룹·사용자 변경을 하지 않음                                   |

기존 정책은 비공개 관찰 기준으로 compartment 전체 `manage repos`다. 제한 statement를 덧붙여도
기존 허용이 남는다. 다음 형식으로 기존 정책 내용을 직접 교체하는 승인안을 준비하고 변경 직전
기존 statement와 차이가 있으면 재검토한다. 다른 유효 허용이 확인되면 최소 권한 완료라고 기록하지 않는다.

```text
Allow group Default/oioi-github-ci-pushers to manage repos in compartment id <registry-compartment> where all {target.repo.name='oioi-bwg', any {request.permission='REPOSITORY_READ', request.permission='REPOSITORY_UPDATE'}}
Allow group Default/oioi-github-ci-pushers to manage repos in compartment id <registry-compartment> where all {target.repo.name='oioi-bwg-console', any {request.permission='REPOSITORY_READ', request.permission='REPOSITORY_UPDATE'}}
```

repository 생성은 기존 Administrators의 Resource Manager Apply가 담당한다. 게시 계정에 CREATE·
MANAGE·DELETE를 요구하지 않는다. [OCI repository 정책](https://docs.oracle.com/en-us/iaas/Content/Registry/Concepts/registrypolicyrepoaccess.htm).
Run Command 계정에는 Vault·DB·repository 권한을 추가하지 않는다. IAM 전파 대기와 실패 검사
재실행을 구분하고 권한 실패를 넓은 grant로 우회하지 않는다.

### 기존 Stack에 검토한 소스를 전달하는 방법

현재 Stack은 `migration_develop`을 참조하며 최근 통합 코드와 다르다. B0를 싣기 위해 먼저
Promotion을 시작하면 기존 ARM64 candidate가 실행될 수 있어 순서가 뒤집힌다.

제안은 B0-2 코드 병합 후 **같은 Stack의 Git branch 입력만 승인된 `migration_main`으로 변경**하고
Plan Job의 실제 commit-id가 리뷰한 integration SHA와 같은지 확인하는 것이다. Stack ID·저장소·
source provider·`infra/oci`·region·세 compartment·기존 VM/Vault/Key는 유지한다.
소스 변경도 운영 승인에 포함한다. 다른 SHA·path·예상 밖 변경이면 Apply하지 않는다.
Apply는 검토한 Plan Job에 연결하며 Plan 성공만으로 권한 준비 완료라고 하지 않는다.

허용할 IaC 변경은 Console repo 1개 생성과 기존 runtime policy의 Console repo/Secret 읽기 추가다.
새 input 설정·output은 별도로 대조한다. Web repo·VM·Vault/Key·Secret·backup·Logging·Monitoring·
Notification·그룹의 destroy/replace 또는 무관한 update가 나오면 중단한다. 게시 정책 교체는 별도
수동 변경이며 Terraform 성공의 증거와 합치지 않는다. 로컬 `terraform apply`는 사용하지 않는다.
원래 Stack ref 복원은 B1+B2 이후 `migration_develop`의 IaC tree가 적용 소스와 같아진 뒤 검토한다.
그 전에 옛 ref로 Apply하여 Console 권한을 없애는 자동 복구를 하지 않는다.

## 5. 같은 CI credential로 작은 probe만 실행

원본 credential을 WSL로 복사하거나 새 token/key를 발급하지 않는다. 기존 `oci-development-image`
Environment의 같은 게시·API credential을 쓰고 runtime Secret을 GitHub로 보내지 않는다.
일반 feature Verify에는 OCI credential을 요구하지 않는다.

B0-2에서 기존 Verify의 **동일 저장소 `migration_main → migration_develop`** 경계 안에 작은
권한 probe 경로를 추가하는 안을 구현한다. B0 중 기존 전체 ARM64 `promotion-candidate`는 실행하지
않으며 `candidate.json`을 만들지 않는다. required `promotion`은 성공시키지 않아 probe용 Promotion
PR을 병합·배포할 수 없게 한다. B0 코드 병합, Web 차단, 승인된 IAM 적용 후 이 PR의 probe만 실행한다.
Environment 허용 ref를 넓히지 않고 불특정 feature/fork PR의 secret 접근을 허용하지 않는다.
B1에서 실제 B0 증거를 대조한 뒤 전체 candidate 경로로 전환하며 B1+B2·host upgrade 전 배포는 금지한다.

probe 순서는 다음과 같다. 실패 시 이후 검사를 실행하지 않고 해당 검사부터 원인을 해결한다.

1. 비밀 없는 작은 ARM64 호환 probe image를 한 번 준비해 Web/Console 각각의 고유 `p06-b0-<run>-<attempt>`
   tag에 같은 CI 게시 credential로 push한다. 전체 앱 Dockerfile을 build하지 않는다. 각 반환 digest를 기록한다.
2. host의 실제 Instance Principal credential helper로 두 `repository@digest`를 pull한다. architecture와
   예상 probe 내용을 확인하고 운영 앱을 변경하지 않는다. probe의 실행 환경과 실제 Console 검증을 구분한다.
3. host에서 Console Secret 두 개의 CURRENT bundle을 읽고 OCI 전송 Base64를 한 번 decode한다.
   Auth secret 최소 32자, MFA key canonical Base64/32 bytes를 검사한다. root 소유 `0700` 임시 경로와
   `0600` 파일·trap cleanup을 사용하고 성공/실패 모두 원문·변환 값·hash·CLI raw 응답을 출력하지 않는다.
4. 같은 CI API credential로 대상 Instance 조회 후 새 secret-free command를 생성한다.
   명령은 기존 sudo 허용 `run-command-probe.sh`만 호출한다. 새 command ID·대상 VM·실행 UTC와
   execution 결과의 `SUCCEEDED`/exit 0을 대조한다. 기존 marker·command list 성공은 대체 증거가 아니다.
5. 출력은 고정 성공/실패 코드와 안전한 metadata만 허용한다. OCI 오류의 양쪽 stream·agent message에
   원문이 남지 않게 구현한다. raw output 전체를 GitHub artifact·로그에 저장하지 않는다.

Credential의 job/step 제한과 `0600` signing key cleanup도 이 probe에 적용한다. 일반 배포 출력 경로의
추가 보정은 ENV-3/B2에 남긴다. probe image 삭제 권한을 CI에 추가하지 않고 임의 registry prune을 하지 않는다.

## 6. 승인·복구·완료 기록

운영 승인은 두 번의 구체적 변경 단위로 준비한다. **지금은 둘 다 미승인·미실행이다.**

- B0-1 코드 검증 후: 실제 host 규칙·unit diff, 변경 전 복구 사본, 적용/probe 명령, Web 중단 여부와
  재시작 일정까지 준비한 뒤 승인받는다. SSH/Caddy/DB/health 실패 시 새 IAM 작업을 중단한다.
- B0-2 코드 검증 후: 위 차단 proof, 실제 Plan의 리소스 diff·SHA, 게시 정책의 전후 statement,
  Stack ref 변경, 같은 CI probe 실행과 로그 보호·정리 절차를 준비한 뒤 승인받는다.

새 Console grant 적용 후 firewall을 제거하는 복구는 하지 않는다. 차단을 유지할 수 없으면 앱 접근을
제한·중지하고 먼저 Console Secret grant를 회수·검증하는 변경안을 승인받는다. 기존 Web grant는 보존한다.
새 repo에는 destroy를 복구 기본값으로 넣지 않는다. 권한 probe 실패만으로 repo/Secret·키를 재생성하지 않는다.
게시 정책 복구는 검토한 이전 statement를 사용하되 최소 권한 확대의 이유·승인 범위를 남긴다.

구현 PR은 AGENTS 기본 여섯 검사와 ops 테스트, Terraform fmt/validate, runtime/build 영향이 있으면
두 앱 build를 수행한다. mock 검증은 입력 거절·rule 설치 실패·body 미출력·cleanup·timeout을 확인하며
실제 VM/IAM 통과를 대신하지 않는다. 이번 문서 PR은 format·링크·diff만 직접 검사하고 hook 결과는 구분한다.

실행 후 `P06-B0-RESULT.md`가 코드 ref·Plan/Apply SHA·차단/지속성·두 digest·Secret version·새 command의
실제 결과를 소유한다. 정확한 OCID와 비공개 실행 증거는 기존 Notion VM 기록에 보관한다.
HANDOFF는 기존 한 파일의 다음 진입점만 갱신한다. 실행되지 않은 RESULT나 완료 체크를 만들지 않는다.
**B0의 모든 실제 검사가 성공해야 B1 전체 ARM64 빌드를 시작한다.** ENV-1/ENV-2, DB journal/
`admin_mfa`/runtime role·동기화 판단(B2/D), TLS 발급(C), MFA 등록(D), Web 종료(E), 공개 전환(F)은 보류한다.
