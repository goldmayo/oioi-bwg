---
title: "P06 외부 환경 사전 준비 안내"
kind: migration-plan
status: draft
authority: plan
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-10"
updated_at: "2026-10-20"
revision: 11
---

# P06 사전 준비: 지금 할 일과 전환 때 할 일

2026-10-19 C 추가 안내: Cloudflare 대시보드 사전 점검은 사용자 확인으로 완료됐다.
확인 사실은 [P06-C RESULT](P06-C-RESULT.md#2026-10-19-cloudflare-대시보드-사전-점검사용자-확인)가 소유하며,
추가 변경·승인 순서는 아래 §2를 따른다. 별도 사용자 승인으로 1차 보호 백업과 #164의 기존 HTTP 공동 배포를 완료했다.
실행·receipt·VM 검증은 [C 운영 결과](P06-C-RESULT.md#2026-10-19-승인된-보호-백업과-http-공동-배포)가 소유한다.
#166은 Draft·미병합이다. HTTP 전용 차단의 Caddy validate/reload를 먼저 별도 승인으로 완료했고 HTTPS Origin은 미실행이다. 인증서 단계는 별도 승인으로 한 번 실행했으나 CA 검증403으로 HTTP403 복구(exit20) 후 중단했다. 원인 확인·새 승인 전 재시도하지 않는다. Cloudflare 캐시 규칙 활성화·Proxied Console A 생성은 앞서 사용자가 완료했다. 공개 DNS/HTTP 관찰과 검토했던 인증서 범위는 아래 §2, 실패/복구의 실제 순서는 [C 결과](P06-C-RESULT.md#2026-10-20-승인된-인증서-단계-실패와-http403-복구)를 따른다.
2026-10-20 인증서 읽기 관찰을 반영한 **기존 Caddy의 Let's Encrypt 우선 경로**는 아래 §2의 추가 안내를 따른다.
아래 B0/Vault 등 초기 준비 안내를 새 실행 요청으로 해석하지 않는다.

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

초기 안내 기준 `5135f6e`에서는 Console이 HTTP loopback만 허용하고 쿠키 Secure=false이며 배포는 Web 한 앱이었다.
이후 B의 공동 배포와 C의 HTTPS 코드·후보 검증을 마쳤다. 실제 VM은 기존 HTTP loopback 설정과
HTTP 전용 host materializer를 유지하므로 DNS나 HTTPS Origin만 먼저 바꾸지 않는다.
아래 VM 명령은 조회용이며 배포·DB 변경 명령은 없다.

## 2. C의 제한된 Cloudflare HTTPS 검증 준비

### 사전 점검 완료와 남은 서버 조건

대시보드의 DNS·SSL/TLS·Edge 인증서·Worker Custom Domain·관련 Rules/Managed Transforms는
[사용자 확인 결과](P06-C-RESULT.md#2026-10-19-cloudflare-대시보드-사전-점검사용자-확인)를 재사용한다.
같은 항목의 화면 확인이나 캐시 규칙 재생성을 다시 요청하지 않는다. 이후 DNS/cache 두 항목은 사용자가 완료했다. 실제 공개 경로 관찰은 [C 결과](P06-C-RESULT.md#2026-10-20-사용자-dnscache-변경과-공개-http-01-경로-관찰)를 따른다.

아래 1~2의 1차 보호 백업과 기존 HTTP 공동 배포는 별도 승인으로 실행했다. 이후 인증서 관찰로 구체화한 현재 진입점은 아래 Let's Encrypt 우선 경로와 운영 결과를 따른다. 이 문서 갱신은 다음 서버 변경을 승인하지 않는다.

1. 별도 서버 승인안에서 원본 Caddyfile·host materializer·Console public/runtime env·정상 pair/snapshot의
   보호 백업과 정확한 복구 명령을 확정한다. 기존 preview block·Web/DB·loopback 포트를 보존한다.
2. 별도 승인된 #164 Promotion으로 검증한 두 digest를 **기존 HTTP loopback 설정에서 먼저 배포·정상 확인**한다.
   #164 병합과 실제 VM 배포는 이 문서 갱신이나 Cloudflare 사전 점검으로 승인되지 않는다.
   현재 workflow는 병합 직후 배포를 시작하므로 병합 승인과 VM 배포 승인을 모두 받은 뒤 병합한다.
3. Console origin 인증서·제한 Caddy 경로를 준비하고 host materializer·HTTPS Origin 전환을 함께 검토·승인한다.
   준비 중에는 검증 경로도 닫아 두고, 실패하면 설정과 기존 정상 pair를 함께 복구한다.
4. DNS 요청 전에 일반 Console 요청/직접 origin/위조 헤더가 차단되는 증거와 기존 preview 원본 200,
   두 앱의 네 health/readiness 200·DB healthy를 대조한다. DNS 부재 자체를 차단 근거로 쓰지 않는다.

Edge의 `*.oioibawige.com` 인증서는 **Caddy의 origin 인증서를 대신하지 않는다**.
남은 인증서 조건은 `console.oioibawige.com`을 포함한 유효한 origin 인증서다.
2026-10-20 사용자 지시에 따라 기존 Caddy의 Let's Encrypt 자동 발급을 먼저 검토한다.
현재 preview 인증서의 Console 미포함만으로 Origin CA를 요청하지 않는다. HTTP-01 실제 실패의 원인과 최소 대안을 확인한 뒤 꼭 필요할 때만 별도 발급을 요청한다.
Full (strict)는 유지하며 preview 인증서를 교체하지 않는다. Origin CA를 사용하면 직접 origin 검사는
해당 CA를 명시적으로 신뢰해 TLS와 HTTP 차단을 구분한다.
[Full strict 조건](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/),
[Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/).

### 2026-10-20 기존 Caddy의 Let's Encrypt 우선 경로

현재 인증서 SAN·ACME 기능·포트와 새 정상 pair 기준 실행물/검증 hash는 [C 결과](P06-C-RESULT.md#2026-10-20-기존-인증서acme-읽기-관찰과-dns-전-준비)가 소유한다.
Console 인증서가 없고 HTTP-01은 공개 DNS와80 포트가 필요하다. 따라서 초기의 DNS 전 origin TLS403 가정은 그대로 실행할 수 없다.
아래 순서는 준비 당시 미승인안이었으며 이후1은 승인 실행,2는 사용자 Cloudflare 변경으로 완료했다. 3은 이후 별도 승인으로 한 번 실행했으나 CA 검증403으로 복구·중단했다.4는 여전히 미승인이다. 아래 최초 순서가 재시도 승인은 아니다. 실제 인증서 발급 성공을 가정하지 않는다.

1. **별도 VM 승인:** 새 정상 pair/receipt·기존 보호 백업을 대조하고 새 `/var/lib/oioi-p06-c-before-https` 백업을 만든다.
   기존 preview 원문에 import만 추가하고 Console **HTTP 전용** 차단 조각을 validate/reload한다. 앱 env·host materializer·컨테이너·인증서는 변경하지 않는다.
   직접 origin의 HTTP403/no-store·Console SNI TLS 거절·preview 세 경로200·네 health/readiness200·DB healthy와 세 container ID/시작 시각 불변을 확인한다. DNS 부재 자체를 차단 증거로 쓰지 않는다.
2. **별도 Cloudflare 승인:** 위 실제 보호 증거 이후에만 기존 캐시 규칙 활성화 → Console Proxied A 생성.
   이때도 Console upstream은 없다. 인증서 확보 전 Full(strict)의 HTTPS 실패 가능성을 정상 인증 경로로 취급하지 않는다.
3. **별도 VM 인증서 승인:** DNS 연결 뒤 Console을 계속 차단한 `closed-acme.Caddyfile` 적용·reload로 기존 Caddy의 Let's Encrypt HTTP-01 발급을 시도한다.
   Console issuer에만 TLS-ALPN challenge를 끄고 preview 설정/갱신은 보존한다. Caddy는 실제 ACME challenge를 자체 처리하며 일반 HTTP/HTTPS는403이다.
   실제 edge→origin의 HTTP challenge 도달·CA 검증은 아직 미검증이다. 제한된 시간 내 실패하면 HTTP 전용 차단으로 복구·중단하고 원인을 확인한다. 무조건 재시도·DNS-only 전환·새 DNS plugin/token 추가는 하지 않는다.
4. **별도 HTTPS 검증 창 승인:** 새 인증서 SAN/체인/유효 기간·Full(strict)·직접 origin403·preview를 확인한 뒤 host materializer/HTTPS env와 제한 matcher의 정확한 실행물·hash·복구 명령을 최종 검토한다.
   env 전환부터 원래 HTTP env/configHash 복구까지 기존 deployment.lock을 유지하며 정상 snapshot은 바꾸지 않는다. 임시 헤더 제거·matcher 제거 후 실제 외부403·Web/DB 보존 계약은 유지한다.

DNS 전 단계의 고정 archive와 root 실행/복구 명령은 RESULT에 연결한다. 이후 위1만 별도 사용자 승인으로 실행해 실제 외부 HTTP403/TLS 거절과 preview·세 컨테이너·snapshot 보존을 확인했다. [운영 결과](P06-C-RESULT.md#2026-10-20-승인된-dns-전-vm-차단-결과)를 따른다. 위2는 사용자가 완료했다.3은 이후 승인된 한 번 실행/복구(exit20)로 종료했고 원인 확인·새 승인 전 재시도하지 않는다.4의 HTTPS 창은 미실행·별도 승인이다. 사용자가 추가 확인한 Always Use HTTPS OFF도 재조사/변경하지 않는다.
[Caddy 자동 HTTPS/HTTP-01 조건](https://caddyserver.com/docs/automatic-https#http-challenge),
[Let's Encrypt HTTP-01](https://letsencrypt.org/docs/challenge-types/#http-01-challenge).

현재 [Caddy 조각](../../../../ops/oci/console.Caddyfile)의 무조건 403으로는 실제 인증 경로를 검증할 수 없다.
제한 경로의 **제안**은 Cloudflare TCP peer와 일회성 검증 헤더를 모두 만족하는 요청에만 proxy를 허용하고,
나머지는 계속 403으로 응답하는 것이다. 고정 사용자 IP·VPN·새 인증 서비스는 요구하지 않는다.
검증 헤더는 Caddy matcher에서 검사한 뒤 `request_header`와 `header_up`에서 제거해 Console upstream에 전달하지 않는다.
보호된 임시 값으로만 공급하고 지정 Console origin에만 보내며 로그·repo·artifact에 남기지 않는다.
실제 Caddy 2.6.2의 matcher·설정 차이·검증 창·제거/복구 명령을 준비해 별도 승인받기 전에는 적용하지 않는다.
loopback/SSH TLS 검증과 실제 Cloudflare 경로의 증거를 구분한다. 종료 시 임시 허용 matcher와 값을 제거하고,
실제 Cloudflare 외부에서 헤더 없음·이전 검증 헤더 모두 403으로 돌아왔는지 다시 실증한다.
기존 preview와 정상 digest pair를 보존한다. 검증 창의 HTTPS env는 종료 시 원래 HTTP env로 복원해
현재 pair snapshot과 runtime env를 일치시킨다. Web/DB는 재생성하지 않으며 Console env 전환/복원에 필요한 재생성만 별도 승인한다.
운영 실행물의 로컬 검증과 첫 백업 범위는 [RESULT](P06-C-RESULT.md#2026-10-19-제한-matcher-운영-실행물의-로컬-검증)를 참조한다.

### 서버 보호 확인 후 사용자가 완료한 Cloudflare 변경

아래 두 변경은 차단·preview 보호 증거 확인 후 2026-10-20 사용자가 순서대로 완료했다. 에이전트가 설정을 다시 조사하거나 변경하지 않는다.

| 순서 | 정확한 요청 | 범위 |
| --- | --- | --- |
| 1 | 기존 `console-bypass-cache` 활성화 | 조건 `http.host eq "console.oioibawige.com"`, Bypass cache 유지. 새 규칙 생성 없음 |
| 2 | DNS A `console` → `129.225.183.112`, Proxied, TTL Auto 생성 | 승인 직전 백업/대조한 같은 preview VM만 대상. DNS-only나 preview CNAME 사용 안 함 |

캐시 제외를 먼저 활성화한 뒤 DNS를 연결한다. Full (strict)·Edge 인증서·기존 Worker/Rules/Managed
Transforms·apex/www/staging/preview는 변경 요청 대상이 아니다.
[Proxied DNS](https://developers.cloudflare.com/dns/proxy-status/),
[Bypass cache](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).

적용 후 실제 HTTPS 브라우저 쿠키·Origin/authority·위조 IP 헤더 거절·서로 다른 실제 client IP의 제한과
IP 변경 시 세션 유지를 검증한다. 인증 응답의 no-store·캐시 HIT 없음·응답 재사용 방지와 preview/Web/DB도 확인한다.
edge challenge나 IP 변형 등 실제 실패가 나오면 그 요청/설정만 추가 조사한다. 공통 대시보드 점검을 반복하지 않는다.
복구는 임시 허용 경로 닫기 → 승인한 Caddy/env/pair 복원·정상 확인 → 이번 Console DNS 제거/캐시 규칙 비활성화 순서로 준비한다.
DNS 제거만으로 접근 차단이 보장된다고 판단하지 않는다. Console 일반 공개와 www 전환은 F에 남긴다.

### 2026-10-20 DNS 연결 후 인증서 단계의 실행·복구 승인 범위

아래 승인안 작성 당시 Cloudflare HTTP와 임의 ACME 경로는 Caddy의403 본문으로 도달하고 HTTPS는525였으며 실제 토큰/CA 검증은 미실행이었다. 이후 실제 CA 검증403과 복구를 확인했다. HTTP-01은80 포트의 실제 challenge 응답으로 검증하므로 임의 경로403만으로 발급 성공을 선언하지 않는다([Let's Encrypt](https://letsencrypt.org/docs/challenge-types/#http-01-challenge)). **아래는 준비 당시 승인안이다. 이후 사용자 승인으로 고정 묶음을 한 번 실행했으나 CA HTTP-01 검증403으로 HTTP403 복구(exit20) 후 중단했다. 현재 이 묶음을 재실행하지 않는다.** [실제 실패·복구 결과](P06-C-RESULT.md#2026-10-20-승인된-인증서-단계-실패와-http403-복구)를 따른다.

- 고정 archive: `.local/p06-c/certificate-window/certificate-reviewed.tar.gz`, SHA-256 `62c6a1fa59e4767c9b7dde1888cafceacac81228eb92250105bcf6f5b3752c43`, 일반 파일4개.
- 실행/복구 operator `certificate-phase.py`: SHA-256 `d6a6fd804c1125621239399453275eb9824d71d415d6163d56bf84d076890ab2`.
- `closed-acme.Caddyfile`: SHA-256 `f2465b620ceb771eab46975c9e9e2cb2e4be153374da8d4bc6204a8422cdf0a9`. 앞서 검토한 같은 조각이며 일반 HTTP/HTTPS 모두403/no-store, upstream 없음.
- 전체 범위·제외·중단 조건은 archive의 `APPROVALS.txt`, 항목 hash는 `SHA256SUMS.json`, 검토 root 본문은 같은 로컬 폴더의 `launch-reviewed.txt`다. 기존 root helper/전체 source manifest hash도 operator에서 고정 대조한다.

다음 다섯 가지는 사용자가 승인했던 1회 범위다. 검토 이력을 보존하며 새 발급/복구 재시도 승인으로 해석하지 않는다.

1. 새 staging `/home/oioi/p06-c-certificate-preparation`의0700/파일0600 전달과 root 메모리 hash/항목 검증 후 새 `/var/lib/oioi-p06-c-certificate-launch`의0700/0600 보호 설치. 기존 경로 충돌 시 즉시 중단한다.
2. 기존 deployment.lock 안에서 두 기존 보호 백업·정상 current/previous/receipt·컨테이너 ID/시작 시각/digest·env/snapshot 불변·health/preview와 현재 Caddyfile `cf202c96...`·HTTP403 조각 `d7dd2ffb...`를 대조한다. 새 `/var/lib/oioi-p06-c-before-certificate`를 root:root·전체 디렉터리0700/파일0600으로 생성해 현재 Caddy/fragment·host/env·두 snapshot/링크·preview 공개 인증서 hash를 보존한다. 기존 백업·preview 개인키/CA 계정/저장소는 덮어쓰지 않는다.
3. 임시 candidate를 Caddy 권한으로 validate한 뒤 **main Caddyfile/import를 그대로 두고** `/etc/caddy/p06-c/active.caddy`만 root:caddy/0640의 고정 조각으로 교체·기존 Caddy reload한다. 기존 Caddy가 Console 전용 Let's Encrypt HTTP-01·인증서/키 저장을 수행한다. preview의 발급/갱신 설정은 그대로다. Console TLS-ALPN만 비활성이다.
4. 최대180초 발급 상태를 관찰하고 첫 Console 발급 error/재시도 로그 또는 시간 초과면 즉시 복구한다. 이는 제어된 활성화 한 번이며 Caddy/CA 내부 HTTP 요청이 정확히 한 번임을 보장하지 않는다. 운영자 수동 재실행·무기한 내부 재시도는 허용하지 않는다.
5. 성공 시 직접 origin의 CA 신뢰·Console SAN/Let's Encrypt issuer/만료와 origin/Cloudflare HTTPS403/no-store·HTTP403을 확인한다. Caddy PID·preview 인증서/세 경로200·두 앱 네 health/readiness200·세 컨테이너/env/snapshot 불변을 재검사한다. 성공한 비프록시 HTTPS403/인증서 갱신 설정은 유지하고 이후 제한 창을 별도 준비한다.

해시 검증·보호 설치 후 사용했던 명령은 다음과 같다. **이미 exit20으로 종료했으므로 재실행하지 않는다.**

```bash
sudo python3 -I -B /var/lib/oioi-p06-c-certificate-launch/certificate-phase.py apply
```

동일 묶음의 복구 명령은 다음과 같다. 자동 복구 한 번이 완료됐으며 추가 실행하지 않는다.

```bash
sudo python3 -I -B /var/lib/oioi-p06-c-certificate-launch/certificate-phase.py restore
```

복구는 같은 잠금/백업 hash/현재 조각 허용 목록 대조 후 **현재 HTTP403 조각**만 복원·validate/reload하고 preview/pair/DB를 검사한다. DNS 전 `deny-http.py restore`는 차단/import 자체를 없애므로 이 단계에서 사용하지 않는다. 적용 후 실패의 자동 복구는 한 번이며 exit20=복구 성공 후 중단,21=복구 실패 후 중단이다. 사전 불일치는1, 정상은0이다. 기존 경로를 삭제하거나 apply를 반복하지 않는다.

인증서 발급/CA 요청 이력은 설정 복원으로 취소되지 않는다. 새 인증서/키·캐시는 삭제/회수하지 않고 보호 보존한다. 복구 후 TLS 거절을 단정하지 않으며 실제 TLS 거절 또는 비프록시403/404를 관찰하고 외부 Cloudflare 응답도 재확인한다. main Caddyfile/기존 preview/HTTP 차단·정상 pair는 보존한다.

HTTPS Origin/env/materializer·컨테이너/DB 재시작·배포/snapshot·임시 허용 matcher·Cloudflare DNS/cache/SSL/WAF/Rules·#166 병합은 제외한다. Full(strict) 해제·DNS-only 전환·Origin CA나 DNS plugin/token 추가도 제외한다. 일반 공개는 F다. 실패 후 원인 분석/새 승인을 받기 전 발급을 재시도하지 않는다. 문서 CI 성공과 실행 직전 전체 hash/상태 대조 후에만 승인 범위대로 실행한다.

### 2026-10-20 Cloudflare 국가 챌린지 규칙의 ACME 예외(승인안)

실제 CA 검증 요청에 사용자 지정 Managed Challenge가 적용된 화면과 사용자가 제공한 두 규칙 식은 [C 결과](P06-C-RESULT.md#2026-10-20-승인된-인증서-단계-실패와-http403-복구)를 따른다. 미국 검증 요청이 `(ip.src.country ne "KR")`에 해당하므로 이 식의 규칙 한 건만 변경 대상으로 지정한다. `/admin` 식은 변경하지 않는다. **아래 식 한 건의 변경/원복·갱신용 유지는 이후 별도 승인받았고 사용자가 적용을 완료했다. 인증서 재시도 승인은 아니다.** [변경 후 실제 경계/상태 확인](P06-C-RESULT.md#2026-10-20-승인된-국가-규칙-acme-예외-적용과-상태-확인)을 따른다.

변경 직전 국가 규칙의 이름/ID·원본 식·Action·활성 상태·순서를 보관한다. 원본 식이 정확히 `(ip.src.country ne "KR")`, Action이 Managed Challenge인지 대조하고 다르면 저장하지 않는다. Action·활성·순서를 보존하고 식만 다음으로 바꾸는 범위를 별도 승인받아 사용자 대시보드에서 실행했다. 아래 사전 대조 조건은 그 실행 이력이며 새 저장 요청이 아니다.

```text
(ip.src.country ne "KR") and not (
  http.host eq "console.oioibawige.com"
  and http.request.method eq "GET"
  and starts_with(http.request.uri.path, "/.well-known/acme-challenge/")
)
```

이 국가 규칙에서만 해당 host/GET/ACME prefix를 제외한다. 해외의 일반 Console 경로·다른 method·다른 host/preview에는 기존 국가 조건을 유지하고 `/admin` 규칙과 다른 보안 기능은 그대로 둔다. [Cloudflare starts_with](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/#starts_with)와 [국가 필드](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/ip.src.country/)를 대조했다. 전체 WAF/남은 사용자 지정 규칙 Skip을 새로 만들지 않는다. 원본 Caddy의 일반403·upstream 격리도 유지한다.

원복 식은 보관한 `(ip.src.country ne "KR")`다. 변경 후에는 외부 일반 HTTP403·미활성 임의 ACME403·preview/기존 pair 보존을 읽기 확인하며, 이것을 유효 토큰200/발급 성공으로 보고하지 않는다. **이번 요청은 국가 규칙 식 한 건 변경/원복과 상태 확인만**이다. Full(strict)·Always Use HTTPS OFF·DNS/cache·다른 규칙·Caddy/env/컨테이너·#166 병합은 포함하지 않는다.

예외는 이후 HTTP-01 자동 갱신에도 사용할 **유지 범위**로 승인받아 적용했다. 변경/유지 또는 원복은 승인 범위대로 수행하고 임의로 전체 보안을 끄지 않는다. 인증서 재시도는 이미 실행한 archive62c6a1fa...를 반복하지 않으며 새 고정 실행물/보호 경로·복구 범위를 확정해 별도 승인받는다. 현재 HTTP403 복구 상태와 모든 백업은 보존한다.

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

이 절은 F의 최종 전환 값이다. C에서는 §2의 **Console만** 별도 승인하며 www/apex/preview는 유지한다.
지금 Save/연결 해제/삭제하지 않는다.
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

- [x] Cloudflare DNS/Worker/관련 규칙 기록 — 2026-10-19 사용자 대시보드 확인, RESULT 참조.
- [x] Console 캐시 Bypass 규칙 준비·SSL mode/Edge 인증서 기록 — 2026-10-20 사용자 규칙 활성화·Proxied DNS 생성 완료. origin 인증서·인증 응답 검증은 별도.
- [ ] Console 키 두 개의 Vault OCID와 보호된 복구 사본 준비.
- [ ] 기존 OCIR/GitHub 설정과 Stack 소스 SHA/path·주체/domain·세 compartment·정책 기록.
- [ ] ARM64 빌드 전 승인된 B0 Plan/Apply·push/pull·새 secret 읽기·새 Run Command 증거 확보.
- [ ] VM의 Caddy 배치·설정 경로·포트·자원·시간 동기화 기록.
- [ ] assets/R2의 실제 연결과 이관 필요 여부 확인.

체크는 실제 준비 완료 후 한다. 이 문서 작성에서 운영 Vault/VM/DB 조회나 외부 변경은 실행하지 않았다.
