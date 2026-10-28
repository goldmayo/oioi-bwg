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

## M9 Resource Manager state 전환 기록

아래는 M9 전환 당시의 허용 목록이다. 현재 P06-B0 승인 범위는 다음 별도 절을 따른다.

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

## P06-B0 Console repository와 읽기 권한

[B0 계획](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-B0-PLAN.md)의
실제 Web metadata 차단·재시작 지속성 proof를 확인한 뒤 같은 Resource Manager Stack에서 검토한다.
`console_ocir_repository_name` 기본값은 `oioi-bwg-console`이며 기존 Web repository와 달라야 한다.
비공개 Stack 입력 `console_auth_secret_ocid`와 `console_mfa_secret_ocid`에 이미 생성한
Auth/MFA Secret OCID를 각각 설정한다. 중복·다른 종류·기존 runtime 목록과 겹치는 값은 거절한다.
secret 값은 입력하지 않는다. 두 필드는 문자열이며 내부에서만 두 OCID 목록으로 결합한다.

초기 `console_secret_ocids` 목록 입력은 OCI 콘솔에서 선택지가 없는 드롭다운으로 표시됐고,
실제 Plan에 빈 목록이 전달돼 검증에 실패했다. 수정 병합 후 같은 Stack의 Git branch
`migration_main`·작업 디렉터리 `infra/oci`를 유지한 채 편집을 다시 열어 새 두 입력칸을 확인한다.
`console_auth_secret_ocid`에는 `oioi-console-auth-secret`의 OCID,
`console_mfa_secret_ocid`에는 `oioi-console-mfa-encryption-key`의 OCID를 한 개씩 입력한다.
따옴표·대괄호 없이 각 `ocid1.vaultsecret...` 문자열만 사용한다. 기존 runtime 변수는 유지한다.
목록 필드만 계속 보이면 수정 소스를 아직 읽지 못한 것이므로 Plan을 다시 실행하지 않는다.

이 변경의 허용 Plan은 private Console repository 한 개 생성과 기존 runtime/deployment policy의
Console repo/두 Secret 읽기 추가다. 기존 Web repo·runtime Secret 목록·VM·Vault/Key·그룹·
backup·Logging·Monitoring의 destroy/replace 또는 무관한 update가 있으면 Apply하지 않는다.
output `console_ocir_repository`는 새 repository 경로를 제공한다. 로컬 Apply는 실행하지 않는다.

기존 Stack의 Git ref·Plan 실제 SHA·Apply 대상 Plan을 B0 계획대로 대조한다. 게시 계정의 기존
광범위 정책 교체는 Stack 밖 별도 승인 작업이며 이 코드가 수행하지 않는다. 같은 CI의 작은
push/pull·host Secret 형식 검사·새 Run Command exit 0이 모두 확인돼야 B0 완료다.

## P08 Queue·Runner 인증 준비 (2026-10-28)

이 절은 P06-B0의 과거 허용 Plan과 별도인 P08 절차다. 초안 작성 때는 OCI 작업을 실행하지 않았으며 현재 적용 상태는 [WORK](../../docs/WORK.md)가 소유한다.
`waveform.tf`는 기본 `waveform_queue_enabled=false`로 Queue/IAM을 만들지 않는다. 이 값은 인프라 생성 허용이며
Console의 `CONSOLE_WAVEFORM_RUNNER_ENABLED`와 별개다. 인프라를 만든 뒤 false로 되돌려 runtime을 끄지 않는다.
Queue의 `prevent_destroy`가 삭제·retention 변경에 따른 재생성을 거절한다.

승인 후 Resource Manager 작업 순서:

1. 기존 Vault/Key에 독립적인 Runner Secret 하나를 별도 bootstrap한다. 32-byte random 값의 64자리 소문자 hex이며
   Auth/MFA/FCM 토큰을 재사용하지 않는다. 원문은 채팅·CLI 인자·tfvars·Terraform/state·로그에 넣지 않는다.
2. #314가 포함된 `migration_main`·`infra/oci`로 Stack 구성을 업데이트한다. **Plan 전에** Edit → Configure variables에서 기존 입력을 보존하고 `waveform_runner_secret_ocid`에 해당 Secret OCID만 넣는다.
   `waveform_queue_enabled=true`로 Plan을 준비한다. Run apply 선택지가 있으면 해제하고 저장한다. null/잘못된 OCID·Web/Auth/MFA Secret 참조 재사용은 거절한다.
3. 같은 Stack·`migration_main`·`infra/oci`의 실제 source SHA를 확인하고 **별도 승인한 Resource Manager Plan**을 실행한다.
   허용되는 인프라 차이는 `oci_queue_queue.waveform[0]`와 `oci_identity_policy.waveform[0]` 두 개 생성뿐이다.
   기존 VM/네트워크/DB/backup·Vault/Key/Secret·repository·기존 IAM의 change/destroy/replace가 있으면 Apply하지 않는다.
   수동 리소스/기존 state와의 충돌도 이 실제 Plan에서 확인하며 로컬 fixture의 create 수로 대체하지 않는다.
4. Plan 검토·Apply의 별도 승인 뒤 같은 Plan을 적용하고 Queue OCID·messages endpoint·설정 output을 확인한다.
   Runner는 고정 endpoint를 공급받으므로 Queue 목록/관리 권한이 필요하지 않다. 기존 Compute Dynamic Group에
   해당 Queue만 `use queue-push`/`use queue-pull`, 해당 Secret만 읽는 별도 policy를 붙인다. GitHub 배포 계정의 권한은 늘리지 않는다.
5. Runner 설치·systemd/socket·token materialization·Caddy 내부 경로 차단·기존 Web/Console IMDS 차단 회귀는
   후속 승인·배포 단위다. 현재 코드만 병합하거나 인프라만 생성해 runtime을 활성화하지 않는다.

Runner Secret 생성 시 이름은 **`oioi-bwg-waveform-runner-token`**을 사용한다. 이름은 식별용이며 인증에는 내용이 쓰인다.
본인 로컬 터미널에서 다음 명령으로 생성한 **64자리 소문자 hex 문자열 자체**를 사용한다. 이 문서의 준비 작업에서는 실제 값을 생성·출력하지 않는다.

```sh
openssl rand -hex 32
```

기존 Vault와 해당 Vault의 symmetric Key를 선택하고 **Manual secret generation → Plain-text**로 공백·개행 없이 입력한다.
Console이 전송할 때 base64로 인코딩하므로 직접 base64로 바꾸거나 hex를 binary로 decode하지 않는다.
생성된 Secret OCID만 Stack의 `waveform_runner_secret_ocid`에, Queue 생성 Plan 전에 `waveform_queue_enabled=true`를 넣는다. Plan/Apply 뒤에 나오는 Queue output과 이 입력 변수를 구분한다.
값은 Runner와 Console 내부 API의 전용 인증에 사용하며 Web/Auth/MFA/FCM Secret을 재사용하지 않는다.
원문을 채팅·저장소·Stack 변수에 넣지 않는다. 아직 token materialization/Runner 설치·공개 경로 차단 수용 전이므로 runtime flag는 비활성으로 유지한다.
근거: [OpenSSL rand](https://docs.openssl.org/3.5/man1/openssl-rand/), [OCI Secret 생성](https://docs.oracle.com/en-us/iaas/Content/secret-management/Tasks/create-secret.htm), [Stack 변수 편집](https://docs.oracle.com/en-us/iaas/Content/ResourceManager/Tasks/update-stack-vars.htm).

설정은 [DESIGN §6.3](../../docs/migration/implementation/console-guide-editor/DESIGN.md#63-queue-설정-후보와-활성화-관문)의
실증 후보인 retention 86400초·delivery 5회·visibility 180초·poll 30초다. 별도 DLQ 리소스 없이 Queue 내장 DLQ를 사용한다.
[retention은 생성 후 변경할 수 없으므로](https://docs.oracle.com/en-us/iaas/Content/queue/queue-create.htm) Apply 전 확인한다.
실제 retention·마지막 enqueue 가능 시각·지연 여유가 확인되기 전 stale 자동 FAILED를 켜지 않는다.
Oracle-managed encryption을 사용하며 기존 Vault/Key와 Secret 원문을 Terraform이 새로 소유하지 않는다.
[IAM 계약](https://docs.oracle.com/en-us/iaas/Content/queue/policy-reference.htm)의 `target.queue.id`로 범위를 제한한다.
IAM의 주체는 VM이며 process별 격리를 증명하지 않는다. 실제 허용 source의 이용 범위·재공급 계약도 runtime 활성화 선행 조건이다.

자격 증명 없는 로컬/CI 검사(저장소 root 기준):

```sh
terraform -chdir=infra/oci init -backend=false -lockfile=readonly
terraform -chdir=infra/oci fmt -check -diff
terraform -chdir=infra/oci validate
node tests/ops/waveform-infra-plan.mjs
```

마지막 명령은 저장소 root에서 실행한다. 실제 1.5.7/OCI 8.29.0 provider를 복사한 격리 fixture에서만 Plan하며,
공식 Terraform Docker 이미지의 `--network=none`과 합성 키/OCID·합성 Queue state를 사용한다. 운영 자격 증명과 state를 읽지 않는다.
기본 무변경·활성 시 Queue/policy 생성·설정·정확한 IAM statement·Secret 누락/재사용/형식 오류·삭제/재생성 보호를 확인한다.
컨테이너와 임시 key/plan/state를 정리한다. 실제 Resource Manager Plan·IAM 허용·Queue 재전달/DLQ 실증의 대체 근거가 아니다.

### Logging parser 반복 차이 (2026-10-29)

사용자가 공유한 실제 Plan(`migration_main@938e52aa8abe34b8f2202b2b70cf40707b2fc4fb`)은
Queue/policy 두 개 생성 외에 기존 Logging parser의 `time_type="string"` 추가를 포함했다.
별도 읽기 전용 API 조회에서는 `time-type=null`이고 기존 UTC `time-format`·time key·keep flag는 유지됐다.
provider 8.29.0의 `time_type`은 optional/computed다. 명시값을 제거해 API의 현재 값을 보존하며
`ignore_changes`로 Logging 전체나 시간 형식의 차이를 숨기지 않는다. API가 null을 반환하는 원인은 확정하지 않았다.

**같은 날 시간대 재검토:** 과거 9시간 차이를 수정한 [#101](https://github.com/goldmayo/oioi-bwg/pull/101)의
`%NZ` → `%N%z`는 유지된다. P08 착수 기준부터 `938e52aa...`까지 이 Logging 파일의 변경은 없다.
명시적 `time_type` 제거 후보 [#316](https://github.com/goldmayo/oioi-bwg/pull/316)은 Draft로 보류한다.
합성 로그의 upstream Fluentd 1.16.3 비교에서 UTC/KST 모두 기존·후보는 같은 시각과 나노초를 보존했고,
예전 literal `Z`만 KST에서 9시간 어긋났다. 이는 OCI 에이전트의 실제 버전·생성 설정·수신 시각 검증은 아니다.
API `null`이나 Terraform 무변경만으로 실제 파싱 동등성을 확정하지 않는다. 상세 재현 근거는 #316에 둔다.

이전 저장 Plan은 Apply하지 않는다. 실제 에이전트의 문자열 시간 파싱·`%z`와 수신 시각 보존을 확인해
후보의 병합 여부를 판단한다. 이후 새 Plan에서 **2 add / 0 change / 0 destroy**와 기존 Logging 무변경을
확인한 뒤 별도 승인으로 그 Plan을 적용한다. 합성 state의 offline 검증은 실제 OCI 재Plan·로그 수신 수용을 대신하지 않는다.

## IAM boundary

Compute dynamic group은 유지한다. 해당 instance는 다음 책임만 가진다.

- exact OCIR repository pull
- runtime Vault secret bundle read
- metrics/log-content publish
- Run Command execution
- 별도 P08 승인/적용 시 exact waveform Queue push/pull·Runner Secret read

GitHub deployment principal은 별도 `oioi_bwg_github_deploy` group에 넣고 다음 권한만 부여한다.

```text
read instances in the Compute compartment
manage instance-agent-command-family in the Compute compartment
use instance-agent-command-execution-family in the Compute compartment
```

세 정책의 실제 statement/domain 표기는 [iam.tf](iam.tf)의 `github_deploy_policy_statements`를 따른다.
Run Command 계정과 OCIR 이미지 게시 계정을 구분한다. command list 성공은 대상 Instance 조회나
command 생성 권한의 증명이 아니다. 동일 CI API principal로 Instance 조회 → 새 command 생성 →
VM 실행 → execution 결과 조회·exit 0까지 기록해야 한다.

Run Command principal에는 Vault read, database, runtime secret, SSH, OCIR admin 권한을 주지 않는다.
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
현재 preflight의 helper 존재·Object Storage namespace 조회·과거 probe marker만으로 새 repository
pull·새 secret 읽기·현재 CI 계정의 Run Command 권한까지 증명하지 못한다.
P06의 빌드 전 주체별 실증과 Web/Console metadata 차단은
[P06-B0 계획](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md#41-p06-b0-arm64-빌드-전-iam-준비실증)을 따른다.
이는 현재 OCI 정책/VM 적용 상태를 확인했다는 기록이 아니다.

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
