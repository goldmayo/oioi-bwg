# M9 OCI host operations

이 디렉터리는 기존 Ubuntu Compute에 설치하는 host asset과 direct Run Command CD 경계를 관리한다.
최초 bootstrap과 긴급 복구는 operator SSH가 가능하지만 정상 release 경로는 SSH를 사용하지 않는다.

```text
feature/* → PR → migration_main (verify, 배포 없음)
migration_main → Promotion PR → migration_develop
  → full verify → ARM64 candidate publish → 동일 digest pull/container smoke → 검증 artifact
Promotion squash merge
  → source SHA/tree·merged tree·성공한 run/artifact 대조
  → 새 build/publish 없이 검증한 동일 digest 선택
  → OCI Run Command API → Oracle Cloud Agent / ocarun
  → deploy-release.sh <digest> → health/readiness/smoke → rollback 또는 release 상태 갱신
```

OCI DevOps Managed Build, Managed Shell, Events, Functions는 active CD 경로에 두지 않는다. 배포 때마다 별도
Container Instance나 build runtime을 만들지 않고 기존 Compute와 GitHub-hosted runner만 사용한다.

## 1. Install and configure

```bash
sudo ./ops/oci/install-host-assets.sh
sudoedit /etc/oioibawige/deploy.conf
sudoedit /etc/oioibawige/runtime-public.env
sudoedit /etc/oioibawige/runtime-secrets.env
sudo chmod 0600 /etc/oioibawige/{deploy.conf,runtime-public.env,runtime-secrets.env}
```

installer는 기존 protected config를 덮어쓰지 않는다. secret map에는 secret 값이 아니라 Vault secret
OCID만 기록한다. `DB_APP_PASSWORD`는 `oioi_app` credential이어야 하며 admin/migrator credential을 넣지
않는다.

`runtime-public.env`에는 server runtime 값을 기록한다. `NEXT_PUBLIC_*` 값은 GitHub environment에서 image
build input으로 주입되고 client와 server bundle에 포함되므로 host runtime 파일에 중복하지 않는다.

Docker credential은 `docker-credential-ocir` Instance Principal 방식으로 구성한다. static OCIR password나
Docker login token을 host에 저장하지 않는다.

## 2. Ubuntu Run Command gate

Oracle Cloud Agent 1.61.0부터 Ubuntu snap package에 Compute Run Command 지원이 추가됐다. M9는 Ubuntu
24.04에서 snap 기반 Oracle Cloud Agent 1.61.0 이상과 실제 secret-free probe 성공을 둘 다 activation gate로
사용한다.

```bash
sudo /srv/oioibawige/scripts/run-command-probe.sh
sudo /srv/oioibawige/scripts/preflight-host.sh
```

`preflight-host.sh`는 agent service, snap version, Docker/Compose, Instance Principal, protected file ownership,
실제 probe marker를 검사한다. probe가 실패하면 자동 CD를 활성화하지 않는다.

## 3. Release and rollback

GitHub Actions는 Promotion PR의 `candidate-<source SHA>-<run id>-<attempt>` tag로 이미지를 추적한다.
검증한 run artifact의 digest만 Run Command에 전달하며 tag를 다시 resolve하거나 merge 후 재build하지 않는다.
실제 release identity는 tag가 아니라 `<repository>@sha256:<digest>`다.

host의 `deploy-release.sh`는 다음을 수행한다.

```text
lock → Vault fetch → complete env validation → exact digest pull → Compose apply
→ health/readiness/smoke → atomic current/previous update
```

후보 실패 시 이전 env와 `current` digest를 복구한다. exit `20`은 candidate failure + rollback success,
exit `21`은 candidate failure + rollback failure다. DB migration/rollback은 이 script가 실행하지 않는다.

Run Command는 `ocarun`으로 실행되며 sudo 권한은 다음 두 명령에만 제한한다.

```text
/srv/oioibawige/scripts/deploy-release.sh *
/srv/oioibawige/scripts/run-command-probe.sh
```

GitHub deployment principal은 Run Command 발행/조회 권한만 가지며 Vault, DB, runtime secret을 읽지 않는다.
실제 Vault read와 OCIR pull은 기존 Compute Instance Principal이 수행한다.

## 4. PostgreSQL role cutover

먼저 local PostgreSQL 17 integration 검증을 통과시킨다. production 실행은 별도 승인된 privileged operation이며
admin URL과 두 password를 shell history에 쓰지 않는다.

```bash
M9_POSTGRES_ADMIN_URL='postgresql://...' \
M9_DB_MIGRATOR_PASSWORD='...' \
M9_DB_APP_PASSWORD='...' \
M9_PRODUCTION_CHANGE_ACK=I_UNDERSTAND_THIS_CHANGES_DATABASE_ROLES \
pnpm db:configure-runtime-roles -- --allow-production
```

완료 후 application Vault secret을 `DB_APP_PASSWORD`의 새 version으로 교체하고 deployment를 별도로 실행한다.
`DATABASE_URL`에는 `oioi_app`만 사용한다.

## 5. Filesystem metric and existing backup boundary

`oioi-bwg-alerts` Topic의 Slack subscription은 token이 Terraform state에 들어가지 않도록 Console에서 관리한다.
filesystem metric timer만 명시적으로 활성화한다.

```bash
sudo systemctl enable --now oioi-filesystem-metric.timer
sudo systemctl status oioi-filesystem-metric.timer
```

80% WARNING/90% CRITICAL alarm과 application Docker log rotation을 사용하며 자동 prune은 하지 않는다.
기존 PostgreSQL → OCI Object Storage backup은 repository 밖의 운영 자산이며 이 installer가 덮어쓰지 않는다.

## Evidence checklist

- Resource Manager plan/apply OCID와 reviewed change summary
- Oracle Cloud Agent snap version과 Ubuntu Run Command probe evidence
- OCIR image repository, Git SHA tag, manifest digest
- GitHub Actions deploy run과 Run Command OCID/result
- candidate failure와 rollback recovery evidence
- app role runtime smoke 및 admin credential 부재 확인
- filesystem alarm test와 Slack delivery timestamp
- application test log의 OCI Logging Search 결과

secret value, auth token, API signing private key, webhook URL, full `DATABASE_URL`은 evidence에 기록하지 않는다.

## 6. Migration branch 및 GitHub 수동 설정

정책 SSOT는 [active 배포 runbook §21](../../docs/migration/oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md#21-cicd)이다.
일반 작업은 최신 `migration_main`에서 분기하여 PR/squash로 통합한다. 배포는 별도 `migration_main → migration_develop`
Promotion PR만 사용한다. main/production 정책과 host의 Vault/DB/rollback 경계는 변경하지 않는다.

- `migration_main`: PR required, required `verify`, direct/force push 금지, stale approval 재검토.
- `migration_develop`: 기존 PR/force-push/verify ruleset에 required `promotion`과 최신 head/base 검사·stale approval 재검토를 추가한다.
- `oci-development-image` Environment: 기존 `migration_develop`에 더해 branch pattern `refs/pull/*/merge`를 허용한다.
  credential을 사용하는 PR job은 동일 저장소 `migration_main → migration_develop`에서만 실행된다.
- 후보 기록은 GitHub Actions artifact `promotion-<source SHA>-<attempt>`의 `candidate.json`이다.
  보관 90일 안에 merge하며, 삭제/만료/미완료 run/다른 tree는 배포 실패로 처리한다.
- repository의 squash-only 전략을 유지한다. 테스트 merge tree와 실제 squash tree 모두 source tree와 같아야 한다.
  일치하지 않으면 source를 먼저 갱신하고 PR 검증을 다시 수행한다.
- base를 바꾼 PR은 새 synchronize/reopen 실행에서 검증한다. 제목·본문 수정만으로 candidate를 다시 build하지 않는다.
- `Deploy promotion` run summary에 source/tree·merge SHA·candidate run/attempt·exact digest가 남는다.
  실제 배포 상태는 host current digest와 성공한 health/readiness/smoke가 기준이다. merge만으로 성공을 간주하지 않는다.

2026-10-05 관찰: `migration_develop`에는 활성 ruleset의 PR required/verify/force-push 금지가 있다.
신규 `migration_main` protection, `promotion` required check와 Environment의 PR ref 허용은 수동 설정 항목이다.
#106은 배포 head `10ebc91`에서 생성한 `migration_main`으로 재지정했다. 이 전환은 P01을 merge하거나 OCI 배포하지 않는다.
