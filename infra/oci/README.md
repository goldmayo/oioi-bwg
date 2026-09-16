# M9 OCI Resource Manager stack

이 root stack은 기존 Ubuntu Compute를 직접 소유하지 않고 M9에 필요한 OCI 주변 리소스와 최소 IAM만 관리한다.
기존 Compute, VCN, boot volume, PostgreSQL data와 PostgreSQL backup bucket은 조회만 하며 생성·수정·import하지 않는다.
서비스 리전은 `ap-osaka-1`이다.

OCIR repository는 private이다. `git-<full-commit-sha>`는 traceability tag이며 실제 immutable release identity는
`<repository>@sha256:<manifest-digest>`다.

## Active CI/CD ownership

```text
GitHub Actions
  → verify
  → linux/arm64 image build
  → OCIR push
  → manifest digest resolve
  → OCI Run Command API
  → existing Ubuntu Compute
  → /srv/oioibawige/scripts/deploy-release.sh <digest>
```

OCI DevOps Managed Build와 Shell Stage는 사용하지 않는다. Shell Stage는 실행 시 별도 Container Instance를
생성하므로 추가 deployment compute 비용과 cold start가 발생한다. M9는 기존 Compute의 Oracle Cloud Agent와
Run Command를 직접 사용한다.

## Current Resource Manager state transition

기존 state에는 과거 실험에서 생성한 OCI DevOps project/pipeline, command-spec artifact, Shell Stage,
DevOps dynamic group과 관련 IAM이 들어 있다. 이 변경을 Apply하면 해당 리소스는 제거 대상이다.

Plan에서 허용되는 CD 관련 변경은 다음뿐이다.

```text
- OCI DevOps Shell Stage / command-spec artifact / pipeline / project 제거
- DevOps dynamic group 및 Shell Stage 전용 IAM 제거
- Shell 전용 subnet/AD input과 data lookup 제거
- GitHub deployment용 IAM group 및 Run Command policy 추가
- DevOps 전용 deployment Notification Topic 제거
```

다음 리소스는 destroy/replace되면 안 된다.

```text
existing Ubuntu Compute
OCIR repository
Vault / KMS
runtime secrets
application Logging configuration
Monitoring alarms
alert Notification Topic
existing PostgreSQL backup bucket
```

production infrastructure의 기본 실행 경로는 Resource Manager Plan → human review → Apply다. 로컬
`terraform apply`와 actual secret value가 포함된 tfvars commit은 금지한다.

## IAM boundary

Compute dynamic group은 유지한다. 해당 instance는 다음 책임만 가진다.

- exact OCIR repository pull
- runtime Vault secret bundle read
- metrics/log-content publish
- Run Command execution

GitHub deployment principal은 별도 `oioi_bwg_github_deploy` group에 넣고 다음 권한만 부여한다.

```text
use instance-agent-command-family on the Compute compartment
```

GitHub principal에는 Vault read, database, runtime secret, SSH, OCIR admin 권한을 주지 않는다.
API signing private key는 Terraform state에 넣지 않는다.

## GitHub environment

`oci-development-image` Environment에는 다음을 둔다.

```text
variables
- OCIR_REGISTRY
- OCIR_NAMESPACE
- OCIR_REPOSITORY
- public build values

secrets
- OCIR_USERNAME
- OCIR_AUTH_TOKEN
- OCI_CLI_USER
- OCI_CLI_TENANCY
- OCI_CLI_FINGERPRINT
- OCI_CLI_KEY_CONTENT
```

OCI API signing credential은 Run Command 전용 non-human user에 발급하고 Terraform이 만드는
`oioi_bwg_github_deploy` group에만 가입시킨다.

## Ubuntu activation gate

Oracle Cloud Agent 1.61.0부터 Ubuntu snap package에 Compute Run Command 지원이 추가됐다. M9는 Ubuntu
24.04 host에서 snap 기반 agent 1.61.0 이상과 secret-free Run Command probe 성공을 모두 요구한다.

```bash
sudo /srv/oioibawige/scripts/preflight-host.sh
```

실제 probe 성공 evidence와 agent version을 남기기 전에는 automatic deploy를 활성화하지 않는다.

## Existing backup IaC adoption

기존 PostgreSQL backup bucket과 backup IAM/lifecycle은 이번 변경의 소유권 전환 대상이 아니다. 현재 stack은
bucket data source/input만 사용한다. bucket delete/recreate, 이름 변경, import는 별도 승인된 migration에서만 한다.

## Runtime evidence gates

- Application Compose의 Docker log rotation 확인
- Application test log의 OCI Logging Search 수집 확인
- Caddy/HTTPS endpoint health 확인
- Run Command deploy 결과와 exact digest 확인
- candidate failure/rollback recovery 확인
- filesystem warning/critical alarm과 Slack delivery 확인
