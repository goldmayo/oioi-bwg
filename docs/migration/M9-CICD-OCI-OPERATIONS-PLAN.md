---
title: "M9 OCI CI/CD & Operations Architecture Plan"
document_id: "M9-CICD-OCI-OPERATIONS-PLAN"
version: "1.1"
status: "active"
authority: "plan"
updated_at: "2026-09-10"
depends_on:
  - "01"
  - "09"
  - "11"
  - "12"
related:
  - "M9-OCI-DEVELOPMENT-RUNTIME-PLAN"
sources:
  baseline:
    repository: "goldmayo/oioi-bwg"
    branch: "migration_develop"
    commit: "3a28f6ac8c772b5c7d130f957790b165690008aa"
  pr_73:
    branch: "migration_m9-oci-dev-runtime"
    commit: "9e04ce22d636f7dc66df57218371144c06c8292f"
---

# M9 OCI CI/CD & Operations Architecture Plan

## 0. v1.1 운영 기준 정정

이 절은 PR 73 구현 후 확인된 운영 사실을 반영한 2026-09-10 addendum다. 아래 기존 계획 중
신규 PostgreSQL backup 구축, 광범위한 database ownership 이관, 리전 예시는 이 절이 대체한다.
기존 M9 CI/CD 책임 경계와 배포 구조는 유지한다.

정정 전 repository baseline은 `migration_m9-oci-dev-runtime`
`c96bef6e0a8e554fd89c689fcdea8522846e8f53`이며, 기존 운영 backup은 사용자가 2026-09-10에 확인한
host 구성 사실이다. Production OCI/VM에는 접근하지 않았으므로 세부 script/timer/bucket/retention/auth는
아직 unknown으로 유지한다.

확정 리전은 다음 하나다.

```text
OCI region = ap-osaka-1
OCIR = ap-osaka-1.ocir.io
```

OCIR host는 별도 입력하지 않고 `${region}.ocir.io`로 유도한다.

PostgreSQL 역할은 `admin -> oioi_migrator -> oioi_app`을 유지하되 ownership bootstrap은 tracked
Drizzle schema/migration으로 식별한 application table/sequence와 migration metadata만 대상으로 한다.
`public`/`drizzle` 전체 relation, extension-owned object, host-owned object, schema ownership, database
전체 `PUBLIC CONNECT`는 변경하지 않는다. Migrator에는 필요한 schema `USAGE`/`CREATE`, application
object ownership과 default privilege만 주고 app에는 application DML/sequence usage만 준다.

운영 Ubuntu VM에는 이미 PostgreSQL dump를 OCI Object Storage로 보내는 host-managed backup이 있다.
PR 73은 이를 대체하거나 병렬 구축하지 않는다.

```text
유지: existing VM -> existing PostgreSQL backup -> existing Object Storage bucket
Terraform: existing bucket lookup/input only
제거: 신규 bucket, repository backup/restore script와 timer, 신규 backup custom metric/alarm
후속: 실제 VM의 script/timer/bucket/retention/auth inventory와 안전한 Resource Manager import 판단
검증: restore proof는 별도 activation evidence
```

Application Compose의 `json-file` log는 `10m` × `5`로 회전한다. 기존 PostgreSQL container는 이
repository가 소유하지 않으므로 activation 시 log rotation만 확인한다. `restart: unless-stopped`는
유지하지만 Docker healthcheck가 unhealthy container를 자동 restart하지는 않는다. Runtime health
failure는 external monitoring -> alert -> operator investigation으로 다루며 자동 restart loop나
destructive prune을 추가하지 않는다.

Run Command 종료 후 execution의 lifecycle, remote exit code, output과 deployment result를 DevOps log에
남긴다. Exit `21`은 기존 alert Notification Topic으로 CRITICAL message를 보내며 별도 metric system을
만들지 않는다. Secret marker가 포함된 remote output은 출력하지 않는다.

12 GB VM의 application container memory limit은 실제 activation baseline 전에는 정하지 않는다.
Terraform/Logging configuration 존재는 운영 완료 증거가 아니며, external HTTPS health monitoring과
OCI Logging Search에서의 application test log 확인은 Caddy/production endpoint activation 이후의
별도 evidence gate로 남긴다.

## 1. 목적

oioi-bwg의 OCI 단일 VM 배포를 다음 원칙으로 정리한다.

```text
GitHub
= source / review / CI / image build

OCIR
= immutable container image registry

OCI DevOps
= CD orchestration

Ubuntu Compute
= application runtime

OCI Resource Manager
= OCI infrastructure IaC

OCI Secret Management
= runtime secret SSOT

OCI Monitoring / Notifications
= infrastructure monitoring / alert

Sentry
= application error observability
```

핵심 배포 경계는 다음과 같다.

```text
GitHub CI
    ↓
OCIR
    ↓
OCI DevOps CD
    ↓
Ubuntu Compute
```

GitHub Actions가 Compute에 SSH하거나 직접 애플리케이션을 배포하지 않는다.

OCI DevOps 이후가 CD 책임 영역이다.

---

# 2. 기존 Architecture 변경

현재 Architecture Constitution 01은 다음을 deployment baseline으로 가진다.

```text
GHCR 기반 이미지 배포
```

본 계획을 채택하면서 이를 다음으로 변경한다.

```text
GitHub Actions CI
→ OCIR immutable image
→ OCI DevOps CD
→ OCI Compute
```

01이 최상위 authority이므로 구현 전에 Constitution을 먼저 개정한다.

관련 문서도 함께 갱신한다.

최소 대상:

```text
01-architecture-constitution.md
11-content-i18n-assets-runtime-architecture.md
12-deployment-migration-runbook.md
M9 관련 plan/result
00 document index if required
```

09 application observability의 기존 원칙은 변경하지 않는다.

---

# 3. 최종 Runtime 구조

```text
Internet
   ↓
Caddy
   ↓
Next.js standalone container
   ↓
PostgreSQL 17 container
```

OCI Compute:

```text
Ubuntu 24.04
2 OCPU
12 GB RAM
100 GB disk

Docker Engine
Docker Compose

Caddy
Next.js container
PostgreSQL 17 container
Oracle Cloud Agent
```

Ubuntu를 유지한다.

Podman으로 전환하지 않는다.

---

# 4. CI/CD 전체 흐름

```text
developer
   ↓
GitHub PR
   ↓
CI
├ typecheck
├ lint / architecture
├ unit test
├ PostgreSQL integration
├ format
└ build
   ↓
Docker image build
   ↓
OCIR push
   ↓
immutable image digest
   ↓
OCI DevOps Deployment
   ↓
Shell Stage
   ↓
OCI Compute Run Command
   ↓
Ubuntu deploy script
   ↓
Docker pull
   ↓
Docker Compose up
   ↓
health / readiness / smoke
   ↓
release success
```

CI와 CD의 책임을 섞지 않는다.

---

# 5. GitHub CI 책임

GitHub Actions는 다음까지만 책임진다.

```text
source checkout
dependency install
static verification
test
build
Docker image build
OCIR push
```

GitHub Actions는 다음 권한을 가지지 않는다.

```text
Compute SSH
Compute Run Command
Vault runtime secret read
PostgreSQL production credential
Docker Compose execution on OCI
production filesystem access
```

---

# 6. CI Quality Gate

현재 Verify 원칙을 유지한다.

```text
install
→ typecheck
→ lint / structure
→ unit / integration
→ format
→ build
→ image build
→ image push
```

검증에 실패한 commit은 deployable image로 publish하지 않는다.

현재 PR 73처럼 verification workflow와 image publish workflow가 서로 독립적으로 성공할 수 있는 구조를 제거한다.

권장 구조:

```text
jobs:
  verify:
    ...

  publish_image:
    needs: verify
    if: migration_develop push
```

PR에서는 verify만 실행한다.

`migration_develop`에 검증된 변경이 merge된 뒤에만 release image를 publish한다.

---

# 7. Container Image 정책

Registry:

```text
OCI Container Registry
```

image repository 예:

```text
<region>.ocir.io/<namespace>/oioi-bwg
```

traceability tag:

```text
git-<full-commit-sha>
```

하지만 실제 deployment identity는 tag가 아니라 digest다.

```text
<region>.ocir.io/<namespace>/oioi-bwg@sha256:<digest>
```

원칙:

```text
Git commit SHA
= traceability

OCI image digest
= release identity
```

`latest`, `development` 같은 mutable tag를 실제 배포 기준으로 사용하지 않는다.

필요하면 convenience alias로만 사용할 수 있다.

---

# 8. GitHub → OCIR 인증

v1에서는 OCI Container Registry 공식 Docker 인증 모델을 따른다.

별도의 non-human CI user를 만든다.

예:

```text
oioi-github-ci
```

이 사용자는 다음 권한만 가진다.

```text
지정 OCIR repository push
필요한 repository inspect/read
```

Compute, Vault, database 등에 대한 권한을 주지 않는다.

GitHub Actions에는 다음과 같은 CI 전용 credential만 저장한다.

```text
OCI registry username
OCI auth token
```

credential은 GitHub Actions Secret에 둔다.

개인 관리자 계정 credential을 CI에 사용하지 않는다.

rotation 가능한 독립 credential로 취급한다.

---

# 9. CI → CD 전환

v1에서는 CI와 CD 사이에 명시적인 release gate를 둔다.

```text
CI 성공
→ OCIR image digest 생성
→ release candidate ready
→ OCI DevOps deployment 시작
```

초기에는 OCI DevOps Console에서 대상 image digest를 지정하고 deployment를 시작한다.

이 선택의 목적은 GitHub에 별도의 OCI API signing credential이나 Compute 관련 권한을 추가하지 않는 것이다.

CD pipeline이 안정화된 이후 필요성이 확인되면:

```text
GitHub CI
→ CreateDeployment API only
```

수준의 자동 trigger를 별도 설계할 수 있다.

자동 trigger를 추가하더라도 GitHub가 Compute를 직접 제어하면 안 된다.

---

# 10. OCI DevOps 책임

OCI DevOps는 다음을 책임진다.

```text
deployment execution
approval
deployment history
deployment status
CD failure
notification
```

Ubuntu는 OCI DevOps native Compute Instance Group deployment target으로 사용하지 않는다.

대신:

```text
OCI DevOps Shell Stage
→ OCI Compute Run Command
→ Ubuntu
```

구조를 사용한다.

Shell Stage의 OCI CLI는 pipeline resource principal을 사용한다.

---

# 11. Compute Run Command

OCI DevOps Shell Stage는 Compute에 SSH하지 않는다.

OCI API를 통해 Run Command를 생성한다.

```text
OCI DevOps
   ↓
OCI Instance Agent API
   ↓
Oracle Cloud Agent
   ↓
Ubuntu bash
```

VM inbound SSH는 CD 수행을 위해 필요하지 않다.

SSH는 emergency/manual operation 용도로만 남긴다.

Run Command에는 secret 값을 넣지 않는다.

전달 가능한 값:

```text
IMAGE_DIGEST
deployment ID
release metadata
```

전달 금지:

```text
DB password
AUTH_SECRET
R2 secret
Slack webhook
OCI auth token
```

---

# 12. Server Deploy Script

VM에는 실제 deployment를 수행하는 script를 둔다.

예:

```text
/srv/oioibawige/scripts/deploy-release.sh
```

argument:

```text
IMAGE_DIGEST
```

script는 idempotent해야 한다.

동시에 두 deployment가 실행되지 않도록 host-level lock을 둔다.

예:

```text
flock
```

배포 순서:

```text
1. deployment lock
2. target digest validation
3. Vault runtime secret fetch
4. temporary env validation
5. docker pull target digest
6. current release 확인
7. target image 적용
8. docker compose up -d --wait
9. /healthz
10. /readyz
11. critical smoke
12. current/previous release state update
```

secret fetch나 image pull이 실패한 경우 현재 실행 중인 container를 변경하지 않는다.

---

# 13. Release State

VM에 secret이 아닌 deployment metadata만 저장한다.

예:

```text
/srv/oioibawige/deploy/
├ current
└ previous
```

내용:

```text
current
sha256:BBB

previous
sha256:AAA
```

release state update는 atomic하게 수행한다.

현재 정상 release를 확인하기 전에 `previous`를 덮어쓰지 않는다.

---

# 14. Rollback

rollback 단위는 Docker image digest다.

예:

```text
current
sha256:AAA

candidate
sha256:BBB
```

BBB deployment:

```text
pull BBB
→ compose up BBB
→ health
→ readiness
→ smoke
```

성공:

```text
previous = AAA
current = BBB
```

실패:

```text
BBB failure
   ↓
compose up AAA
   ↓
health
   ↓
readiness
```

rollback 성공:

```text
deployment FAILED
rollback SUCCEEDED
```

rollback 실패:

```text
deployment FAILED
rollback FAILED
```

후자는 Critical incident로 취급한다.

rollback 시 DB를 자동으로 되돌리지 않는다.

---

# 15. DB Migration 경계

application deployment와 DB migration을 분리한다.

```text
Application Release
= Docker image

Database Migration
= explicit privileged operation
```

DB schema 변경이 없는 release:

```text
normal CD
```

DB schema 변경이 있는 release:

```text
backup 확인
→ compatibility 확인
→ manual approval
→ Drizzle migration
→ application deploy
→ smoke
```

destructive migration을 application deploy와 하나의 irreversible step으로 묶지 않는다.

v1에서 production migration 자동화를 목표로 하지 않는다.

---

# 16. PostgreSQL 계정 분리

현재 application이 관리자 credential로 접속하는 구조를 제거한다.

역할은 세 층으로 둔다.

```text
bootstrap / superuser
        ↓
migrator / owner
        ↓
application runtime
```

예:

```text
admin
oioi_migrator
oioi_app
```

## admin

용도:

```text
emergency
role bootstrap
ownership repair
DB-level administration
```

일상적인 application이나 migration에서 사용하지 않는다.

application env에 절대 넣지 않는다.

---

## oioi_migrator

용도:

```text
Drizzle migration
schema DDL
application object ownership
```

권한:

```text
CREATE / ALTER / DROP required for application schema
table / sequence ownership
```

현재 application schema object가 admin 소유라면 migration 전에 ownership strategy를 명시적으로 정리한다.

새 schema로 이동하는 구조 변경은 이번 작업에 섞지 않는다.

---

## oioi_app

Next.js runtime 전용 계정.

허용:

```text
CONNECT
schema USAGE
SELECT
INSERT
UPDATE
DELETE
required sequence USAGE
```

금지:

```text
CREATE DATABASE
CREATE ROLE
schema CREATE
ALTER TABLE
DROP
role management
```

미래 migration으로 생성되는 table/sequence에도 app 권한이 자동 적용되도록 PostgreSQL default privileges를 설정한다.

Next.js `DATABASE_URL`은 오직 `oioi_app` credential을 사용한다.

---

# 17. DB Credential 정책

```text
DB_ADMIN_PASSWORD
```

은 application Compute principal이 읽을 수 없다.

관리자 전용 Vault secret 또는 별도 안전한 credential store에 둔다.

```text
DB_MIGRATOR_PASSWORD
```

도 v1에서는 application Compute principal의 상시 runtime secret 범위에 포함하지 않는다.

production migration은 별도의 explicit privileged operation으로 유지한다.

```text
DB_APP_PASSWORD
```

만 normal application deployment에서 사용할 수 있다.

---

# 18. OCI Secret Management

runtime secret의 SSOT로 OCI Secret Management를 사용한다.

대상 예:

```text
DB_APP_PASSWORD
AUTH_SECRET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
OCI_EMAIL_*
기타 server-only credential
```

secret은 Next.js client bundle에 들어가면 안 된다.

---

# 19. Vault 접근 방식

Next.js application이 OCI SDK로 Vault를 직접 읽지 않는다.

```text
BAD

Next.js
→ OCI SDK
→ Vault
```

다음 구조를 사용한다.

```text
deploy process
→ Instance Principal
→ OCI Secret Management
→ protected env file
→ Docker Compose
→ Next.js
```

VM은 Instance Principal로 인증한다.

static OCI API key를 VM에 저장하지 않는다.

runtime env 파일:

```text
/srv/oioibawige/app.env
```

권한:

```text
0600
```

secret fetch와 env validation을 완료한 후에만 runtime env를 교체한다.

부분적으로 생성된 env 파일을 application에 적용하면 안 된다.

---

# 20. OCIR Pull 인증

Compute는 static OCIR password를 저장하지 않는 것을 목표로 한다.

권장:

```text
Compute Instance Principal
→ docker-credential-ocir
→ OCIR
```

Compute IAM policy는 필요한 repository read 권한만 가진다.

```text
GitHub
= push

Compute
= pull
```

권한을 분리한다.

---

# 21. Terraform / Resource Manager

Terraform 실행과 state 관리는 OCI Resource Manager를 사용한다.

```text
Terraform source
→ Resource Manager Stack
→ Plan
→ human review
→ Apply
→ Resource Manager State
```

production infrastructure 변경에 local `terraform apply`를 기본 경로로 사용하지 않는다.

---

# 22. Terraform 코드 위치

예:

```text
infra/
└ oci/
   ├ versions.tf
   ├ variables.tf
   ├ data.tf             # existing resources와 backup bucket lookup
   ├ ocir.tf
   ├ iam.tf
   ├ vault.tf
   ├ devops.tf
   ├ notifications.tf
   ├ monitoring.tf
   ├ logging.tf
   ├ outputs.tf
   └ terraform.tfvars.example
```

초기 규모에서는 불필요한 Terraform module 계층을 만들지 않는다.

한 root stack으로 시작한다.

---

# 23. Terraform 관리 범위

초기 Resource Manager Stack은 새로 만드는 리소스부터 관리한다.

예:

```text
OCIR repository
Vault / key infrastructure
IAM dynamic group / policy
OCI DevOps project
deployment pipeline
Shell Stage
Notification topic
Monitoring alarms
Logging resources
existing Object Storage backup bucket lookup
```

이미 정상 운영 중인 다음 리소스는 처음부터 억지로 Terraform ownership으로 가져오지 않는다.

```text
existing Compute
existing VCN
existing subnet
existing boot volume
existing PostgreSQL data
```

기존 resource는 data source나 input OCID로 참조한다.

필요성이 확인되면 나중에 별도 import 작업으로 Terraform ownership에 편입한다.

---

# 24. Terraform에 넣지 않는 것

다음 값을 Terraform config 또는 state에 저장하지 않는다.

```text
DB password
AUTH_SECRET
R2 secret
Slack webhook URL
OCI auth token
SSH private key
```

`variable sensitive = true`만으로 state secret 문제를 해결했다고 간주하지 않는다.

Terraform state에 저장될 가능성이 있는 secret content는 Terraform으로 관리하지 않는다.

따라서 v1:

```text
Vault/key infrastructure
= Terraform

actual secret values
= Vault Console/CLI의 별도 secure bootstrap/rotation process
```

---

# 25. Slack Subscription과 Terraform

OCI Notification Topic은 Terraform으로 관리할 수 있다.

Slack subscription endpoint에는 webhook token이 포함되므로 Terraform state에 넣지 않는다.

따라서:

```text
Notification Topic
= Terraform

Slack subscription endpoint
= manual secure configuration
```

으로 분리한다.

---

# 26. Observability 경계

세 영역으로 나눈다.

```text
Application
→ Sentry

Infrastructure
→ OCI Monitoring / Logging

Deployment
→ OCI DevOps
```

GA4/product analytics와 operational observability를 섞지 않는다.

---

# 27. Application Observability

기존 09 원칙을 유지한다.

```text
structured JSON logger
Sentry
```

capture:

```text
unexpected server exception
output contract violation
ClientContractError
unexpected client runtime failure
```

기본적으로 capture하지 않음:

```text
expected AppError
normal validation failure
normal 401
normal 403
normal 404
normal 409
```

로그에는 다음을 넣지 않는다.

```text
password
token
cookie
Authorization header
secret
raw personal data
full DB row
```

---

# 28. OCI Monitoring

Compute Monitoring에서 최소 다음을 본다.

```text
CPU utilization
Memory utilization
Load average
Disk IO
Network ingress/egress
Compute health
```

초기 alarm 예시는 baseline 측정 후 조정한다.

시작값 후보:

```text
CPU > 85% 지속
Memory > 85% 지속
instance health failure
```

일시적인 spike 하나만으로 Slack을 도배하지 않도록 지속 시간 조건을 둔다.

---

# 29. Filesystem 용량

100 GB volume을 application, PostgreSQL, Docker image, log가 공유한다.

따라서 filesystem full은 주요 장애 시나리오다.

OCI 기본/agent metric이 실제 `df` 기준 filesystem fullness와 동일하다고 가정하지 않는다.

필요하면 작은 custom metric을 둔다.

```text
filesystem_usage_percent
```

예:

```text
>= 80%
warning

>= 90%
critical
```

Prometheus/node_exporter를 이 목적만으로 도입하지 않는다.

---

# 30. OCI Logging

application structured stdout을 중앙에서 조회할 필요가 있으므로 OCI Logging 수집을 구성한다.

목표:

```text
Next.js structured JSON
→ Docker log
→ OCI log collection
→ OCI Logging
```

특히 다음을 확인할 수 있어야 한다.

```text
startup failure
container crash
unexpected server error
deploy 직후 runtime failure
```

Sentry를 대체하지 않는다.

---

# 31. Slack 채널

초기에는 두 채널로 분리한다.

```text
#oioi-deploy
#oioi-alerts
```

## #oioi-deploy

```text
CI image ready
deployment started
approval required
deployment succeeded
deployment failed
rollback succeeded
rollback failed
```

GitHub CI 결과는 GitHub Slack integration을 사용할 수 있다.

OCI CD 결과는 OCI Notifications를 사용한다.

deploy script가 직접 Slack webhook을 호출하지 않는다.

---

## #oioi-alerts

```text
instance unhealthy
sustained high CPU
sustained high memory
filesystem warning/critical
critical application/Sentry error
```

배포 이벤트와 운영 장애를 한 채널에 섞지 않는다.

---

# 32. Severity

최소 세 등급만 사용한다.

```text
INFO
WARNING
CRITICAL
```

예:

```text
deployment succeeded
= INFO

deployment failed but rollback succeeded
= WARNING

deployment failed and rollback failed
= CRITICAL
```

---

# 33. Dashboard

v1에서는 OCI Console Dashboard 하나만 만든다.

최소 표시:

```text
Compute health
CPU
Memory
Load
Disk IO
Network

filesystem usage if custom metric exists

recent alarms
recent infrastructure logs
```

application exception 분석은 Sentry에서 한다.

Sentry를 OCI Dashboard에 억지로 통합하지 않는다.

Dashboard 자체의 Terraform 자동화는 운영상 가치가 확인된 뒤 해도 된다.

v1에서는 manual console configuration을 허용한다.

---

# 34. Backup

PostgreSQL backup은 같은 VM disk에만 두지 않는다.

최소 구조:

```text
PostgreSQL
   ↓
pg_dump
   ↓
Object Storage
```

기존 운영 bucket과 host schedule은 유지하며 이 PR에서 생성하거나 교체하지 않는다. Terraform은
bucket을 data source/input으로만 조회한다. 실제 host 구성을 inventory한 뒤 Resource Manager import와
repository ownership 전환 필요성을 별도 결정한다.

---

# 35. Backup Credential

현재 운영 backup의 인증 방식은 inventory 전까지 unknown이다. 이 PR에서 새로운 bucket write IAM이나
static credential을 추가하지 않는다. 추후 repository/IaC ownership으로 편입할 때 Instance Principal과
bucket-scoped 최소 권한을 우선 검토한다.

---

# 36. Restore 검증

다음은 동일하지 않다.

```text
backup file exists
≠
restore 가능
```

운영 backup inventory 후 별도 단계에서 실제 restore test를 수행한다.

정기적으로 restore smoke를 반복할 수 있는 절차를 문서화한다.

현재 운영 backup의 failure signal과 notification 경로는 inventory에서 확인한다. 확인 전 신규 custom
metric/alarm을 병렬로 만들지 않는다.

---

# 37. 주요 Failure Scenario

## CI failure

```text
CI failed
→ image publish 없음
→ deployment 없음
```

현재 release 영향 없음.

---

## OCIR push failure

```text
push failed
→ candidate release 없음
→ deployment 없음
```

현재 release 영향 없음.

---

## DevOps deployment start failure

```text
OCI DevOps failure
→ Compute command 실행 없음
```

현재 release 영향 없음.

---

## Vault fetch failure

```text
secret fetch failure
→ env 교체 금지
→ candidate container start 금지
```

현재 release를 유지한다.

---

## OCIR pull failure

```text
image pull failure
→ current container 변경 금지
```

현재 release를 유지한다.

---

## Candidate health failure

```text
new container start
→ health/readiness failure
→ previous digest rollback
```

---

## Rollback failure

```text
candidate failed
+
previous release restoration failed
→ CRITICAL
→ Slack alert
→ manual SSH/runbook recovery
```

---

## PostgreSQL unavailable

```text
/healthz may remain alive
/readyz fails
```

DB 장애를 단순 application restart loop로 해결하려 하지 않는다.

PostgreSQL 상태와 application 상태를 구분한다.

---

## Disk full risk

```text
filesystem warning
→ Docker unused image 확인
→ log growth 확인
→ PostgreSQL growth 확인
→ backup artifact 확인
```

무조건적인 `docker system prune -a` 자동 실행은 금지한다.

---

# 38. Health Semantics

```text
/healthz
= process/application liveness

/readyz
= request serving readiness including PostgreSQL basic availability
```

외부 dependency 전체를 deep health check에 넣지 않는다.

health endpoint에서 secret/internal DB detail을 노출하지 않는다.

---

# 39. Smoke Test

deployment 완료 조건에 최소 smoke를 포함한다.

후보:

```text
public home
song detail
auth/session basic path
critical DB read
```

production data를 변경하는 destructive smoke를 기본으로 하지 않는다.

---

# 40. Infrastructure Change Workflow

Terraform 변경:

```text
local code change
→ PR review
→ merge
→ Resource Manager Plan
→ human review
→ Apply
```

application deploy와 infrastructure apply를 하나의 pipeline으로 묶지 않는다.

```text
Application release cadence
≠
Infrastructure change cadence
```

---

# 41. Secret Rotation Workflow

secret rotation도 application release와 분리한다.

```text
Vault new secret version
→ application compatibility 확인
→ runtime env refresh
→ restart if required
→ validation
```

image release와 secret rotation을 동시에 수행하지 않는 것을 기본으로 한다.

장애 발생 시 원인을 분리하기 위함이다.

---

# 42. 현재 도입하지 않는 것

다음은 현재 규모에서 과설계로 본다.

```text
OKE / Kubernetes

multi-node orchestration

Load Balancer solely for app deployment

blue/green deployment

rolling deployment

service mesh

Prometheus

Grafana

Loki

distributed tracing platform

automatic DB rollback

fully automatic destructive migration

Terraform module hierarchy explosion
```

트래픽/가용성 요구가 실제로 증가할 때 별도 architecture decision으로 검토한다.

---

# 43. M9 구현 순서

## M9-A — Architecture update

```text
01
11
12
M9 plan
00 index if necessary
```

GHCR 기준을 OCIR/OCI DevOps 기준으로 변경한다.

---

## M9-B — PR 73 normalization

PR 73의 유효한 요소는 유지한다.

```text
Next standalone Dockerfile
multi-stage build
non-root runtime
Docker Compose
/healthz
/readyz
external PostgreSQL network
multi-arch image
```

변경:

```text
GHCR
→ OCIR

direct/manual deploy assumptions
→ OCI DevOps / Run Command deploy

mutable tag assumption
→ immutable digest release
```

PR 74가 merge된 최신 `migration_develop`을 먼저 반영한다.

---

## M9-C — PostgreSQL privilege boundary

```text
admin
oioi_migrator
oioi_app
```

을 만들고 권한을 검증한다.

application이 관리자 credential 없이 정상 동작해야 한다.

integration test semantics를 깨지 않는다.

---

## M9-D — Terraform / Resource Manager

새 OCI resources부터 IaC로 만든다.

```text
OCIR
IAM
Vault infrastructure
DevOps
Notifications topic
Monitoring
Logging
existing Object Storage backup bucket lookup
```

기존 Compute/VCN을 수정하거나 import하지 않는다.

---

## M9-E — Instance Principal

Compute identity에 필요한 최소 권한을 부여한다.

예:

```text
OCIR read
runtime Vault secret-bundle read
Monitoring custom metric publish if used
Logging related permissions if required
```

DB admin/migrator secret 접근은 기본 권한에 포함하지 않는다.

---

## M9-F — Host prerequisites

Ubuntu에서 검증:

```text
Oracle Cloud Agent active
Run Command enabled
Docker active
Docker Compose active
OCI CLI if deploy helper requires it
docker-credential-ocir
Instance Principal authentication
```

---

## M9-G — OCI DevOps pipeline

```text
Deployment Pipeline
→ optional approval
→ Shell Stage
→ Run Command
→ deploy-release.sh
```

image digest를 required release input으로 사용한다.

---

## M9-H — Rollback proof

의도적으로 잘못된 release 또는 failing candidate를 사용해:

```text
candidate failure
→ previous digest restore
→ readiness recovered
```

를 실제 검증한다.

문서만 존재하는 rollback은 완료로 보지 않는다.

---

## M9-I — Observability

검증:

```text
OCI compute metrics
alarm
Slack Notification
Sentry
structured log
startup failure visibility
```

---

## M9-J — Existing Backup Inventory / Restore

```text
existing host script/timer/auth/retention inventory
→ existing Object Storage bucket 확인
→ safe import/ownership decision
→ separate restore proof
```

신규 backup system을 만들지 않는다.

---

# 44. DoD

다음이 모두 충족돼야 이 architecture를 완료로 본다.

```text
GitHub가 Compute에 직접 배포하지 않음

CI failure 시 image publish 안 됨

OCIR immutable digest release

OCI DevOps가 CD 소유

Ubuntu Run Command deployment 성공

CD에 SSH credential 필요 없음

Compute의 static OCIR password 없음

Vault runtime secret fetch가 Instance Principal 기반

Next.js는 PostgreSQL app user만 사용

admin DB credential이 application에서 완전히 제거됨

rollback 실제 검증

rollback failure alert 존재

structured logs / Sentry 정상

OCI Monitoring alarm 정상

Slack deploy notification 정상

Slack infrastructure alert 정상

existing VM backup remains externalized to existing Object Storage

restore 실제 검증

Terraform state에 application secret 없음

Terraform state에 Slack webhook 없음

기존 Compute/VCN accidental modification 없음
```

---

# 45. 금지 패턴

```text
GitHub Actions → SSH → production VM

GitHub Actions에 DB admin password 저장

GitHub Actions에 Vault runtime secrets 저장

Next.js가 admin/migrator DB user 사용

Next.js가 OCI Vault를 runtime request마다 직접 호출

latest tag를 production release identity로 사용

secret을 Terraform variable로 넣고 sensitive=true만 믿기

Slack webhook을 Terraform state에 저장

deploy script에서 Slack webhook 직접 호출

DB migration 실패 후 application deploy 진행

rollback 검증 없이 production cutover

existing OCI infrastructure를 첫 Terraform apply에서 전부 import/변경

모든 장애를 application restart로 처리

Prometheus/Grafana/Kubernetes를 현재 필요 없이 도입
```

---

# 46. 최종 Architecture

```text
                         GitHub
                           │
                 PR / Verify / Build
                           │
                      Docker Push
                           ▼
                          OCIR
                           │
                    immutable digest
                           │
                           ▼
                     OCI DevOps
                           │
                       Shell Stage
                           │
                           ▼
                  Compute Run Command
                           │
                           ▼
                    Ubuntu Compute
                  ┌────────┴────────┐
                  │                 │
               Caddy           Docker Compose
                                    │
                              Next.js container
                                    │
                              PostgreSQL 17


OCI Resource Manager
→ OCI infrastructure desired state

OCI Secret Management
→ runtime secret SSOT

Instance Principal
→ Compute OCI identity

OCI Monitoring / Logging
→ infrastructure observability

Sentry
→ application observability

OCI Notifications
→ Slack

Object Storage
→ PostgreSQL external backup
```

최종 책임 경계:

```text
GitHub
= 이 코드가 배포 가능한가?

OCIR
= 어떤 immutable artifact를 배포할 것인가?

OCI DevOps
= 언제 어떤 release를 배포할 것인가?

Compute
= release를 실제로 실행하는 곳

Vault
= runtime secret은 무엇인가?

PostgreSQL
= application data와 privilege boundary

Resource Manager
= OCI infrastructure는 어떤 상태여야 하는가?

Monitoring / Sentry
= 현재 시스템이 정상인가?
```

이 경계를 유지한다.
---

- OCI 공식 문서 기준으로 DevOps Shell Stage는 pipeline resource principal로 OCI CLI를 실행할 수 있고, Compute Run Command는 Oracle Cloud Agent가 관리하는 Linux VM에서 bash 명령을 실행할 수 있다. ([근거](https://docs.oracle.com/en-us/iaas/Content/devops/using/shell_stage.htm))
- Resource Manager는 Terraform state를 Stack별로 저장·lock하고 Plan/Apply를 관리한다.([근거](https://docs.oracle.com/en-us/iaas/Content/ResourceManager/Concepts/resource-manager-and-terraform.htm)) 
- OCIR의 Compute-side Instance Principal credential helper도 공식 지원된다.([근거](https://docs.oracle.com/en/learn/cred-helper/index.html)) 
- DevOps Notifications Topic과 Slack subscription 역시 공식 지원된다.([근거](https://docs.oracle.com/en-us/iaas/Content/devops/using/create_project.htm))
