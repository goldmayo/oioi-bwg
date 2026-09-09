---
title: "M9 OCI CI/CD 및 운영 기반 구현 결과"
document_id: "M9-CICD-OCI-OPERATIONS-RESULT"
version: "1.0"
status: "active"
authority: "result"
updated_at: "2026-09-10"
source:
  repository: "goldmayo/oioi-bwg"
  branch: "migration_m9-oci-dev-runtime"
  commit: "029d280db82c1d60c2de82fafb51c6ef85cde782"
verified_at: "2026-09-10"
depends_on:
  - "M9-CICD-OCI-OPERATIONS-PLAN"
related:
  - "01"
  - "11"
  - "12"
  - "M9-OCI-DEVELOPMENT-RUNTIME-PLAN"
---

# M9 OCI CI/CD 및 운영 기반 구현 결과

## 판정

Repository 구현과 local 검증은 완료했다. M9 전체 상태는 **OCI activation 및 production evidence
대기**다. `M9-CICD-OCI-OPERATIONS-PLAN`의 Definition of Done은 실제 OCI 배포, rollback, 알림,
backup/restore 증적까지 요구하므로 이 문서는 M9를 운영 완료로 판정하지 않는다.

Production credential, OCI resource, 기존 Compute/VCN, 운영 PostgreSQL에는 접근하거나 변경하지 않았다.

## 기준과 재구성 provenance

- authority plan: [`M9-CICD-OCI-OPERATIONS-PLAN.md`](../M9-CICD-OCI-OPERATIONS-PLAN.md)
- 재구성 기준: `origin/migration_develop`
  `3a28f6ac8c772b5c7d130f957790b165690008aa` (`refactor(server): persistence 오류 경계 분리 (#74)`)
- 재구성 전 PR 73 head: `9e04ce22d636f7dc66df57218371144c06c8292f`
- local 검증 source: `migration_m9-oci-dev-runtime`
  `029d280db82c1d60c2de82fafb51c6ef85cde782`
- PR: [#73](https://github.com/goldmayo/oioi-bwg/pull/73)

## 실제 변경

### Architecture와 기존 PR 정상화

- 구현 전에 Architecture Constitution 01의 GHCR 고정 문구를 OCIR, OCI DevOps, digest release,
  Resource Manager, Vault/Instance Principal 경계로 개정했다.
- 00 index와 runtime architecture 11, deployment runbook 12를 같은 변경 단위에서 갱신했다.
- PR 73의 standalone multi-stage image, non-root runtime, external PostgreSQL network,
  `/healthz`, `/readyz`, multi-architecture build 요소는 최신 base 위에 다시 구성했다.
- 기존 GHCR publish와 GitHub 직접 배포 가정은 제거했다. `migration_develop` push의 Verify가 성공한
  뒤에만 OCIR immutable SHA tag를 publish하며 release identity는 manifest digest다. 동일 commit의
  workflow 재실행은 기존 immutable tag의 digest를 재사용한다.

### PostgreSQL 권한 경계

- `admin -> oioi_migrator -> oioi_app` 경계를 구성하는 명시적 role bootstrap을 추가했다.
- `oioi_app`은 DML과 sequence 사용 권한만 가지며 schema CREATE, ownership, superuser/role/database
  관리 권한을 갖지 않는다.
- public application object와 Drizzle metadata object/schema의 ownership을 migrator로 이관하고,
  migrator가 이후 생성하는 public table/sequence의 default privilege를 app role에 설정한다.
- production 실행은 `--allow-production`과 별도 acknowledgement가 모두 있어야 하는 explicit
  privileged operation으로 남겼다. 일반 application deploy는 DB migration을 실행하지 않는다.

### OCI infrastructure와 host operation

- `infra/oci` 단일 Resource Manager root stack에 private immutable OCIR, Vault/key infrastructure,
  exact Compute/DevOps dynamic group과 policy, DevOps Shell Stage, 두 Notification Topic, Monitoring alarm,
  OCI Logging, KMS/versioning Object Storage backup bucket을 정의했다.
- 기존 Compute, VCN, subnet은 data source/input으로만 참조한다. 실제 secret value와 Slack webhook은
  Terraform에 넣지 않는다.
- DevOps command spec은 `IMAGE_DIGEST`만 받아 Compute Run Command로 host deploy script를 호출한다.
- host deploy는 lock, digest와 protected file 검증, Instance Principal Vault fetch, atomic env 교체,
  OCIR pull, health/readiness/smoke, current/previous state 전환, 실패 시 이전 digest/env rollback을 수행한다.
- backup은 `pg_dump` custom format 검증 후 Object Storage에 업로드하고 success/failure custom metric을
  게시한다. restore는 canonical object name, empty target, explicit remote acknowledgement,
  single transaction, 복원 후 table count를 검증한다.
- Ubuntu Run Command는 문서만으로 지원을 가정하지 않고 실제 secret-free probe marker가 있어야
  host preflight가 통과하도록 했다.

## 구현 commit

1. `5959286a975147eb55ab32cf45909226bbf26f01` — Constitution 및 active architecture 전환
2. `b8fbd78c07cefe121a2ecd914717712db0e76de1` — PR 73 OCI runtime image 재구성
3. `77a2c268744b73f6c93d93726a1413ea81301ad9` — PostgreSQL runtime role 경계
4. `7ab9e13e6b67329ca6e7432347f56ef21f930df8` — OCI Resource Manager stack
5. `a0c5ce416ea5c953e808a1a493454e5b341dbdd1` — OCIR immutable tag 재실행 보호
6. `ff2d6a7ab07252e3d7f1753f2ae38911a6a6591a` — Drizzle metadata ownership
7. `2ac2399ce852d27d4fe0f76b44222ddc9c87fff2` — deploy/alert Notification Topic 분리
8. `db2797ccc8ade4c7ff872fec7add6bf4cbca8a9c` — digest deploy와 rollback
9. `029d280db82c1d60c2de82fafb51c6ef85cde782` — host preflight와 backup/restore

## 실제 검증

- `pnpm verify`
  - type-check, ESLint, Steiger 통과
  - architecture harness 8 tests 통과
  - unit 49 files / 198 tests 통과
  - deploy operation 1 file / 4 tests 통과
- `pnpm test:integration:postgres:local`
  - Docker PostgreSQL major 17에서 migration 적용
  - 제한된 임시 app role로 1 file / 9 tests 통과
  - 임시 DB connection/advisory lock 0건 확인 후 DB와 임시 role 삭제
- `pnpm format:check` 통과
- `NEXT_PUBLIC_APP_ENV=staging pnpm build` 통과
  - `/healthz`, `/readyz`, `/sitemap.xml`이 dynamic route임을 확인
- Terraform 1.13.5, OCI provider 8.29.0
  - backend 없는 local init은 provider/schema 정적 검증 목적으로만 수행
  - `terraform -chdir=infra/oci fmt -check -diff` 통과
  - `terraform -chdir=infra/oci validate` 통과
  - Plan/Apply는 실행하지 않음
- `bash -n ops/oci/*.sh` 통과
- 실제 Compose 파일의 `docker compose ... config --quiet` 통과
- `docker build --build-arg NEXT_PUBLIC_APP_ENV=staging --tag oioi-bwg:m9-pr73-final .` 통과
  - runtime user `node`/UID 1000과 native `argon2` load 확인
- local container runtime smoke
  - 정상 PostgreSQL 연결: `/healthz` 200 `{"status":"ok"}`, `/readyz` 200
    `{"status":"ready"}`
  - 잘못된 PostgreSQL 연결: `/readyz` 503 `{"status":"unavailable"}`

Mock deploy test는 atomic state 전환, candidate failure 후 이전 digest/env 복구, rollback 자체 실패의
별도 CRITICAL 상태, sudoers wildcard를 통한 추가 인자 거부를 검증한다. 이는 실제 OCI rollback
evidence를 대체하지 않는다.

## 계획 대비 차이와 이유

- OCI Dashboard는 plan이 허용한 manual Console 구성으로 남겼다. 실제 metric/log가 수집된 뒤 layout을
  확정해야 빈 dashboard를 코드로 고정하지 않을 수 있다.
- Slack subscription endpoint는 token이 Terraform state에 들어가지 않도록 deploy/alert Topic 생성과
  분리했다. subscription 자체는 secure manual configuration 대기다.
- Ubuntu는 Oracle의 공식 Run Command 지원 platform image 목록에 명시되어 있지 않다. 따라서
  Oracle Cloud Agent 설치만으로 성공을 판정하지 않고 실제 target instance probe를 activation gate로
  추가했다.
- GitHub에서 OCI DevOps deployment를 자동 시작하지 않는다. plan의 v1 manual release gate를 유지해
  GitHub CI principal에 Compute, Run Command, Vault 권한을 추가하지 않았다.

## OCI activation 및 production evidence 대기

다음 항목은 repository code나 mock으로 완료 처리할 수 없다.

1. Resource Manager Stack 생성, Plan review, Apply job OCID와 기존 Compute/VCN 변경 0건 증적
2. Vault runtime secret secure bootstrap, exact secret OCID 반영, IAM propagation 확인
3. GitHub `oci-development-image` environment 설정과 실제 multi-architecture OCIR publish/digest 기록
4. 대상 Ubuntu의 secret-free Compute Run Command probe와 command OCID/output
5. host asset bootstrap, Instance Principal 및 `docker-credential-ocir` 실제 pull 검증
6. 승인된 production PostgreSQL role cutover와 admin credential의 application 제거 확인
7. OCI DevOps의 정상 digest deployment, 의도적 candidate failure, 실제 이전 digest rollback 복구
8. deploy/alert Slack subscription 전달, alarm test, OCI Logging ingestion, staging Sentry event
9. Object Storage backup object 생성과 별도 빈 PostgreSQL 17 database restore 검증

이 증적이 모두 연결되기 전에는 M9 status를 `completed`로 변경하지 않는다.
