# M9 OCI Resource Manager stack

이 root stack은 `M9-CICD-OCI-OPERATIONS-PLAN`에 따라 새 M9 resource만 관리한다. 기존 Compute,
VCN, subnet, boot volume, PostgreSQL data와 PostgreSQL backup bucket은 조회만 하며 생성·수정·import하지
않는다. 서비스 리전은 `ap-osaka-1`이고 OCIR host는 `${region}.ocir.io`에서 유도한다.

## Activation order

1. `terraform.tfvars.example`의 non-secret 값을 Resource Manager Stack variables로 옮긴다. 현재 기존
   backup bucket 이름은 `oioibawige-db-backup`이며 `backup_bucket_name`으로 제공한다. 별도 OCIR host
   변수는 입력하지 않는다.
2. Resource Manager에서 Plan을 실행하고 **기존 Compute/VCN 변경이나 destroy가 없는지** 검토한 뒤 Apply한다.
3. 생성된 Vault/key에 runtime secret 값을 별도 secure bootstrap으로 등록한다. Terraform에는 값이 없다.
4. runtime secret OCID만 `runtime_secret_ocids`에 넣어 다시 Plan/Apply한다. admin/migrator DB secret은 제외한다.
5. deployment/alert Notification Topic의 Slack subscription은 Console에서 각각 수동 생성한다. endpoint
   token은 state에 넣지 않는다.
6. host preflight와 실제 Ubuntu Run Command probe가 통과한 뒤 DevOps Console에서 `IMAGE_DIGEST`를 입력해
   deployment pipeline을 시작한다.

기존 backup은 exact Compute를 매칭하는 `oioibawige-backup-instance` dynamic group, known bucket에
한정된 `read buckets`/`manage objects` policy, `objectstorage-ap-osaka-1` lifecycle service policy를
사용한다. 이 stack은 이 기존 IAM/lifecycle resource, 신규 backup bucket, bucket write IAM 또는 backup
metric/alarm을 만들지 않는다.

## Existing backup IaC adoption

현재 단계는 bucket data source/input만 사용하는 zero-mutation Phase 1이다.

1. 실제 bucket, backup dynamic group, backup IAM policy와 lifecycle 설정을 Terraform resource
   declaration과 비교해 config parity를 확인한다.
2. 별도 승인된 변경에서 기존 bucket, dynamic group, IAM policy, 필요 시 lifecycle policy를 Resource
   Manager state로 import한다.
3. Resource Manager Plan에서 기존 resource destroy/replace가 0건이고 ideally `No changes`인지 검토한다.
4. 검증 후에만 Terraform/Resource Manager ownership으로 전환한다.

기존 resource를 delete/recreate하거나 이름을 바꾸지 않는다. Host의
`/srv/oioibawige/scripts/backup-postgres.sh`, `oioibawige-postgres-backup.service`와 timer는 Terraform
resource가 아니다. 실제 파일을 확보·검토하기 전에는 repository asset으로 재작성하지 않는다.

production infrastructure의 기본 실행 경로는 Resource Manager Plan → human review → Apply다. 로컬
`terraform apply`와 actual secret value가 포함된 tfvars commit은 금지한다.

## GitHub image environment

`oci-development-image` GitHub Environment에는 다음만 둔다.

- variables: `OCIR_REGISTRY`, `OCIR_NAMESPACE`, `OCIR_REPOSITORY`, public build values
- secrets: non-human CI user의 `OCIR_USERNAME`, `OCIR_AUTH_TOKEN`

이 CI principal에는 Compute, Run Command, Vault, production DB 권한을 부여하지 않는다.

`oci-development-image` credential 등록 전 `migration_develop`에 PR required, Verify required status
check, direct push 제한을 활성화하고 GitHub 설정 evidence를 남긴다. 2026-09-11 확인 시 branch
protection은 아직 비활성이다.

## Ubuntu activation gate

Oracle의 Run Command 지원 이미지 목록은 Ubuntu를 명시하지 않는다. 따라서 Oracle Cloud Agent가
설치되었다는 사실만으로 지원을 가정하지 않는다. 대상 인스턴스에서 plugin 상태를 확인하고 secret 없는
probe command를 실제 실행해 성공 evidence를 남기기 전에는 CD를 활성화하거나 M9-G 완료로 기록하지 않는다.

## Runtime evidence gates

- Application Compose의 `json-file` log rotation이 `10m` × `5`인지 확인한다.
- 기존 PostgreSQL container log rotation은 repository 밖의 activation checklist로 확인한다.
- Application test log가 OCI Logging Search에 실제 수집됐는지 확인한다.
- `restart: unless-stopped`와 healthcheck를 자동 unhealthy restart로 해석하지 않는다.
- Caddy/production endpoint 활성화 전에는 external HTTPS health monitoring을 완료로 표시하지 않는다.
- PostgreSQL과 application의 실제 memory baseline 전에는 container memory limit을 정하지 않는다.
