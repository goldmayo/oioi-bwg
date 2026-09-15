---
title: "M9 Zero-extra-compute CD"
document_id: "M9-ZERO-EXTRA-COST-CD"
version: "1.1"
status: "review"
authority: "implementation"
updated_at: "2026-09-16"
---

# M9 Zero-extra-compute CD

## 결정

활성 CD 경로에서 OCI DevOps Managed Shell과 Managed Build를 사용하지 않는다.

OCI DevOps deployment pipeline 자체는 OCI Compute 대상으로 실행할 때 추가 서비스 요금이 없지만, 현재 Ubuntu Compute는 DevOps Compute Instance Group deployment의 지원 OS가 아니다. Ubuntu를 유지하면서 DevOps Shell stage를 사용하면 실행마다 별도 Container Instance가 생성되고 해당 compute shape 비용이 발생한다.

따라서 현재 서버 OS를 유지하고 추가 배포용 OCI compute를 만들지 않는 조건에서는 GitHub Actions가 OCI Run Command API를 직접 호출한다. OCI Run Command는 이미 설치된 Oracle Cloud Agent를 통해 기존 Compute에서 명령을 실행하며, 배포 로직과 secret materialization은 기존 host script가 계속 소유한다.

```text
migration_develop merge
→ GitHub Actions Verify
→ linux/arm64 image build
→ OCIR push
→ manifest digest 확정
→ 같은 Verify workflow의 deploy job
→ OCI Run Command
→ /srv/oioibawige/scripts/deploy-release.sh <digest>
→ health / smoke / rollback
→ GitHub Actions success / failure
```

## 선택하지 않은 대안

### OCI DevOps Compute Instance Group

OCI DevOps의 Compute Instance Group rolling deployment가 Compute 배포의 정식 managed deployment 기능이다. 그러나 현재 Oracle 문서 기준 지원 대상이 Oracle Linux와 CentOS이므로 기존 Ubuntu Compute에는 적용하지 않는다.

서버 OS를 Oracle Linux 계열로 재구축하는 별도 migration을 결정한다면 이 선택을 다시 평가한다.

### OCI DevOps Shell stage

Ubuntu에서도 custom command를 실행할 수 있지만 stage 실행마다 ephemeral Container Instance와 VNIC을 생성한다. Shell stage의 Container Instance는 선택한 compute shape 기준으로 과금되므로 추가 과금 없음 요구사항과 맞지 않는다.

### OCI DevOps Managed Build

현재 GitHub Actions가 테스트와 arm64 container build를 이미 소유한다. OCI Managed Build로 중복 이전하면 build runner OCPU/memory 사용 비용과 이중 CI 운영 비용이 생기므로 사용하지 않는다.

### OCI Events / Functions

OCIR event를 Function으로 받아 자체 deployment orchestrator를 만드는 방식은 사용하지 않는다. 현재 요구는 하나의 기존 Compute에 이미 검증된 host deployment script를 실행하는 것이므로 별도 event/function runtime을 만들지 않는다.

## 비용 경계

이 변경은 배포를 위해 새 OCI Container Instance, Build Runner, Function runtime을 만들지 않는다.

유지되는 기존 비용 경계는 다음과 같다.

- 기존 OCI Compute instance
- 기존 OCIR image storage
- 기존 Vault/Logging/Monitoring 등 이미 운영 중인 OCI resource

repository는 public이며 `ubuntu-latest`, `ubuntu-24.04-arm`은 GitHub standard hosted runner다. public repository의 standard GitHub-hosted runner 사용은 GitHub Actions compute 과금 대상이 아니다. larger runner는 사용하지 않는다.

OCI DevOps Shell stage는 Terraform에서 제거한다. DevOps project/pipeline은 기존 deployment history 식별을 위해 stage 없이 남기며 active CD에는 사용하지 않는다.

## 인증

GitHub Actions는 Oracle 공식 `oracle-actions/run-oci-cli-command`의 OCI CLI environment contract를 사용한다.

`oci-development-image` GitHub Environment에 다음 API signing credential이 필요하다.

```text
OCI_CLI_USER
OCI_CLI_TENANCY
OCI_CLI_FINGERPRINT
OCI_CLI_KEY_CONTENT
```

기존 OCIR credential은 image publish에만 그대로 사용한다.

```text
OCIR_USERNAME
OCIR_AUTH_TOKEN
```

Terraform은 `oioi_bwg_github_deploy` IAM group과 최소 policy를 생성한다. GitHub deployment principal에는 application secret, Vault read, database, OCIR admin 권한을 부여하지 않는다.

최소 policy:

```text
Allow group Default/oioi_bwg_github_deploy to use instance-agent-command-family in compartment id <compute-compartment-ocid>
```

`use instance-agent-command-family`는 Run Command 생성, 조회, 실행 결과 조회, 취소에 필요한 API 권한을 포함한다. 대상 Compute 자체는 기존 dynamic group의 `instance-agent-command-execution-family` 권한을 계속 사용한다.

API signing key private material은 Terraform state와 repository에 넣지 않고 GitHub Environment secret으로만 저장한다.

## 실패 처리

`ops/oci/deploy-via-run-command.sh`가 다음 경계를 소유한다.

- digest 형식이 `sha256:<64hex>`가 아니면 실행하지 않음
- Run Command 생성 timeout 900초
- command execution object가 아직 생성되지 않은 초기 `NotAuthorizedOrNotFound`는 최대 300초 grace 허용
- 전체 polling은 900초를 넘기지 않음
- terminal state가 아니면 실패
- remote output에 known sensitive marker가 있으면 전체 출력 redaction
- `deploy-release.sh`의 exit code를 GitHub Actions exit code로 그대로 전파
  - `0`: deployment succeeded
  - `20`: candidate failed, rollback succeeded
  - `21`: candidate failed, rollback failed

따라서 OCI 배포 실패가 GitHub Actions 성공으로 숨겨지지 않는다.

## 폐기되는 경로

다음 경로는 active CD에서 제거한다.

```text
OCI DevOps Shell stage
→ ephemeral Container Instance
→ command-spec artifact
→ pipeline resource principal이 Run Command 실행
```

Shell stage 전용 subnet/availability-domain Terraform input과 DevOps dynamic-group 권한도 함께 제거한다.

## 활성화 전 검증

PR CI에서 Terraform validate, operation tests, format check를 통과시킨다. merge 후 Resource Manager Plan에서는 다음만 허용한다.

- Shell stage 삭제
- command-spec artifact 삭제
- DevOps dynamic group 삭제
- Shell stage 전용 IAM 권한 삭제
- GitHub deploy IAM group 및 Run Command policy 추가

production Compute/Vault/OCIR의 destroy/replace는 허용하지 않는다.

API signing credential bootstrap은 코드와 분리된 one-time account operation이다. repository connector는 GitHub Actions secret 값을 생성하거나 기존 secret 값을 읽을 수 없으므로 private key material 자체는 repository 변경에 포함하지 않는다.
