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
  → deploy-release.sh <Web digest> <Console digest> <base64url candidate> → health/readiness/smoke → rollback 또는 release 상태 갱신
```

OCI DevOps Managed Build, Managed Shell, Events, Functions는 active CD 경로에 두지 않는다. 배포 때마다 별도
Container Instance나 build runtime을 만들지 않고 기존 Compute와 GitHub-hosted runner만 사용한다.

## 1. Install and configure

설치 전 root 실행 경로의 전체 상위 경로를 확인한다. installer는 runtime·scripts·deploy·config와
각 ancestor가 root 소유·group/other 쓰기 금지인 일반 디렉터리인지 **첫 mkdir/lock 전에** 검사한다.
기존 설치 대상과 lock의 symlink/hardlink·비보호 파일도 거절한다. preflight도 같은 디렉터리 조건을
Docker/OCI 호출 전에 확인하며 필요한 경로가 없으면 실패한다.

```bash
sudo namei -l /srv/oioibawige/scripts/deploy-release.sh
sudo stat -c '%U:%G %a %n' /srv/oioibawige /srv/oioibawige/scripts /srv/oioibawige/deploy /etc/oioibawige
```

B0 기록의 사용자 소유 경로가 남아 있으면 설치를 중단한다. 운영자는 실행 중인 작업·보호 파일·기존
backup과 경로의 용도를 검토한 후 필요한 디렉터리만 별도 승인으로 보호해야 한다. installer는 기존
비보호 경로를 자동 chown/chmod하지 않으며 recursive 소유권 변경·symlink 경유 설치도 하지 않는다.
검토가 끝난 보호 경로에서만 다음 설치를 실행한다.

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
→ paired health/readiness/smoke → atomic current-pair update
```

후보 실패 시 `current-pair` snapshot의 두 env/config/digest를 복구한다. exit `20`은 candidate failure + rollback success,
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

### Console MFA reset 및 운영 role/status 변경 (P05-B3)

운영 role/status 변경은 `pnpm console:mfa account-access`를 유일한 승인 절차로 사용한다.
Account 변경과 Console version 회수는 하나의 transaction이며 재승격/복귀에도 증가한다.
수동 UPDATE나 회수 후 별도 role/status 변경 절차를 사용하지 않는다. 현재 CLI는 **local Compose 검증 전용**이다.
production host/Vault 실행은 별도 승인과 P06 host guard 검증 전까지 열지 않는다. `ocarun`/HTTP에 권한을 추가하지 않는다.
loopback URL/DB identity 검사는 오접속을 줄이는 guard이며 SSH 포트 포워딩을 통한 production 접근 차단을 보장하지 않는다.
P06에서 local/production credential 분리와 실제 네트워크·호스트 접근 통제를 별도로 검증한다.

승인된 POSIX operator에게만 app credential과 설정 파일 읽기 권한을 준다. OS 계정 공유를 피하고,
`umask 077`로 `.local/console-mfa-operator.json`을 생성하여 operator 소유·0600·단일 일반 파일로 관리한다.
CLI는 UID/소유권/permission을 검사하며 symlink/hardlink, ambient DATABASE_URL/Web dotenv를 허용하지 않는다.
설정은 `{ "scope": "local-compose", "operatorUid": <id -u>, "databaseUrl": "<local app URL>",
"serverStartedAt": "<검증한 DB 시작 epoch>" }`다. 실제 credential을 argv/history/리뷰에 적지 않는다.
대상 URL은 `127.0.0.1:5432/oioibawige`의 `oioi_app`만 허용한다(격리 runner의 test DB/role은 별도 허용).
DB 시작 epoch는 다음 secret-free 조회 결과를 기록한다. 재시작 후에는 대상을 다시 확인하고 설정을 갱신한다.

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U oioibawige -d postgres -Atc 'select extract(epoch from pg_postmaster_start_time())::text'
pnpm console:mfa mfa-reset --config .local/console-mfa-operator.json --account-id 104 --expected-version 3 --reason-file .local/operator-reason.txt --apply
pnpm console:mfa account-access --config .local/console-mfa-operator.json --account-id 104 --expected-version 4 --expected-role ADMIN --expected-status ACTIVE --role USER --status ACTIVE --reason-file .local/operator-reason.txt --apply
```

사유는 operator 소유·0600의 `.local/operator-reason.txt`에 비어 있지 않은 200자 이하로 작성한다.
argv에는 파일 경로만 전달하여 pnpm의 명령 echo에도 사유 원문이 나오지 않게 한다.
실행 전 접근 통제된 변경 승인 티켓에 사유와 승인자를 보존하고, 실행 후 같은 티켓에 operator UID·UTC 실행 시각·
대상 Account·CLI 결과(전후 role/status/version·성공 여부)를 첨부해 해당 실행과 사유를 연결한다. 실패도 같은 티켓에 기록한다.
`--reason-file` 검사는 입력 확인이며 영속 감사 저장이 아니다. 티켓에 사유/결과를 보존하지 않은 실행은 승인 절차를 충족하지 않는다.
실행 전 대상 id/role/status/version만 조회·검토한다. MFA 행 없음은 `--expected-version none`이며 기대값이 다르면 중단한다.
ACTIVE/SUSPENDED만 변경하며 가입 활성화·탈퇴/복구의 개인정보 정책을 우회하지 않는다.
출력은 대상·전후 role/status/version·성공 여부 또는 고정 실패 코드뿐이다. secret/OTP/비밀번호/사유 원문을 기록하지 않는다.
실패 시 최신 상태를 재조회하며 자동 재시도하지 않는다. SQL 오류·connection URL·stack을 evidence에 남기지 않는다.
reset 순서는 **Console 접근 제한 → CLI reset → 기존 세션 거절 확인 → 제한된 재등록 → 재공개**다.
실제 JWT 거절/QR 전용 secret 취급은 P05-C/D, 공개 HTTPS 운영 smoke는 P06에서 검증한다.
Web 전체 Session 회수와 runtime app role/owner/migrator의 직접 SQL 우회 차단은 이 절차로 완료되지 않는다.

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

- `migration_main`: PR required, required `verify`, 최신 base 포함 검증(strict), direct/force push 금지, stale approval 재검토.
- `migration_develop`: 기존 PR/force-push/verify ruleset에 required `promotion`과 최신 base 포함 검증(strict)·stale approval 재검토를 추가한다.
- `oci-development-image` Environment: 기존 `migration_develop`에 더해 branch pattern `refs/pull/*/merge`를 허용한다.
  credential을 사용하는 PR job은 동일 저장소 `migration_main → migration_develop`에서만 실행된다.
- 후보 기록은 GitHub Actions artifact `promotion-<source SHA>-<attempt>`의 `candidate.json`이다.
  공통 PR/source SHA/tree/run/attempt는 조합 검증 출처이며 `images.web`·`images.console`에 repository/digest/buildSourceSha/origin을 기록한다.
  보관 90일 안에 merge하며, 단일 이미지 이전 형식·한쪽 누락·다른 registry·삭제/만료/미완료 run/다른 tree는 거절한다.
  `oci-development-image`의 추가 variable `OCIR_CONSOLE_REPOSITORY`는 B0에서 검증한
  Console repository 이름 `oioi-bwg-console`로 설정한다. 2026-10-15 최초 조회에서는 미등록이었으며,
  사용자 #147 병합·다음 작업 지시 후 등록하고 저장 값을 대조했다.
  B1은 두 게시 digest smoke 후에만 artifact를 생성한다. B1 당시 B2와 승인된 host upgrade 전 배포 workflow는
  후보 summary 이후 OCI 인증/Run Command 전에 실패하므로 Promotion을 병합하지 않는다.
- B2-1의 CI adapter 호출은 `bash ops/oci/deploy-via-run-command.sh <Web digest> <Console digest> <base64url candidate>`다.
  두 digest와 candidate schema를 OCI 전 대조하고 host에서도 검증한다. B2 host upgrade·설정·DB 준비의
  실제 결과를 확인한 뒤 임시 차단을 코드 리뷰로 제거한다. 실제 배포는 별도 승인된 Promotion으로 실행한다.
  Actions 로그에는 원격 body/agent message/OCI 오류 원문을 출력하지 않으며 host 로그는 보호된 경로에서 조사한다.
- B2-2의 `materialize-runtime-env.py <web|console> <public env> <secret map> <temporary output>`은
  앱별 Vault CURRENT 값을 검증해 0600 raw env를 만든다. DB 좌표는 기존 `deploy.conf` 값을 전달한다.
  paired deploy가 이 helper로 두 env를 만들고 installer/preflight도 helper 파일을 포함한다.
  Console 입력 예시는 `console-runtime-{public,secrets}.env.example`이다. installer는 Console 설정을 생성/덮어쓰지 않는다.
  두 env의 서비스 적용·pair state·복구·최초 전환은 아래 B2 paired host 계약을 따른다. 실제 host 설치는 별도 승인이다.
- repository의 squash-only 전략을 유지한다. 테스트 merge tree와 실제 squash tree 모두 source tree와 같아야 한다.
  일치하지 않으면 source를 먼저 갱신하고 PR 검증을 다시 수행한다.
- base를 바꾼 PR은 새 synchronize/reopen 실행에서 검증한다. 제목·본문 수정만으로 candidate를 다시 build하지 않는다.
- `Deploy promotion` run summary에 source/tree·merge SHA·candidate run/attempt·exact digest가 남는다.
  실제 배포 상태는 host current-pair와 성공한 health/readiness/smoke가 기준이다. merge만으로 성공을 간주하지 않는다.

2026-10-05 관찰: `migration_develop`에는 활성 ruleset의 PR required/verify/force-push 금지가 있다.
기존 strict 검사는 꺼져 있고 `allow_update_branch=false`다. 신규 `migration_main` protection,
두 브랜치의 strict 검사, `promotion` required check와 Environment의 PR ref 허용은 수동 설정 항목이다.
#106은 배포 head `10ebc91`에서 생성한 `migration_main`으로 재지정했다. 이 전환은 P01을 merge하거나 OCI 배포하지 않는다.
#107 병합과 보호 설정 적용 후 #106 작업 브랜치에 최신 `migration_main`을 merge/rebase하여 push한다.
충돌을 해결하고 새 CI가 모두 성공한 뒤 #106을 병합한다. #107을 포함하지 않은 기존 성공 CI로 바로 병합하지 않는다.

2026-10-06 적용: #107을 `440d9ed`로 병합하고 `migration_main` ruleset `24512028`을 생성했다.
기존 `migration_develop` ruleset `22798840`에도 strict 검사와 required `promotion`을 적용했다.
두 ruleset은 PR/필수 검사/force-push 금지와 stale approval 재검토를 적용하며 bypass actor가 없다.
Environment에는 기존 development branch를 유지하면서 `refs/pull/*/merge` 정책 `62037752`를 추가했다.

## 7. P06 Metadata 차단

실제 VM 적용은 [B0 계획](../../docs/migration/implementation/console-guide-editor/P06-B0-PLAN.md)의
B0-1 승인 작업이다. 기존 SSH에서 nft/iptables backend·forward/flowtable·firewall reload 규칙,
Docker unit/drop-in·live-restore와 Web container를 선택 조회한다. env/inspect 전체는 출력하지 않는다.
probe는 mount·추가 capability·privileged가 없는 bridge container만 허용한다.
이 조건과 맞지 않거나 forwarded IMDS가 필요한 다른 workload가 있으면 적용 전에 변경안을 재검토한다.

승인할 변경은 `/usr/local/lib/oioi-metadata-guard/`의 `metadata-guard.py`·`metadata-probe.mjs`,
`/etc/systemd/system/oioi-metadata-guard.service`, Docker의 `50-oioi-metadata-guard.conf` drop-in,
`inet oioi_metadata_guard` table뿐이다. 기존 파일·전용 table·unit의 root 소유 복구 사본을 보존하고
SSH 복구 경로와 maintenance 범위를 확인한다.
root 실행 파일은 root 소유·group/other 쓰기 금지인 상위 경로에만 설치한다. installer는 symlink,
사용자 소유/쓰기 가능 디렉터리와 기존 비보호 파일을 변경 전에 거절한다. 기존 `/srv/oioibawige`
디렉터리의 소유권·권한은 이 installer가 변경하지 않는다. 표준 `docker.service`와 nft/Node 지원이 필요하다.
다음 명령은 **적용 승인 후** 같은 VM에서 실행한다.

```bash
sudo bash ops/oci/install-metadata-guard.sh --apply
sudo python3 -I /usr/local/lib/oioi-metadata-guard/metadata-guard.py check
sudo python3 -I /usr/local/lib/oioi-metadata-guard/metadata-guard.py probe <existing-web-container>
```

일반 installer·deploy에는 연결하지 않았다. 이 installer는 Docker를 재시작하거나 앱을 재배포하지 않는다.
guard는 전용 table만 한 nft transaction으로 갱신하고 host OUTPUT을 건드리지 않는다.
Docker 시작은 guard에 의존하며 table drift가 있으면 시작 전 검사에서 실패한다. guard stop은 deny를 남긴다.
규칙이 없으면 operator가 원인을 해결해 `apply`한 뒤 Docker 시작을 재시도한다. backend 변경·전체 flush는 하지 않는다.
기본 `nftables.service`의 global flush 설정을 유지한 채 이를 활성화·재시작·reload/stop하지 않는다.
해당 관리 서비스의 lifecycle 변경은 guard 영향을 따로 검토하며 전용 guard service만 사용한다.
[nft 원자적 갱신](https://wiki.nftables.org/wiki-nftables/index.php/Atomic_rule_replacement),
[systemd 의존성](https://github.com/systemd/systemd/blob/main/man/systemd.unit.xml).

probe는 host의 v2 metadata/cert/key HTTP 200, container의 v1/v2 여섯 경로 차단, counter 증가,
동일 시점 host 성공을 확인한다. body·원문 오류를 버리고 고정 event만 출력한다.
401/404/5xx·counter 증가 없는 timeout은 실패다. 실제 Instance Principal pull/Secret 성공,
Web readiness·DNS/일반 outbound, container 재생성·Docker/VM 재시작·이전 Web 복구 후 재검증은
별도로 기록한다. probe event만으로 B0 완료 판정하지 않는다.

새 Console grant 전 장애는 새 IAM 작업을 중단하고 이전 guard 파일/전용 table을 복구해 다시 검사한다.
새 Secret grant 이후에는 deny를 제거하지 않는다. 차단을 유지할 수 없으면 앱 접근을 제한·중지하고
승인된 Console Secret grant 회수·검증부터 진행한다. 기존 Web 권한과 다른 firewall 규칙은 보존한다.
운영 실행·비공개 증적은 B0 RESULT/기존 Notion에 기록한다. 실제 두 앱의 최종 검증은 B2에 남긴다.

## 8. P06-B0 권한 probe

> **완료된 과거 절차 — 2026-10-21 자동 실행 경로 폐기.** 아래는 B0 당시의 실행 이력 설명이다.
> 실제 통과 증거는 [B0 결과](../../docs/migration/implementation/console-guide-editor/P06-B0-2-RESULT.md)가 소유한다.
> `B0 publish probe` job과 `p06-b0-command` workflow는 제거했으므로 label을 추가해 재실행하지 않는다.
> 현재 release는 이 문서 §3·§6의 정상 Promotion을 따른다. helper와 기존 증거는 보존한다.

[B0 계획](../../docs/migration/implementation/console-guide-editor/P06-B0-PLAN.md)의 실제 Web 차단·
재시작 증거와 검토한 Stack Plan/Apply·게시 정책 교체를 완료한 뒤, 별도 승인된 probe만 실행한다.
일반 feature PR은 OCI credential을 사용하지 않는다. B0 동안 전체 ARM64 candidate는 비활성이고
required `promotion`은 실패하므로 probe용 Promotion PR을 병합하지 않는다.

1. 같은 저장소 `migration_main → migration_develop` PR의 Verify가 성공하면 `B0 publish probe`가
   기존 게시 credential로 약 2KB의 scratch marker 이미지를 두 repo에 게시한다. 앱 Dockerfile은
   빌드하지 않는다. `b0-publish-<source SHA>-<attempt>` artifact의 `b0-proof.json`만 전달한다.
2. 검토한 소스의 `b0-host-probe.py`와 입력을 보호된 root 경로에 전달한다. 두 JSON 입력은
   root 소유·0600 일반 파일이어야 한다. 두 번째 JSON은 `{"auth":"<기존 Auth Secret OCID>",
"mfa":"<기존 MFA Secret OCID>"}`이며 실제 ID는 비공개 기록에서 가져온다. Secret 값이 아니다.

   ```bash
   sudo python3 -I /protected/path/b0-host-probe.py /protected/path/b0-proof.json /protected/path/console-secret-ids.json
   ```

   이 도구는 guard check/현재 Web probe 후 기존 host credential helper로 두 digest를 pull하고,
   시작하지 않은 임시 container에서 marker를 대조한다. container는 성공·실패 모두 삭제한다.
   Instance Principal로 두 CURRENT bundle을 읽고 메모리에서 형식만 검사한다. Secret 원문/변환 값/
   hash/CLI 오류 원문을 출력·파일 저장하지 않는다. 성공 출력의 두 version만 비공개 증거에 남긴다.

3. host 성공을 확인한 maintainer가 해당 PR에 `b0-host-<전체 source SHA>` label을 붙이고,
   `p06-b0-command` label을 추가한다. 전용 labeled workflow는 최신 SHA/tree, 같은 PR의 최신
   Verify와 게시 job 성공, source에 결합한 host 확인을 요구한다. 이 label은 실제 host 실행 증거를
   대체하지 않는다. 재실행은 원인 확인 후 실행 label을 제거·추가하며 전체 Verify는 다시 돌리지 않는다.
4. GitHub `oci-development-image`에 기존 VM·compartment ID를 각각
   `OCI_COMPUTE_INSTANCE_OCID`, `OCI_COMPUTE_COMPARTMENT_OCID` variable로 승인 후 등록한다.
   API credential은 기존 `OCI_CLI_*`를 command step에만 주입한다. 임시 0600 signing key는
   종료 시 삭제하며 신규 command는 기존 `run-command-probe.sh`만 호출한다. 새 execution의
   대상·command 대응·최근 UTC·SUCCEEDED·정수 exit 0을 대조한다. 안전한 결과 artifact만 남기고
   정확한 command OCID는 OCI 콘솔에서 display name으로 찾아 비공개 기록에 보관한다.

오류는 고정 event만 출력한다. 각 단계 실패 시 다음 단계로 진행하지 않는다. probe image는 배포
후보가 아니며 `candidate.json`을 만들지 않는다. B0 실제 권한 실증 완료 후 B1에서 전체 candidate를
복구하고, B1+B2와 host upgrade 완료 후 실제 Promotion을 진행한다. CI에 image 삭제 권한을 추가하거나
다른 image를 prune하지 않는다.

### P06-B2 paired host 준비 계약

`deploy-release.sh <web digest> <console digest> <base64url candidate>`가 strict 인자·root 파일·lock을 확인한다.
paired helper는 두 앱의 Vault env/DB 동일성·Auth/MFA 분리·digest/revision·Compose를 서비스 변경 전 검증한다.
현재 pair와 후보 baseline ID, 재사용 digest/build source, 실행 image/config hash·보호 env가 맞아야 한다.
`baseline=null`은 paired state가 아직 없는 첫 배포만 허용한다. 증거 만료로 baseline을 얻지 못하면
두 앱을 빌드해도 기존 paired VM에 무조건 적용할 수 없다. 정상 배포 증거 복원/새 검증이 먼저다.

기존 host의 설치 변경은 별도 승인 후 `install-host-assets.sh --upgrade-paired`로 실행한다.
installer는 기존 Compose/script/deploy.conf를 root-only `deploy/legacy-host`에 보존하며 배포 lock을 획득한다.
보호된 deploy.conf의 Console repository/port/smoke와 두 Console env 파일을 운영자가 명시적으로 준비하고
preflight를 통과해야 한다. 예시는 자동 덮어쓰기/Secret 생성이 아니다. 설치 자체로 container/state를 전환하지 않는다.

성공 pair는 `deploy/current-pair` → root-only snapshot이며 `previous-pair`에 직전 pair를 보관한다.
웹/콘솔 runtime env 경로는 `web.env`·`console.env`로 고정한다. pending-pair가 남으면 새 배포를 거절한다.
중단/복구 실패 시 maintenance를 유지하고 current snapshot의 candidate/env/Compose/config를 검토하여 명시적으로
복구한다. pending 파일만 지우고 계속하지 않는다. 기존 legacy current/app.env/설치 backup은 보존한다.
첫 pair 실패 시 새 두 서비스를 중지하고 기존 app을 복구한다. DB migration/rollback은 자동 수행하지 않는다.

CI는 최근 성공한 실제 배포의 candidate/receipt artifact와 원래 verify artifact/check를 대조한 뒤 Turbo로
앱별 build를 선택한다. 재사용 digest도 새 조합에서 동시에 smoke하며 actual build SHA label을 확인한다.
exit 0 이후만 90일 paired-deployment artifact를 기록한다. 임시 workflow 차단의 제거 조건은 active runbook §21을 따른다.
실제 배포와 복구 실증은 승인된 host upgrade·설정·DB 준비 후 별도 승인한 Promotion으로 진행한다.
VM metadata/재시작 지속성의 실제 증거를 확인하기 전 B2 완료나 공개 전환으로 기록하지 않는다.

## 9. P06 최초 host 전환

적용 기준은 `d95d368a425ca59991ac3834b421508b56447919`다. 현재 관찰은
[B2-3 RESULT](../../docs/migration/implementation/console-guide-editor/P06-B2-3-RESULT.md#2026-10-17-병합-후-vm-읽기-조회),
실행 승인 범위는 [P06 PLAN](../../docs/migration/implementation/console-guide-editor/P06-PLAN.md#2026-10-17-host-전환-준비)이 소유한다.
아래는 **승인 후 실행할 제안**이며 이번 문서 갱신에서는 실행하지 않았다.

### 9.1. Asset 설치만 먼저 승인

현재 사용자 소유인 runtime·scripts 두 디렉터리만 root/0750으로 보호한다. recursive chown/chmod는 하지 않는다.
기존 app·PostgreSQL·guard·Caddy·키·DB·env 값은 유지한다. installer는 Compose·여섯 script·sudoers·metric unit을
설치하고 systemd daemon-reload를 실행하지만 서비스/타이머를 enable/restart하지 않는다.
이 단계는 Console 설정 작성이나 실제 배포 승인을 포함하지 않는다.

검토한 source archive는 다음 명령으로 로컬에서 생성한다. 개인 env나 운영 설정을 포함하지 않는다.

```bash
git archive --format=tar --output=/tmp/p06-host-assets-d95d368.tar \
  d95d368a425ca59991ac3834b421508b56447919 \
  compose.oci-development.yml ops/oci app.env.oci-development.example .env.oci-secrets.example
sha256sum /tmp/p06-host-assets-d95d368.tar
```

SHA-256은 `d61643bf60c1b9b4f2eb8c5de32e963ab9f5171bdf7a579418837424b64fbfb7`다.
승인 후 기존 SSH로 VM 사용자 staging `/home/oioi/p06-host-assets-d95d368.tar`에 전달하고,
사용자가 기존 sudo 인증으로 아래 블록을 실행한다. 비밀번호는 에이전트에게 전달하지 않는다.
실행 중 다른 배포/설치 작업을 금지하며 workflow 배포 차단은 유지한다.

```bash
sudo bash --noprofile --norc <<'SH'
set -Eeuo pipefail
umask 077
work=/var/lib/oioi-p06-upgrade-d95d368
[[ ! -e "$work" && ! -L "$work" ]]
python3 -I - <<'PY'
import stat
from pathlib import Path
for name, uid in [('/var', 0), ('/var/lib', 0), ('/srv', 0),
                  ('/srv/oioibawige', 1002), ('/srv/oioibawige/scripts', 1002),
                  ('/srv/oioibawige/deploy', 0), ('/etc', 0), ('/etc/oioibawige', 0)]:
    s = Path(name).lstat()
    assert stat.S_ISDIR(s.st_mode) and s.st_uid == uid and not s.st_mode & 0o022
PY
install -d -o root -g root -m 0700 "$work" "$work/source" "$work/before"
install -o root -g root -m 0600 /home/oioi/p06-host-assets-d95d368.tar "$work/source.tar"
printf '%s  %s\n' d61643bf60c1b9b4f2eb8c5de32e963ab9f5171bdf7a579418837424b64fbfb7 "$work/source.tar" |
  sha256sum --check --status
# Parent protection precedes privileged state/backup access; preserve the observed old metadata separately.
stat -c '%u:%g %a %n' /srv/oioibawige /srv/oioibawige/scripts > "$work/before/directories.txt"
chown root:root /srv/oioibawige /srv/oioibawige/scripts
chmod 0750 /srv/oioibawige /srv/oioibawige/scripts
python3 -I - <<'PY'
import stat
from pathlib import Path
s = Path('/srv/oioibawige/deploy/deployment.lock').lstat()
assert stat.S_ISREG(s.st_mode) and s.st_uid == 0 and s.st_nlink == 1 and not s.st_mode & 0o077
PY
exec 9<>/srv/oioibawige/deploy/deployment.lock
flock -n 9
app_id=$(docker ps -q --filter label=com.docker.compose.project=oioi-bwg-development --filter label=com.docker.compose.service=app)
[[ "$app_id" =~ ^[0-9a-f]{12}$ ]]
before=$(docker inspect --format '{{.Id}} {{.State.StartedAt}} {{.State.Running}} {{.State.Health.Status}}' "$app_id")
[[ "$before" == *' true healthy' ]]
printf '%s\n' "$before" > "$work/before/app-state.txt"
paths=(srv/oioibawige/compose.oci-development.yml srv/oioibawige/scripts
       srv/oioibawige/app.env srv/oioibawige/deploy etc/oioibawige)
for path in etc/sudoers.d/oioi-bwg-ocarun etc/systemd/system/oioi-filesystem-metric.service etc/systemd/system/oioi-filesystem-metric.timer; do
  [[ ! -e "/$path" ]] || paths+=("$path")
done
tar -C / -cpf "$work/before/host.tar" "${paths[@]}"
cp -a /etc/oioibawige "$work/before/config"
flock -u 9
exec 9>&-
tar -xf "$work/source.tar" -C "$work/source"
bash "$work/source/ops/oci/install-host-assets.sh" --upgrade-paired
for name in deploy.conf runtime-public.env runtime-secrets.env; do
  cmp -s "$work/before/config/$name" "/etc/oioibawige/$name"
done
tar -xOf "$work/before/host.tar" srv/oioibawige/app.env | cmp -s - /srv/oioibawige/app.env
tar -xOf "$work/before/host.tar" srv/oioibawige/deploy/current | cmp -s - /srv/oioibawige/deploy/current
[[ "$before" == "$(docker inspect --format '{{.Id}} {{.State.StartedAt}} {{.State.Running}} {{.State.Health.Status}}' "$app_id")" ]]
printf 'paired_host_assets_installed_existing_web_preserved\n'
SH
```

어느 단계든 실패하면 중단한다. 새 root 작업 경로는 재사용하지 않으며 실패 원인과 backup/legacy-host를
먼저 확인한다. 설치 전에 경로 보호만 적용된 경우에는 그 보호를 유지한다. 실패했다고 자동 재실행하거나
사용자 소유권으로 되돌리지 않는다. 이 블록의 shell 구문 검증과 실제 VM 설치 성공은 구분한다.

### 9.2. 보호 설정과 DB 준비

설치 성공 후에도 Console 설정이 없으므로 paired preflight 완료로 기록하지 않는다. 다음 설정 변경을 별도로 승인한다.

| 파일                        | 변경안                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기존 deploy.conf            | 기존 Web repository·DB·network·port·smoke·metric 항목 보존. `CONSOLE_IMAGE_REPOSITORY`는 GitHub Console repository와 대조, `CONSOLE_PORT=3001`, `CONSOLE_SMOKE_PATHS="/admin-login"` 추가 |
| console-runtime-public.env  | root/0600·일반 파일·link 1. `CONSOLE_ORIGIN=http://127.0.0.1:3001`, `CONSOLE_MFA_ENROLLMENT_ENABLED=false`. 필요한 R2 공개 항목만 명시                                                    |
| console-runtime-secrets.env | root/0600·일반 파일·link 1. 기존 DB 앱 password와 준비된 Console Auth/MFA Secret OCID만 매핑. 업로드 검증 전에 기존 R2 매핑 검토                                                          |
| 기존 Web public/map·app.env | 이번 설정 작업에서 변경하지 않음. Auth/MFA 값·version 재생성/교체 없음                                                                                                                    |

실제 ID는 비공개 VM 기록에서 운영자가 입력하며 template placeholder를 그대로 설치하지 않는다.
`sudo /srv/oioibawige/scripts/preflight-host.sh`는 설정·root 경로·Agent·Compose·Instance Principal을 확인한다.
이 검사는 두 앱 Vault env materialization·digest pull·앱 간 키/DB 비교·실제 metadata 차단을 대신하지 않는다.
DB journal/schema·app 권한 확인 및 필요한 migration은 별도 승인 작업이며 installer/deploy에서 실행하지 않는다.

### 9.3. 첫 배포와 실패 복구의 구분

최신 후보 성공, DB 준비, 유지보수 접근 제한과 구체적인 실패/중단 복구안이 갖춰진 뒤 첫 배포 실행 범위를 승인한다.
현재 Caddy에는 maintenance가 없으므로 기존 preview block을 보존한 503 전환·`caddy validate`·reload·복원안을
실제 파일 기준으로 먼저 검토한다. Console 외부 route/DNS는 추가하지 않는다. workflow 차단 해제는 별도 코드 변경이다.
정상 배포는 승인된 Promotion 경로를 사용하며 검증용 #142를 병합하거나 SSH 직접 배포로 대체하지 않는다.
활성화 전 별도 rehearsal이 필요하면 격리 범위·candidate 출처·state/receipt 처리·복구 절차를 승인안에 포함한다.

| 실패 시점                         | 보존/복구와 재개 조건                                                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| asset 설치 실패, app 정상         | 새 배포 금지. root backup을 별도 보호 경로에 풀고 기존 Compose·네 script·sudoers·metric unit을 검토해 원래 경로에 원래 파일 mode로 복원. 기존 설정/env/current 및 root 디렉터리 보호·IMDS guard 유지. visudo/daemon-reload와 기존 app health/ID 확인 |
| 첫 후보 사전 검사 실패            | app을 정지하기 전이므로 기존 Web/env/current 무변경을 확인. 원인만 수정하고 후보/기준을 다시 검증                                                                                                                                                    |
| 첫 app 전환 실패·exit 20          | helper가 web/console을 stop하고 legacy-host의 Compose/config + 기존 current/app.env로 app 복구. 양쪽 새 서비스 중지·Web readiness·외부 접근 제한·IMDS를 확인한 뒤 재개 판단                                                                          |
| paired 후보 실패·exit 20          | 직전 snapshot의 두 env/Compose/설정/digest pair 복원과 두 앱 smoke 확인. 새로운 성공 receipt를 만들지 않음                                                                                                                                           |
| exit 21·중단·pending 잔존         | maintenance 유지. current/previous/pending·snapshot·실제 실행 image를 읽고 복구 대상을 확정. 최초 전환이면 legacy app, 정상 pair가 있으면 그 pair를 명시적으로 복구/검증한 뒤 pending 정리. pending만 지우거나 배포 재시도 금지                      |
| host 성공 후 CI receipt 저장 실패 | VM current-pair를 지우거나 baseline=null을 강제 적용하지 않음. 해당 성공 실행의 검증 가능한 증거 복원·receipt 처리부터 검토                                                                                                                          |

실제 첫 전환·rollback·중단 수동 복구는 아직 미검증이다. 적용 전에는 해당 snapshot의 경로·digest·env를 대조한
실행 명령과 복구 완료 판정을 확정한다. OCI API/agent 오류 원문·runtime env·Secret은 CI/공개 기록으로 보내지 않는다.
실제 두 앱의 container ID/StartedAt·health/readiness·IMDS 차단/host 양성 대조와 재시작 지속성까지 확인한 뒤 B2를 완료한다.
