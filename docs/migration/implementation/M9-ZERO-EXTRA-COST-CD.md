---
title: "M9 Zero-extra-compute CD"
document_id: "M9-ZERO-EXTRA-COST-CD"
version: "1.2"
status: "review"
authority: "implementation"
updated_at: "2026-09-16"
---

# M9 Zero-extra-compute CD

## 결정

CI는 GitHub Actions가 계속 소유하고 CD도 같은 workflow에서 OCI Run Command를 직접 호출한다.
OCI DevOps Managed Build, Managed Shell, Events, Functions, SSH deployment는 active 경로에 두지 않는다.

```text
migration_develop merge
→ GitHub Actions verify
→ linux/arm64 image build
→ OCIR push
→ sha256 manifest digest 확정
→ GitHub Actions deploy job
→ OCI Run Command API
→ Ubuntu 24.04 Oracle Cloud Agent / ocarun
→ /srv/oioibawige/scripts/deploy-release.sh <digest>
→ health / smoke / rollback
→ GitHub Actions success / failure
```

배포 로직과 secret materialization은 기존 host script가 계속 소유한다. GitHub는 exact digest와 Run Command를
발행할 최소 OCI credential만 가진다.

## 근거

### Ubuntu Run Command

Oracle Cloud Agent 1.61.0 release에서 Ubuntu snap package의 Compute Run Command 지원이 추가됐다. M9는
Ubuntu 24.04에서 snap 기반 Oracle Cloud Agent 1.61.0 이상을 전제조건으로 고정한다.

버전만 신뢰하지 않고 실제 secret-free probe 성공도 activation gate로 유지한다. 이 프로젝트의 Ubuntu VM에서는
Run Command가 `ocarun → deploy-release.sh → deployment_succeeded`까지 실제 동작한 evidence가 이미 있다.

### Managed Shell 제외

Shell Stage는 custom deployment integration에 사용할 수 있지만 실행마다 별도 Container Instance를 만든다.
따라서 cold start와 Container Instance compute 비용이 생긴다. 이번 요구사항은 기존 runtime 외 추가 배포 compute
비용을 만들지 않는 것이므로 사용하지 않는다.

### Managed Build 제외

GitHub Actions가 이미 test와 ARM64 container build를 소유하고 있다. OCI Managed Build로 옮기면 build runtime
비용과 CI ownership 중복이 생기므로 사용하지 않는다.

### Events / Functions 제외

OCIR event를 Function으로 받아 자체 deployment orchestrator를 만들지 않는다. 이미 검증된 Run Command API와
host deployment script만으로 요구사항을 충족한다.

## Release identity

`git-<full-sha>` tag는 traceability 용도다. tag는 mutable할 수 있으므로 실제 release identity로 사용하지 않는다.
배포와 rollback은 항상 다음 manifest digest로 식별한다.

```text
<ocir-repository>@sha256:<64hex>
```

GitHub `publish-image` job이 manifest digest를 확정하고 `deploy` job에 output으로 전달한다.

## 인증과 권한 경계

GitHub deployment principal은 Oracle 공식 OCI CLI environment contract를 사용한다.

```text
OCI_CLI_USER
OCI_CLI_TENANCY
OCI_CLI_FINGERPRINT
OCI_CLI_KEY_CONTENT
```

기존 image publish credential은 그대로 분리한다.

```text
OCIR_USERNAME
OCIR_AUTH_TOKEN
```

Terraform은 `oioi_bwg_github_deploy` group과 다음 최소 policy를 만든다.

```text
Allow group Default/oioi_bwg_github_deploy to use instance-agent-command-family in compartment id <compute-compartment-ocid>
```

GitHub principal에는 Vault read, database, runtime secret, SSH, OCIR admin 권한을 주지 않는다.
API signing private key는 Terraform state와 repository에 넣지 않고 GitHub Environment secret으로만 저장한다.

대상 Compute는 기존 Instance Principal을 유지한다.

```text
Compute Instance Principal
→ exact OCIR repository pull
→ runtime Vault secret bundle read
→ metrics/log-content publish
→ instance-agent-command-execution-family
```

## 실패 처리

`ops/oci/deploy-via-run-command.sh`가 다음 경계를 소유한다.

- digest 형식이 `sha256:<64hex>`가 아니면 실행하지 않음
- Run Command 생성 timeout 900초
- execution object의 초기 `NotAuthorizedOrNotFound`는 제한된 grace window에서만 재시도
- 전체 polling은 900초를 넘기지 않음
- terminal state가 아니면 실패
- remote output에 known sensitive marker가 있으면 전체 output redaction
- host `deploy-release.sh` exit code를 GitHub Actions에 그대로 전파
  - `0`: deployment succeeded
  - `20`: candidate failed, rollback succeeded
  - `21`: candidate failed, rollback failed

따라서 OCI 배포 실패가 GitHub Actions 성공으로 숨겨지지 않는다.

## Terraform 정리 범위

active CD에서 다음 리소스를 제거한다.

```text
OCI DevOps project
OCI DevOps deployment pipeline
OCI DevOps Shell stage
COMMAND_SPEC artifact
DevOps pipeline dynamic group
Shell Stage 전용 Container/VNIC/subnet IAM
Shell subnet / availability-domain Terraform input
DevOps deployment Notification Topic
```

#81에서 진단 목적으로 추가했던 DevOps principal의 `instance-agent-command-execution-family`도 DevOps principal과
함께 제거한다.

다음은 유지한다.

```text
existing Ubuntu Compute
OCIR repository
Vault / KMS / runtime secrets
Compute dynamic group
application Logging
Monitoring alarms
alert Notification Topic
existing PostgreSQL backup bucket
```

## 비용 경계

새 OCI Container Instance, Managed Build runner, Function runtime을 만들지 않는다. 기존 Compute, OCIR storage,
Vault/Logging/Monitoring 등 원래 운영 중인 리소스의 비용 경계만 유지한다.

repository는 public이며 workflow는 GitHub standard hosted runner만 사용한다. larger runner나 self-hosted runner는
추가하지 않는다.

## 활성화 순서

1. PR CI에서 Terraform validate, operation tests, build를 통과시킨다.
2. Resource Manager Plan에서 DevOps/Shell 전용 리소스 제거와 GitHub deploy group/policy 추가만 확인한다.
3. production Compute/Vault/OCIR의 destroy/replace가 없는지 검토한다.
4. Apply 후 dedicated OCI deployment user를 `oioi_bwg_github_deploy` group에 넣고 API signing key를 발급한다.
5. GitHub `oci-development-image` Environment에 OCI CLI credential을 등록한다.
6. Ubuntu host에서 Oracle Cloud Agent snap >= 1.61.0과 Run Command probe를 다시 확인한다.
7. known-good digest로 GitHub → Run Command → host deploy를 검증한다.
8. 실제 `migration_develop` merge에서 verify → publish → deploy 자동 경로를 검증한다.
9. 수동으로 생성했던 DevOps service log와 사용하지 않는 Console 잔재를 정리한다.

API signing credential bootstrap은 코드와 분리된 one-time account operation이다. private key material은 repository나
Terraform state에 기록하지 않는다.
