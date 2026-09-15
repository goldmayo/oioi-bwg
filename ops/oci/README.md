# M9 OCI host operations

이 디렉터리는 기존 Ubuntu Compute에 설치하는 host asset과 direct Run Command CD 경계를 관리한다.
최초 bootstrap과 긴급 복구는 operator SSH가 가능하지만 정상 release 경로는 SSH를 사용하지 않는다.

```text
migration_develop merge
→ GitHub Actions verify
→ linux/arm64 image build
→ OCIR push
→ sha256 manifest digest 확정
→ GitHub Actions에서 OCI Run Command API 호출
→ Ubuntu Oracle Cloud Agent / ocarun
→ sudo /srv/oioibawige/scripts/deploy-release.sh <digest>
→ health / smoke / rollback
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

GitHub Actions는 OCIR `git-<full-sha>` tag에서 manifest digest를 확정한 뒤 그 digest만 Run Command에 전달한다.
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
