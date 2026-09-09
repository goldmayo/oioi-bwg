# M9 OCI Resource Manager stack

이 root stack은 `M9-CICD-OCI-OPERATIONS-PLAN`에 따라 새 M9 resource만 관리한다. 기존 Compute,
VCN, subnet, boot volume, PostgreSQL data는 OCID로 조회하며 생성·수정·import하지 않는다.

## Activation order

1. `terraform.tfvars.example`의 non-secret 값을 Resource Manager Stack variables로 옮긴다.
2. Resource Manager에서 Plan을 실행하고 **기존 Compute/VCN 변경이나 destroy가 없는지** 검토한 뒤 Apply한다.
3. 생성된 Vault/key에 runtime secret 값을 별도 secure bootstrap으로 등록한다. Terraform에는 값이 없다.
4. runtime secret OCID만 `runtime_secret_ocids`에 넣어 다시 Plan/Apply한다. admin/migrator DB secret은 제외한다.
5. deployment/alert Notification Topic의 Slack subscription은 Console에서 각각 수동 생성한다. endpoint
   token은 state에 넣지 않는다.
6. host preflight와 실제 Ubuntu Run Command probe가 통과한 뒤 DevOps Console에서 `IMAGE_DIGEST`를 입력해
   deployment pipeline을 시작한다.

production infrastructure의 기본 실행 경로는 Resource Manager Plan → human review → Apply다. 로컬
`terraform apply`와 actual secret value가 포함된 tfvars commit은 금지한다.

## GitHub image environment

`oci-development-image` GitHub Environment에는 다음만 둔다.

- variables: `OCIR_REGISTRY`, `OCIR_NAMESPACE`, `OCIR_REPOSITORY`, public build values
- secrets: non-human CI user의 `OCIR_USERNAME`, `OCIR_AUTH_TOKEN`

이 CI principal에는 Compute, Run Command, Vault, production DB 권한을 부여하지 않는다.

## Ubuntu activation gate

Oracle의 Run Command 지원 이미지 목록은 Ubuntu를 명시하지 않는다. 따라서 Oracle Cloud Agent가
설치되었다는 사실만으로 지원을 가정하지 않는다. 대상 인스턴스에서 plugin 상태를 확인하고 secret 없는
probe command를 실제 실행해 성공 evidence를 남기기 전에는 CD를 활성화하거나 M9-G 완료로 기록하지 않는다.
