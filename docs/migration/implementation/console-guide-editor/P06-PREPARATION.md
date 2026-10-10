---
title: "P06 외부 환경 사전 준비 안내"
kind: migration-plan
status: draft
authority: plan
source_commit: 5135f6eb1a53782b86a3120b1d8b0134410bf4d4
created_at: "2026-10-10"
updated_at: "2026-10-11"
revision: 2
---

# P06 사전 준비: 지금 할 일과 전환 때 할 일

**preview에서 만들어 둔 기존 관리자 계정을 그대로 사용한다.** 관리자 계정 생성·승격은
사전 준비에서 제외한다. 일반 회원가입 페이지와 가입 API 세 개는 사용자 지시에 따라 P06에서 종료할 대상으로
남기며 이 안내에서는 생성·수정·삭제하지 않는다. 공인 IP 등록·고정 IP·WAF 차단 규칙·
Cloudflare Access 가입도 요구하지 않는다.

현재 preview Web의 VM은 사용자 DNS 스크린샷 기준 `129.225.183.112`다.
최종 www(Web)·console(Console)은 같은 VM을 사용하며 기존 Web Worker·staging·preview 경로는
전환 검증 후 종료한다. 별도의 상시 staging·새 VM·새 DB·도메인 구매는 준비 항목이 아니다.
apex는 www로 redirect하는 안이며 적용 절차는 P06 전환 시 확정한다.

이 문서는 P06의 일회성 외부 준비 절차다. 구현 순서는 [계획 PR #130](https://github.com/goldmayo/oioi-bwg/pull/130),
단계 순서는 [ROADMAP](ROADMAP.md), 반복 host 운영은 [OCI 안내](../../../../ops/oci/README.md)가 소유한다.
기준은 [Auth](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Runtime](../../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md),
[배포 runbook](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md),
[Domain AUTH-009](../../DOMAIN_SPECIFICATION.md#auth-009-console-mfa-등록과-회수)다.

## 1. 먼저 실행 시점을 구분하기

| 항목       | 지금                                                  | P06 구현·검증 후                                  |
| ---------- | ----------------------------------------------------- | ------------------------------------------------- |
| Cloudflare | 현재 설정 보관, Console 캐시 제외 준비, SSL 상태 확인 | Console DNS 연결, www Worker 연결 해제·VM 전환    |
| OCI Vault  | Console 키 보관, secret OCID·복구 위치 기록           | host secret mapping·읽기 권한 적용                |
| OCIR·IAM   | Stack·주체/domain·compartment·정책 기록               | B0의 Plan/Apply·실제 권한 검사 완료 후 ARM64 빌드 |
| GitHub     | 기존 Environment/변수/secret 이름 확인                | 확정된 Console 변수·운영 build 입력 반영          |
| VM         | Caddy 실행 방식·설정 경로·포트·자원 확인              | 두 앱 배포·HTTPS·MFA 등록/회수 검증               |
| R2         | assets 연결·버킷 의존성 확인                          | 필요 시 파일 이관 후 이전 리소스 종료             |

기준 코드의 Console은 HTTP loopback만 허용하고 쿠키 Secure=false이며 배포는 Web 한 앱만
처리한다. 지금 DNS와 `CONSOLE_ORIGIN=https://console.oioibawige.com`만 넣으면 정상 실행되지 않는다.
P06에서 이 경계를 구현한 뒤 적용한다. 아래 VM 명령은 조회용이며 배포·DB 변경 명령은 없다.

## 2. Cloudflare: 기존 설정 보관과 캐시 제외

Cloudflare에서 `oioibawige.com`을 선택한다. 다음 화면을 캡처하거나 설정을 기록한다.

- DNS → Records: preview의 A 대상, www/apex의 Worker 연결, staging·assets.
- Workers & Pages → `oioibawige` 및 `oioibawige-staging` → Settings → Domains & Routes.
- SSL/TLS → Overview 및 Edge Certificates: 현재 mode·인증서 Active 상태·hostname 범위.
- Rules: Redirect/Origin/Transform/Cache 규칙. console까지 매칭되는 wildcard 규칙 확인.

지금 www/apex/staging 연결을 삭제하지 않는다. 복구용 설정 기록에 secret 원문을 넣지 않는다.

캐시 제외는 Caching → Cache Rules → Create rule에서 아래 값으로 준비한다.

| 필드 | 값 |
| --- | --- |
| Rule name | `console-bypass-cache` |
| 요청 조건 | Custom filter expression |
| Field / Operator / Value | Hostname / equals / `console.oioibawige.com` |
| Cache eligibility | Bypass cache |

Expression editor를 사용한다면 다음 식을 넣는다.

```text
(http.host eq "console.oioibawige.com")
```

같은 hostname에 캐시를 허용하는 기존 규칙보다 뒤에 두어 Bypass가 최종 적용되게 한다.
Deploy로 저장할 수 있으며 DNS 생성이 요구되면 Save as Draft로 보관하고 DNS 연결 단계에서
활성화한다. 지금 DNS를 먼저 추가하지 않는다. [생성 절차](https://developers.cloudflare.com/cache/how-to/cache-rules/create-dashboard/),
[충돌 시 마지막 규칙 우선](https://developers.cloudflare.com/cache/how-to/cache-rules/order/).

SSL/TLS는 현재 mode와 인증서 범위만 기록한다. 목표는 Full (strict)이며 origin에 유효한
www·console 인증서가 필요하다. 현재 zone mode를 확인 없이 바꾸거나 인증서를 교체하지 않는다.
기존 Caddy 인증서 방식을 확인한 뒤 확장한다. [Full strict 조건](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

완료: 현재 설정 기록, Console 캐시 제외 규칙 또는 draft, 현재 SSL mode/인증서 범위 기록.

## 3. OCI Vault: Console 키 두 개 보관

기존 관리자 계정이 있다는 사실과 Console MFA 암호화 키가 이미 있다는 사실은 구분한다.
preview DB에 기존 MFA가 등록돼 있다면 해당 키를 먼저 확보·보존한다. 새 키로 덮어쓰지 않는다.
운영 Console 키를 아직 만들지 않은 경우에만 다음 명령을 **로컬 터미널**에서 실행한다.

```bash
(
  set -eu
  umask 077
  p06_secret_dir="$(mktemp -d "${HOME}/p06-console-secrets.XXXXXX")"
  openssl rand -base64 32 > "${p06_secret_dir}/console-auth-secret.txt"
  openssl rand -base64 32 > "${p06_secret_dir}/console-mfa-encryption-key.txt"
  printf '키 파일 저장 위치: %s\n' "${p06_secret_dir}"
)
```

출력된 디렉터리의 두 파일을 각각 열어 한 줄 값을 사용한다. 서로 다른 키이며 Web AUTH_SECRET과
로컬 개발 키를 재사용하지 않는다. 키 파일을 repo·PR·채팅에 붙여 넣지 않는다.

생성 운영자의 Secret/Vault/Key 범위와 `SECRET_CREATE`·`VAULT_CREATE_SECRET`·`KEY_ENCRYPT`·
`KEY_DECRYPT`를 먼저 확인한다. 정책별 범위·통과 조건은 [계획 §4.1](P06-PLAN.md#41-p06-b0-arm64-빌드-전-iam-준비실증)을 따른다.
secret 생성 권한을 VM의 내용 읽기 권한이나 Resource Manager 권한과 합쳐 판단하지 않는다.
OCI에서 기존 runtime secret이 있는 Vault의 Secrets → Create secret으로 이동한다.
메뉴를 찾기 어려우면 OCI 검색창의 Vault/Secrets를 사용한다. 두 secret을 각각 생성한다.

| 입력 | 세션 키 | MFA 암호화 키 |
| --- | --- | --- |
| Name 제안 | `oioi-console-auth-secret` | `oioi-console-mfa-encryption-key` |
| 애플리케이션 변수 | `CONSOLE_AUTH_SECRET` | `CONSOLE_MFA_ENCRYPTION_KEY` |
| Compartment / Vault | 기존 runtime secret과 같은 위치 | 같은 위치 |
| Encryption key | 기존 Vault의 대칭 암호화 키 | 같은 키 사용 가능 |
| Generation / 입력 형식 | Manual / Plain-text | Manual / Plain-text |
| Secret Contents | auth 파일의 한 줄 | MFA 파일의 한 줄 |
| 자동 rotation | 사용하지 않음 | 사용하지 않음 |

**파일 값은 Base64 문자열이지만 Vault 입력 형식은 Plain-text를 선택한다.** 앱이 받을 값은
그 문자열 자체이며 Console이 전송용 인코딩을 처리한다. [OCI secret 생성](https://docs.oracle.com/en-us/iaas/Content/secret-management/Tasks/create-secret.htm).
두 secret의 OCID와 Vault/compartment를 기록하고, MFA 키 원문은 접근 통제된 비밀번호 관리자 등에
복구 사본을 보관한다. Vault의 master encryption key와 앱의 MFA 암호화 키는 다른 값이다.
GitHub에 runtime 키 원문을 등록하지 않는다. 배포/등록마다 새 키를 생성하지 않는다.

완료: 두 secret OCID, 보호된 키 복구 사본. 이미 존재하면 재생성 없이 이 정보를 확인한다.

## 4. OCI Registry·IAM / GitHub: 기존 구성 확인

OCI Container Registry에서 기존 `oioi-bwg`의 region·compartment·namespace·private 여부를 기록한다.
Console repository 이름은 `oioi-bwg-console`을 제안하며 P06 후보 계약에서 확정한다.
repository는 Terraform이 관리하므로 지금 수동 생성하지 않는다.
**전체 ARM64 빌드보다 먼저 P06-B0를 통과해야 한다.** 정책 형식·주체별 권한·실제 통과 조건은
[계획 §4.1](P06-PLAN.md#41-p06-b0-arm64-빌드-전-iam-준비실증)이 소유한다. 다음을 기록한다.

| 확인 화면/근거                                | 보관할 값                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Resource Manager → 기존 Stack → 소스 설정/Job | Stack OCID, repository/ref, Job의 실제 SHA, 작업 경로 `infra/oci`, region, Plan/Apply Job ID                                            |
| IAM → Domains/Groups/Policies 및 Job 인증     | Stack 실행자/provider principal, Vault 생성자, `OCIR_USERNAME` 게시 사용자, `OCI_CLI_USER` API 사용자 각각의 OCID·identity domain/group |
| Registry·Compute·Secret 리소스                | 각 compartment OCID, 대상 VM, 두 repo 이름/private 여부, Vault/Key·새 secret 두 OCID                                                    |
| IAM 정책                                      | Resource Manager 실행 권한과 리소스 권한, 생성/게시/pull/내용 읽기/Run Command의 개별 정책·조건                                         |

기록에는 credential·secret 원문을 넣지 않는다. 기존 사용자라고 모든 역할이 같은 계정이라고
가정하지 않는다. Stack 화면 접근 가능이나 Plan 성공만으로 Apply 권한을 증명하지 않는다.
같은 Stack에서 검토한 Plan을 Apply하고, 기존 VM·Web repo·Vault/Key·backup의 교체/삭제가
나오면 중단한다. VM의 새 Console secret 읽기 권한 추가 전에 기존 Web metadata 차단을 확인한다.
Run Command principal에 Vault/DB 권한을 합치지 않는다.

B0 구현 후 승인된 실행 시점에는 아래 순서대로 증거를 기록한다. 지금 구현되지 않은 probe를
임의의 운영 shell 명령으로 대신 실행하지 않는다.

1. IAM 준비와 Web metadata 차단 → 동일 Stack Plan 검토·Apply.
2. 동일 CI 게시 계정으로 작은 이미지를 Web/Console repo에 push → VM Instance Principal로 digest pull.
3. VM host에서 새 secret 두 개의 CURRENT 읽기·형식 검사. 원문 출력 없이 OCID/version·성공 여부만 기록.
4. 동일 CI API 계정으로 Instance 조회 → 새 Run Command 생성 → VM 실행 → 결과 조회·exit 0 기록.
5. 네 단계 성공 후 전체 ARM64 빌드. 실패 시 중단하고 권한 수정 후 실패 검사만 재실행.

helper 존재·`oci os ns get`·기존 probe marker는 위 실증을 대체하지 못한다.
metadata 차단은 [계획 §4.2](P06-PLAN.md#42-p06-metadata-차단-완료-조건)에 따라 최종 실제 두 앱과
재생성/재시작/rollback까지 확인한다. P08로 미루지 않는다.

GitHub → 저장소 Settings → Environments → `oci-development-image`에서 다음 **이름의 존재**를 확인한다.

| 구분 | 기존 항목 |
| --- | --- |
| Variables | OCIR_REGISTRY, OCIR_NAMESPACE, OCIR_REPOSITORY, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT |
| Secrets | OCIR_USERNAME, OCIR_AUTH_TOKEN, OCI_CLI_USER, OCI_CLI_TENANCY, OCI_CLI_FINGERPRINT, OCI_CLI_KEY_CONTENT, SENTRY_AUTH_TOKEN, SLACK_DEPLOY_WEBHOOK_URL |

기존 credential을 재발급하거나 새 Environment를 미리 만들지 않는다. Console 변수명·Sentry 설정은
P06 구현과 함께 확정한다. 현재 workflow의 NEXT_PUBLIC_APP_ENV=staging은 고정 build 입력이므로
GitHub Variable만 production으로 바꿔 해결하지 않는다. 운영 입력으로 만든 digest 자체를 검증해야 한다.
준비 완료: 위 실행 대상·주체·정책 기록과 기존 GitHub 설정 확인. 빌드 허용은 실제 B0 증거 확보 후다.

## 5. VM: Caddy·포트·자원 조회

기존 SSH 방법으로 **preview VM에 접속한 후** 아래를 실행한다. DB/env/secret 내용을 출력하지 않는다.

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker compose version
sudo systemctl show caddy -p FragmentPath -p ExecStart
sudo ss -lntp
free -h
df -h
timedatectl status
```

| 확인 | 기록할 정보 |
| --- | --- |
| Caddy | systemd인지 Docker인지, 실제 설정 경로·인증서 방식 |
| Web | 현재 container/image와 host 연결 포트 |
| 포트 | 80/443·앱·DB의 실제 listen 주소 |
| 자원 | 메모리/디스크 여유, 두 앱 pool 최대 20+운영 여유의 검토 자료 |
| 시간 | NTP 동기화 상태. 관리자 인증기 시간도 자동 설정 사용 |

Caddy가 Docker로 실행되면 systemd 조회 결과가 없어도 정상이다. 현재 설정 경로를 확인한 뒤
P06에서 변경안을 만든다. 지금 Caddyfile 덮어쓰기·reload·앱 restart를 하지 않는다.
외부는 Caddy로 접근하며 앱 3000/3001과 PostgreSQL 5432를 추가 개방하지 않는다.
완료: 위 정보 기록. 공인 IP allowlist를 준비할 필요는 없다.

## 6. R2: assets 연결 확인

Cloudflare R2 → `oioibawige-r2-staging` → Settings → Custom Domains에서
`assets.oioibawige.com` 연결을 확인한다. preview Web의 실제 업로드 대상과 기존 이미지 URL도 기록한다.
이름에 staging이 있다는 이유로 버킷을 먼저 삭제하지 않는다. 폐기한다면 파일 이관·assets 연결/
업로드 전환·기존 URL 조회 검증 후 정리한다. 새 버킷/CORS PUT은 지금 필수 설정이 아니다.
메일 DKIM/SPF/DMARC도 기존 서비스의 발송 의존성을 확인하기 전에는 함께 삭제하지 않는다.
완료: 실제 버킷·assets 연결·파일 이관 필요 여부 기록.

## 7. P06 구현 후 적용할 DNS와 인증 설정

이 절은 전환 시 사용할 값이다. 지금 Save/연결 해제/삭제하지 않는다.
Cloudflare → oioibawige.com → DNS → Records → Add record에서 다음으로 연결한다.

| Type | Name | IPv4 | Proxy | TTL |
| --- | --- | --- | --- | --- |
| A | console | 129.225.183.112 | Proxied | Auto |
| A | www | 129.225.183.112 | Proxied | Auto |

console은 HTTPS runtime·Caddy·캐시 제외를 준비한 뒤 연결한다. www는 기존 Worker의
Settings → Domains & Routes에서 Custom Domain/겹치는 route를 해제한 뒤 전환한다.
이전 preview를 CNAME 대상으로 사용하지 않는다. apex redirect는 전환 절차에서 준비한다.
[DNS 등록](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/),
[Worker Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Console의 최종 origin은 `https://console.oioibawige.com`, 공개 시 enrollment flag는 false다.
기존 preview 관리자 계정으로 필요한 MFA 등록·다음 OTP 로그인·관리 작업·회수 검증을 진행한다.
등록 접근 경계와 HTTPS 전환은 P06 서버 구현에서 처리하며 사용자 공인 IP 설정을 추가하지 않는다.
관리자 비밀번호·TOTP·키 원문을 준비 기록에 넣지 않는다.

두 앱과 데이터/이미지 보존을 확인한 뒤 기존 Web Worker·staging/www.staging·preview 경로와
이전 배포 설정을 종료한다. 일반 회원가입 페이지와 `/api/auth/signup/otp`, `/api/auth/signup/otp/verify`,
`/api/auth/signup/complete` POST 종료는 P06-E에서 구현·직접 호출 검증한다.
DNS 전환만으로 운영 활성화·MFA 검증·배포 완료를 기록하지 않는다.

## 8. 준비 완료 체크

- [ ] 현재 Cloudflare DNS/Worker/관련 규칙 기록.
- [ ] Console 캐시 Bypass 규칙 또는 draft, SSL mode·인증서 범위 기록.
- [ ] Console 키 두 개의 Vault OCID와 보호된 복구 사본 준비.
- [ ] 기존 OCIR/GitHub 설정과 Stack 소스 SHA/path·주체/domain·세 compartment·정책 기록.
- [ ] ARM64 빌드 전 승인된 B0 Plan/Apply·push/pull·새 secret 읽기·새 Run Command 증거 확보.
- [ ] VM의 Caddy 배치·설정 경로·포트·자원·시간 동기화 기록.
- [ ] assets/R2의 실제 연결과 이관 필요 여부 확인.

체크는 실제 준비 완료 후 한다. 이 문서 작성에서 운영 Vault/VM/DB 조회나 외부 변경은 실행하지 않았다.
