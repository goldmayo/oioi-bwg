---
title: "M9 Zero-extra-compute CD"
document_id: "M9-ZERO-EXTRA-COST-CD"
version: "1.0"
status: "review"
authority: "implementation"
updated_at: "2026-09-16"
---

# M9 Zero-extra-compute CD

## 결정

활성 CD 경로에서 OCI DevOps Managed Shell과 Managed Build를 사용하지 않는다. 두 기능은 실행 시 별도 compute/container runtime을 생성하고 과금될 수 있기 때문이다.

현재 public GitHub repository의 standard GitHub-hosted runner를 그대로 사용하고, 이미 존재하는 OCI Compute instance에 OCI Run Command를 직접 발행한다.

```text
migration_develop merge
→ GitHub Actions Verify
→ linux/arm64 image build
→ OCIR push
→ Verify workflow 완료
→ Deploy OCI development workflow
→ OCIR git-<commit-sha> manifest digest resolve
→ OCI Run Command
→ /srv/oioibawige/scripts/deploy-release.sh <digest>
→ health / smoke / rollback
→ GitHub Actions success / failure
```

## 비용 경계

이 변경은 배포를 위해 새 OCI compute/container/function runtime을 만들지 않는다.

유지되는 기존 비용 경계는 다음과 같다.

- 기존 OCI Compute instance
- 기존 OCIR image storage
- 기존 Vault/Logging/Monitoring 등 이미 운영 중인 OCI resource

GitHub repository는 public이며 `ubuntu-latest`, `ubuntu-24.04-arm`은 GitHub standard hosted runner다. public repository의 standard hosted runner 사용은 GitHub Actions 과금 대상이 아니다.

OCI DevOps Shell stage는 Terraform에서 제거한다. DevOps project/pipeline은 과거 deployment history 식별을 위해 stage 없이 남기며 active CD에는 사용하지 않는다.

## 인증

GitHub Actions는 Oracle 공식 OCI CLI 환경 변수 계약을 사용한다.

`oci-development-image` GitHub Environment에 다음 API signing credential만 추가한다.

```text
OCI_CLI_USER
OCI_CLI_TENANCY
OCI_CLI_FINGERPRINT
OCI_CLI_KEY_CONTENT
```

이미 존재하는 OCIR credential은 그대로 사용한다.

```text
OCIR_USERNAME
OCIR_AUTH_TOKEN
```

배포용 OCI principal에는 application secret, Vault read, database, OCIR admin 권한을 주지 않는다. 필요한 권한은 대상 Compute compartment의 instance 조회와 Run Command 발행/결과 조회뿐이다.

최소 정책 기준:

```text
Allow group <github-deploy-group> to read instance-family in compartment id <compute-compartment-ocid>
Allow group <github-deploy-group> to use instance-agent-command-family in compartment id <compute-compartment-ocid>
```

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

PR CI에서 Terraform validate, operation tests, format check를 통과시킨다. merge 후 Resource Manager Plan에서는 Shell stage와 DevOps dynamic group 삭제 외 production Compute/Vault/OCIR의 destroy/replace가 없어야 한다.

API credential bootstrap은 코드와 분리된 one-time account operation이다. repository connector는 GitHub Actions secret 값을 생성할 수 없으므로 secret material 자체는 repository 변경에 포함하지 않는다.
