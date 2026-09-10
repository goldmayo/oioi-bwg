# M9 OCI host operations

이 디렉터리는 기존 Ubuntu Compute에 수동 bootstrap하는 host asset이다. GitHub Actions는 이 파일을
host에 설치하거나 실행하지 않는다. 최초 설치는 emergency/manual SSH 세션에서 수행하고 이후 release는
OCI DevOps → Shell Stage → Compute Run Command만 사용한다.

## 1. Install and configure

```bash
sudo ./ops/oci/install-host-assets.sh
sudoedit /etc/oioibawige/deploy.conf
sudoedit /etc/oioibawige/runtime-public.env
sudoedit /etc/oioibawige/runtime-secrets.env
sudo chmod 0600 /etc/oioibawige/{deploy.conf,runtime-public.env,runtime-secrets.env}
```

installer는 기존 protected config를 덮어쓰지 않는다. secret map에는 secret 값이 아니라 Vault secret
OCID만 기록한다. `DB_APP_PASSWORD`는 `oioi_app` credential이어야 하며 admin/migrator credential을
넣지 않는다.

Docker credential은 Oracle의 `docker-credential-ocir` Instance Principal 방식으로 구성한다. static
OCIR password나 Docker login token을 host에 저장하지 않는다.

## 2. Ubuntu Run Command activation gate

Oracle의 공식 Run Command 지원 platform image 목록은 Ubuntu를 명시하지 않는다. Oracle Cloud Agent
설치 여부만으로 성공을 가정하지 말고 OCI Console에서 대상 instance에 다음 secret-free command를
실제로 전달한다.

```bash
sudo /srv/oioibawige/scripts/run-command-probe.sh
```

성공 output과 command OCID를 evidence에 기록한 뒤 host에서 검사한다.

```bash
sudo /srv/oioibawige/scripts/preflight-host.sh
```

probe가 성공하지 않으면 OCI DevOps pipeline을 활성화하지 않는다. 이 경우 지원되는 platform image로의
전환 또는 다른 SSH-less execution boundary를 별도 architecture decision으로 다룬다.

## 3. Release and rollback

OCI DevOps Console에서 GitHub summary에 기록된 image의 `sha256:<64 hex>` 부분만 `IMAGE_DIGEST`에
입력한다. Shell Stage는 secret 없이 Run Command를 만들고 host script는 다음을 수행한다.

```text
lock → Vault fetch → complete env validation → OCIR pull → Compose apply
→ health/readiness/smoke → atomic current/previous update
```

후보 실패 시 이전 env와 `current` digest를 복구한다. exit `20`은 candidate failure + rollback success,
exit `21`은 candidate failure + rollback failure(CRITICAL)다. DB migration/rollback은 이 script가 실행하지
않는다. Shell Stage는 Run Command execution의 lifecycle, remote exit code와 output을 조회해 OCI DevOps
log에 남기고 exit code를 그대로 반환한다. Exit `21`은 기존 alert Notification Topic에 CRITICAL
message도 게시한다. Secret marker를 포함한 remote output은 전체를 redaction한다.

## 4. PostgreSQL role cutover

먼저 local PostgreSQL 17 integration 검증을 통과시킨다. production 실행은 별도 승인된 privileged
operation이며 admin URL과 두 password를 shell history에 쓰지 않는다.

```bash
M9_POSTGRES_ADMIN_URL='postgresql://...' \
M9_DB_MIGRATOR_PASSWORD='...' \
M9_DB_APP_PASSWORD='...' \
M9_PRODUCTION_CHANGE_ACK=I_UNDERSTAND_THIS_CHANGES_DATABASE_ROLES \
pnpm db:configure-runtime-roles -- --allow-production
```

완료 후 application Vault secret을 `DB_APP_PASSWORD`의 새 version으로 교체하고 deployment를 별도로
실행한다. `DATABASE_URL`에는 `oioi_app`만 사용한다.

## 5. Filesystem metric and existing backup boundary

`oioi-bwg-deploy`, `oioi-bwg-alerts` Topic에 각각 `#oioi-deploy`, `#oioi-alerts` Slack subscription을
수동 연결한 뒤 filesystem metric timer만 명시적으로 활성화한다. 80% WARNING/90% CRITICAL alarm과
application Docker log rotation을 함께 사용하며 자동 prune은 하지 않는다.

```bash
sudo systemctl enable --now oioi-filesystem-metric.timer
sudo systemctl status oioi-filesystem-metric.timer
```

Production Ubuntu VM에는 repository 밖에서 관리 중인 기존 PostgreSQL -> OCI Object Storage backup이
있다. 이 repository의 host installer는 backup script/timer를 설치하거나 기존 설정을 덮어쓰지 않는다.
다음을 실제 VM에서 inventory하기 전에는 신규 schedule, bucket, IAM, metric/alarm을 추가하지 않는다.

```text
existing script와 systemd unit/timer
existing bucket name과 retention/versioning/encryption
backup authentication과 최소 권한
failure notification과 최근 성공 evidence
```

기존 bucket은 Terraform input/data source로만 조회한다. 삭제·재생성·이름 변경·import는 이 단계에서
하지 않는다. Restore proof는 inventory 후 production DB가 아닌 별도 PostgreSQL 17 target에서 검증한다.

Application `restart: unless-stopped`는 유지한다. Healthcheck의 `unhealthy`만으로 Docker가 container를
자동 restart하지는 않는다. Runtime health failure는 external monitoring -> alert -> operator
investigation으로 처리하며 외부 HTTPS monitor는 Caddy/production endpoint activation 이후 구성한다.
Application memory limit은 activation baseline 전에는 정하지 않는다.

## Evidence checklist

- Resource Manager job/plan/apply OCID와 reviewed change summary
- Ubuntu Run Command probe command OCID/output
- OCIR image full repository, Git SHA tag, manifest digest
- OCI DevOps deployment OCID, input digest, result
- candidate failure와 rollback recovery evidence
- app role runtime smoke 및 admin credential 부재 확인
- filesystem alarm test와 Slack delivery timestamp
- application test log의 OCI Logging Search 결과
- existing PostgreSQL container log rotation 확인
- existing backup inventory와 별도 restore proof

secret value, auth token, webhook URL, full `DATABASE_URL`은 evidence에 기록하지 않는다.
