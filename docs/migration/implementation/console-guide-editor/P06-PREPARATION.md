---
title: "P06 외부 환경 사전 준비 안내"
kind: migration-plan
status: draft
authority: plan
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-10"
updated_at: "2026-10-21"
revision: 17
---

# P06 사전 준비: 지금 할 일과 전환 때 할 일

2026-10-19 C 추가 안내: Cloudflare 대시보드 사전 점검은 사용자 확인으로 완료됐다.
확인 사실은 [P06-C RESULT](P06-C-RESULT.md#2026-10-19-cloudflare-대시보드-사전-점검사용자-확인)가 소유하며,
추가 변경·승인 순서는 아래 §2를 따른다. 별도 사용자 승인으로 1차 보호 백업과 #164의 기존 HTTP 공동 배포를 완료했다.
실행·receipt·VM 검증은 [C 운영 결과](P06-C-RESULT.md#2026-10-19-승인된-보호-백업과-http-공동-배포)가 소유한다.
#166은 Draft·미병합이다. HTTP 전용 차단의 Caddy validate/reload를 먼저 별도 승인으로 완료했고 HTTPS Origin은 미실행이다. 최초 인증서 단계는 CA 검증403으로 HTTP403 복구(exit20) 후 중단했다. 이후 Cloudflare 국가 규칙 예외 적용과 새 실행물 별도 승인으로 **재시도1 발급 성공(exit0)·closed HTTPS403·서비스 보존**을 확인했다. [실제 성공 결과](P06-C-RESULT.md#2026-10-20-승인된-인증서-재시도1-성공과-서비스-보존)를 따른다. 고정 묶음을 수동 반복하지 않는다. Cloudflare 캐시 규칙 활성화·Proxied Console A 생성은 앞서 사용자가 완료했다. 공개 DNS/HTTP 관찰과 검토했던 인증서 범위는 아래 §2, 최초 실패/복구 이력은 [C 결과](P06-C-RESULT.md#2026-10-20-승인된-인증서-단계-실패와-http403-복구)를 따른다.
2026-10-20 인증서 읽기 관찰을 반영한 **기존 Caddy의 Let's Encrypt 우선 경로**는 아래 §2의 추가 안내를 따른다.
아래 B0/Vault 등 초기 준비 안내를 새 실행 요청으로 해석하지 않는다.

**2026-10-20 전제 정정:** VM 직접 READ ONLY 조회에서 계정·비밀번호 credential·MFA가 모두0행이었다. 아래 기존 관리자 문구는 최초 준비 전제의 이력이며 현재 확인 사실이 아니다. [실측 결과](P06-C-RESULT.md#2026-10-20-vm-계정-실측과-최초-운영자-준비)와 [최초 운영자 선행 승인안](#2026-10-20-vm-최초-운영자-계정과-mfa-선행-승인안)을 먼저 따른다. 기존 HTTPS 창은 자격 조회 exit2에서 중단했으며 개방하지 않았다.

**최초 전제: preview에서 만들어 둔 기존 관리자 계정을 그대로 사용한다.** 관리자 계정 생성·승격은
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
초기 전체 전환의 포괄 복구 참고 순서는 임시 허용 경로 닫기 → 승인한 Caddy/env/pair 복원·정상 확인 → Console DNS 제거/캐시 규칙 비활성화였다. 이는 현재 인증 검증 창의 자동 복구/승인 범위가 아니다.
아래 최종 인증 창은 기존 DNS/cache·ACME 예외와 확보한 인증서/갱신을 보존하고 closed HTTPS403으로 복귀한다. DNS 제거만으로 접근 차단이 보장된다고 판단하지 않는다. Console 일반 공개와 www 전환은 F에 남긴다.

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

### 2026-10-20 인증서 재시도1 실행·복구 승인안

**아래는 검토한 승인안의 이력이다. 이후 이 고정 묶음만 별도 승인받아 전달·사용자 root 실행했고 발급 성공(exit0), 복구 미실행·기존 서비스 보존을 확인했다. apply/restore를 수동 재실행하지 않는다.** [실제 결과](P06-C-RESULT.md#2026-10-20-승인된-인증서-재시도1-성공과-서비스-보존)를 따른다. 기존 실패 archive/launch·세 보호 백업은 보존하고 이전 인증서 controller를 호출하지 않았다. 승인 전 읽기 재확인/로컬 검증은 [C 결과](P06-C-RESULT.md#2026-10-20-인증서-재시도1-준비와-읽기-재확인)가 소유한다.

| 새 고정 실행물(로컬 `.local/p06-c/certificate-retry1/`) | SHA-256 |
| --- | --- |
| `certificate-retry1-reviewed.tar.gz`(일반 파일4개) | `148c1b87ae1716d2c8e19933a34730ddf5296bc92be1fe78123481db9d37c895` |
| `certificate-phase.py` | `97d79757daf5be8bd78c865c6ed1cf7aa23c7add5ef469dd98ef8dde9396259e` |
| `launch-reviewed.txt`(root 검토 본문) | `8dfe8061cf47dc590b92efebb0b3b51dd88b19607d1bd91e6c4bd7e1300962c7` |

archive에는 위 operator·기존 검토 `closed-acme.Caddyfile`(SHA f2465b62...)·`APPROVALS.txt`·`SHA256SUMS.json`만 포함한다. launcher는 archive 전체/내부 항목 hash를 root 메모리에서 대조하고 새 launch 경로에만 O_EXCL로 설치한다. 새 staging은 `/home/oioi/p06-c-certificate-retry1-preparation`(0700/파일0600), 새 launch는 `/var/lib/oioi-p06-c-certificate-retry1-launch`(root:root0700/0600)다. 기존 경로 충돌/불일치는 즉시 중단한다.

사용자가 승인한 재시도1 실행 범위는 다음과 같다. 아래 이력은 추가 실행 승인이 아니다.

1. 최신 문서 CI 성공·정상 receipt12192252859/고정 후보·현재 HTTP403/main Caddyfile·Cloudflare GET ACME 예외·preview/앱/DB·보호 상태를 실행 직전 재대조하고 새 고정 묶음만 전달/보호 설치한다. 기존 deployment.lock 안에서 세 백업의 권한/사본 hash와 현재 정상 source/링크·컨테이너/preview/PID를 검증한다. 실패 전 백업은 새 operator의 읽기 함수로 검증한다.
2. 새 `/var/lib/oioi-p06-c-before-certificate-retry1`에 현재 main Caddy/HTTP403 조각·host/env·current/previous snapshot/링크·컨테이너 metadata·preview 공개 인증서 hash를 root:root·전체 디렉터리0700/파일0600으로 보호 복사한다. 기존 백업/인증서/개인키/계정 저장소를 덮어쓰지 않는다.
3. 새 `/etc/caddy/p06-c/certificate-retry1-candidate.caddy`와 `/etc/caddy/p06-c-certificate-retry1-check.Caddyfile`로 Caddy 권한 validate 후 임시 파일을 제거한다. main Caddyfile/import는 유지하고 active.caddy만 고정 closed-acme 조각으로 교체·reload한다. Console upstream 없이 일반 HTTP/HTTPS403·no-store를 유지한다.
4. 기존 Caddy의 Console 전용 Let's Encrypt HTTP-01 **활성화 한 번·최대180초 관찰**로 한정한다. 첫 실제 Console 발급 오류/재시도 로그·시간 초과·후속 검증 실패 시 현재 HTTP403 조각으로 자동 복구 한 번 후 중단한다. Caddy/CA 내부 네트워크 요청이 정확히 하나임을 보장하지 않는다. 실패 exit20은 복구 검증 성공,21은 복구 검증 실패, 사전 불일치1·정상0이며 수동 반복/임의 재시도는 금지다.
5. 성공 시 직접 origin의 CA 신뢰·Console SAN·Let's Encrypt issuer·만료일과 정확한403/no-store를 확인한다. Cloudflare HTTPS는 승인된 ACME 예외의 probe 경로로 **정확한 Caddy 차단 본문**까지 대조한다. Edge challenge403을 origin 성공으로 인정하지 않는다. 일반 공개HTTPS 차단도 외부에서 읽기 확인한다. preview 세 경로200/기존 인증서 hash·네 앱 health/readiness200·세 컨테이너 ID/start/image/healthy·env/snapshot/PID 보존을 검증하고 SAN/issuer/유효기간 metadata만 보고한다. 성공한 closed HTTPS403/자동 갱신 설정은 유지한다.

별도 승인·hash 검증·신규 root 설치 후 아래 `apply`를 한 번 실행했고 exit0으로 종료했다. `apply`는 실패 시 내부에서 `restore`를 한 번 호출하지만 이번에는 복구하지 않았다. 아래 두 명령을 수동 반복/추가 실행하지 않는다.

```bash
sudo python3 -I -B /var/lib/oioi-p06-c-certificate-retry1-launch/certificate-phase.py apply
```

검토했던 복구 명령(이번 실행에서는 미사용):

```bash
sudo python3 -I -B /var/lib/oioi-p06-c-certificate-retry1-launch/certificate-phase.py restore
```

복구는 새 보호 사본의 현재 HTTP403 조각만 validate/복원/reload하고 정상 pair/preview/DB·PID를 확인한다. main Caddyfile/import와 기존 백업은 유지한다. 발급/CA 요청 이력은 취소되지 않으며 발급된 인증서/키·캐시를 삭제/회수하지 않는다. 복구 후 TLS 거절 또는 비프록시403/404와 실제 외부 응답을 확인하고 중단한다.

이번 승인안은 Cloudflare 추가 변경·Full(strict) 해제·DNS-only 전환·Origin CA/DNS plugin/token 추가·HTTPS Origin/env/materializer·임시 허용 matcher/인증 접근·컨테이너/DB 재시작/배포/snapshot 변경·preview 인증서 교체·#166 병합을 제외한다. 일반 공개는 F에 유지한다. 인증서/개인키 원문은 출력하지 않는다.

### 2026-10-20 제한 HTTPS 인증 검증 창 최종 실행·복구 승인안

**후속 상태:** 아래는 최초 고정 준비안이다. 이후 승인된 전달/보호 설치와 사용자 root 자격 조회를 수행해 exit2로 중단했다. 직접 VM 집계로 계정/MFA0행을 확인했다. 기존 묶음/설치는 보존하며 먼저 아래 [최초 운영자 선행 승인안](#2026-10-20-vm-최초-운영자-계정과-mfa-선행-승인안)을 검토한다. 등록 후 바뀐 Console ID를 이 묶음에 임의 대입해 재실행하지 않는다.

**준비만 완료·별도 승인 전 VM 전달/DB 조회/전환/개방 금지다.** 현재 정상 기준은 재시도1에서 확보한 인증서/closed HTTPS403과 #164의 HTTP pair·receipt다. 기존 인증서·LE HTTP-01 자동 갱신·Cloudflare GET ACME 예외·DNS/cache를 유지한다. 기존 실패/재시도1의 apply/restore는 호출하지 않는다. 사용자 확인과 로컬 검증의 실제 범위는 [C 결과](P06-C-RESULT.md#2026-10-20-제한-https-인증-창-최종-실행물-준비)가 소유한다.

| 새 고정 실행물(로컬 `.local/p06-c/https-auth-window/`) | SHA-256 |
| --- | --- |
| `auth-window-reviewed.tar.gz`(일반 파일9개) | `6dc1453a0e6bfad6d9c2c07bbedd79e2825f8fae92b22c7d3c64d0f47bcd56e2` |
| `window.py` | `e1ee3554ff210da5df83e017b116343ffdd77ec51c18d9a2cf96b6b5664cce6e` |
| `launch-reviewed.txt`(보호 설치·읽기 조회까지만) | `593ea85d03a1ea7eb091260e127a25c4cb02ec60d67f2ea4e5348e0d599eb09c` |
| `browser.mjs`(로컬 실제 브라우저) | `02fe66f0052e5576f34d1eaba937caa8768f1c5bb03cae3a856601c8c12e6fd4` |

archive는 operator·renderer·기존 closed/source Caddy 조각·HTTPS 지원 materializer·MFA 자격 읽기 SQL·로컬 browser·`APPROVALS.txt`·`SHA256SUMS.json`이다. 입력 이메일/임시 token·인증서/키·env 원문을 포함하지 않는다. 전체/내부 hash·기존 정상 상태/권한을 실행 직전에 대조하고 충돌/불일치는 중단한다.

**개방 선행 조건:** 사용자는 Console TOTP 등록/인증 앱 보유 여부를 기억하지 못한다고 답했다. 먼저 승인된 `eligibility`가 기존 `oioi_app` 자격으로 BEGIN READ ONLY·5초 statement timeout 안에서 대상 DB/비특권 role/PostgreSQL17과 입력 이메일의 존재·ACTIVE ADMIN·MFA enabled 여부 boolean만 확인한다. password hash·MFA secret/키/복구코드는 조회하지 않는다. DB 자격은 root 메모리→기존 DB 컨테이너 psql의 stdin으로만 전달하고 argv/출력에 넣지 않는다. **이 조회는 아직 실행하지 않았다.** 미등록/계정 부적격은 exit2·창 미개방이며 등록/reset·키/권한 변경으로 우회하지 않는다. eligible=true여도 사용자가 인증 앱/비밀번호와 PC의5G 핫스팟 전환 준비를 확인하기 전에는 `start --operator-ready`를 실행하지 않는다.

승인받을 변경/검증 범위는 다음과 같다. 상세 단계·제외·중단 조건은 고정 `APPROVALS.txt`를 따른다.

1. 새 staging `/home/oioi/p06-c-auth-window-preparation`(0700/0600)과 root launch `/var/lib/oioi-p06-c-auth-window-launch`(root:root0700/0600)에만 설치한다. 보호 입력2개(기존 이메일·256-bit token)는 별도로 검증/복사하며 로그·Git·archive에 넣지 않는다. launcher는 설치/읽기 자격 조회까지만 수행하고 자동으로 열지 않는다.
2. 준비 확인 뒤 transient `oioi-p06-c-auth-window.service`를 한 번 시작한다. RuntimeMaxSec1800·TimeoutStopSec240·Restart=no·종료 후 collect이며 영구 service/timer/부팅 설정은 없다. service가 deployment.lock을 전환 전부터 종료/복구 검증까지 유지한다. 기존 네 보호 백업/현재 원본·current/previous/receipt·image/configHash를 대조한 뒤 새 `/var/lib/oioi-p06-c-before-auth-window`에 현재 closed Caddy·host/public/raw env·두 snapshot/링크·컨테이너 metadata를 root:root·전체 디렉터리0700/파일0600으로 보호 복사한다.
3. Caddy를 닫아 둔 채 materializer를 검증된 HTTPS 지원 코드로 임시 교체하고 Console public/raw env의 `CONSOLE_ORIGIN` 한 줄만 HTTPS로 바꾼다. Secret·enrollment=false는 유지한다. 기존 digest/안정된 env 경로로 `docker compose up -d --no-deps --no-build --pull never --wait --wait-timeout 90 console`만 실행한다. Web/DB·이미지/pair/receipt/snapshot은 변경하지 않는다. Console ID/start는 전환/복원으로 바뀌며 보존 대상은 image·원래 env/configHash·snapshot이다.
4. 앱 필수 Host 헤더 누락/위조 거절·health·Web/DB 불변을 확인하고 새 candidate 두 경로(`/etc/caddy/p06-c/auth-window-candidate.caddy`, `/etc/caddy/p06-c-auth-window-check.Caddyfile`)를 Caddy 권한으로 validate/제거한다. main Caddyfile/import·HTTP403·LE issuer/HTTP-01은 그대로 두고 HTTPS의 CF TCP peer AND 임시 header handle만 적용/reload한다. 임시 header는 검사 뒤 request_header/header_up에서 제거한다. 허용 handle의 `X-P06-Observed-Client-IP` 응답 header로 기존 CF client IP를 검증하고 종료 때 함께 제거한다. 일반 요청/직접 origin은403을 유지한다.
5. 로컬 headed Chromium의 같은 context에서 사용자가 직접 입력해 실제 로그인/MFA·쿠키·Origin/CSRF·IP·캐시를 검증한다. CDP Fetch는 정확한 Console origin에만 token을 공급하고 redirect/다른 host에서는 제거한다. 비밀번호/TOTP는 브라우저/검증 프로세스 메모리에만 있고 trace/HAR/video/screenshot/storageState·Secret 로그를 만들지 않는다. 기존 `/admin` Cloudflare Challenge는 브라우저에서 완료하며 통과 불가 시 닫고 중단한다. WAF/규칙을 변경하지 않는다.
6. 검증 성공은 password-only/잘못된OTP 거절·실제 UI+TOTP 성공/보호 GET·소모한OTP 재사용 거절, Secure/HttpOnly/Lax/host-only 쿠키와 Web 비전달, 누락/위조 Origin·CSRF 거절, forwarded 헤더 덮어쓰기/앱 Host 검사, 같은 URL의 no-store/캐시 HIT/다른 context 응답 재사용 없음·브라우저 logout/redirect를 포함한다. 정상 로그인은 기존 서비스 계약의 MFA last_used_step을 소비하며 이를 DB snapshot으로 되돌리지 않는다. MFA 등록/reset·새 계정/seed·컨텐츠 CRUD는 하지 않는다.
7. 집 Wi-Fi에서 서로 다른 **미존재** 이메일로 최대22회 실패시켜 IP 제한과 위조 IP 헤더의 우회 불가를 확인한다. 동일 PC/브라우저를5G 핫스팟으로4분 안에 옮겨 실제 CF IP 변경·B의 독립 실패 처리·기존 세션 identity/보호 GET 유지를 확인한다. 알려진 unknown 공통 제한·동일 IP·시간 초과는 성공으로 대체하지 않는다. IP 변경 뒤의 기존 CF Challenge는 재로그인 없이 브라우저에서 완료한다.
8. 브라우저 정상 종료는 staging에 `finish`, 실패/종료는 `abort`를 O_EXCL로 요청한다. 이 통로는 닫기만 허용한다. service는 최대30분/중단/오류 시 정해진 복구를 수행하고 ExecStopPost는 본체 비정상 종료 후 최종 결과가 없을 때만 보호 복구한다. **먼저 matcher/token/진단 header를 제거한 기존 closed-acme 원문으로 validate/복원/reload → 이전 token/헤더 없음의 외부403 → 원래 materializer/public/raw HTTP env 복원 → Console만 같은 digest로 재생성 → 원본 hash/current·previous/pending 부재·원래 configHash/두 digest·preview/앱/DB 검증** 순서다. 관련 없는 env drift도 known matcher부터 닫고 덮어쓰지 않으며 exit21로 중단한다. main 자체의 불일치는 임의 교정하지 않는다.

검토 명령은 다음과 같다. 모두 승인·보호 설치/입력 준비 뒤에만 사용하며 현재는 실행하지 않는다.

```bash
# root launcher는 eligibility까지만 실행. 아래 개방은 eligible=true와 사용자 준비 확인 뒤 한 번만.
sudo python3 -I -B /var/lib/oioi-p06-c-auth-window-launch/window.py start --operator-ready
```

```bash
# 로컬 터미널: prepare는 입력2개만 생성, run은 실제 창/브라우저가 준비된 뒤 실행.
node .local/p06-c/https-auth-window/browser.mjs prepare
node .local/p06-c/https-auth-window/browser.mjs run
```

```bash
# 수동 중단: service에 정상 종료를 요청해 정해진 복구를 수행한다.
sudo systemctl stop oioi-p06-c-auth-window.service
sudo python3 -I -B /var/lib/oioi-p06-c-auth-window-launch/window.py status
```

```bash
# service가 이미 비활성이고 최종 결과가 없을 때만 사용하는 동일 보호 복구 본문.
sudo python3 -I -B /var/lib/oioi-p06-c-auth-window-launch/window.py recover
```

eligibility0은 자격 확인/미개방,2는 부적격/미개방이다. window0은 정상 종료·원복 검증,20은 실패/중단/만료 후 복구 검증,21은 복구 검증 실패,1은 사전 불일치다. result21 뒤 수동 반복/재개방은 금지한다. **root exit0과 실제 browser proof가 모두 있어야 해당 인증 검증을 완료로 판단한다.** 종료 후 일반 외부/이전 token 모두403·진단 header 없음과 정상 HTTP pair/env/configHash·preview/Web/DB 보존을 실증한다.

인증서/키·CA 계정/캐시·자동 갱신·Cloudflare ACME 예외/DNS/cache는 복구 대상이 아니다. 추가 Cloudflare 변경·인증서 재발급/삭제·MFA 등록/reset·계정/권한/키 변경·수동 DB 수정·Web/DB 재시작·새 배포/Promotion·snapshot 승격/수정·일반 공개·#166 병합·파이프라인 변경은 제외한다. 다음 실제 VM 실행은 이 고정 묶음/복구 범위의 별도 승인 대상이다.

### 2026-10-20 VM 최초 운영자 계정과 MFA 선행 승인안

현재 VM 계정/MFA 부재와 기존 Web 메일의 metadata 의존성·로컬 전용 CLI 확인은 [C 결과](P06-C-RESULT.md#2026-10-20-vm-계정-실측과-최초-운영자-준비)가 소유한다. 다음은 **신규 묶음의 준비안이며 VM 전달/설치·실제 메일/계정/등록/env 변경은 아직 승인·실행하지 않았다.** 기존 HTTPS 실행 승인에 계정 생성/승격·MFA 등록이 포함됐다고 해석하지 않는다.

| 새 고정 실행물(로컬 `.local/p06-c/operator-bootstrap/`) | SHA-256 |
| --- | --- |
| `operator-bootstrap-reviewed.tar.gz`(일반 파일6개) | `429657cf64d9ec0e93acc8dfa8dbb70a49e54dffe202eb8a292100047cd2abce` |
| `bootstrap.py` | `cb04eaf769a032e5778a5fc62d461577cb0084a0f4321d59a8970074c3bee75c` |
| `worker.cjs` | `fc6bbaff96a35f9172589e2cb03362e1cc0b45712ecae20d9fef404ddd5191a3` |
| `enroll.mjs` | `6a904b6c606dd67f2776ac362cf4f85d4797276802ce7a645bd8981423616762` |
| `launch-reviewed.txt` | `b9fcd0fe5c78759f948ec0e1fa8b2551dd0d6234ba39912c8d78999ce4d5a9e3` |

archive에는 operator·기존 서비스 bundle·로컬 등록 browser·`APPROVALS.txt`·source provenance·전체 내부 hash만 있다. 대상 이메일은 기존 root 보호 입력에서 읽고 비밀번호/메일 OTP/QR/키/코드를 archive·argv·로그·Git에 넣지 않는다. 새 비밀번호는 사용자 VM 터미널의 숨김 입력으로 받고 실물 TOTP는 본인 브라우저에만 입력한다. 채팅에 공유한 비밀번호를 사용하지 않는다.

승인받을 정확한 범위는 다음과 같다. 상세 중단/제외는 고정 `APPROVALS.txt`를 따른다.

1. 최신 문서 CI·#164 고정 source/정상 receipt12192252859·동일 두 digest와 현재 인증서/closed403·preview/앱/DB·네 보호 백업/원본·새 경로 부재를 대조한다. 사용자 staging `/home/oioi/p06-c-operator-bootstrap-preparation`(0700/파일0600)에 archive/launcher만 전달하고 root 메모리 전체/항목 hash 검증 후 새 `/var/lib/oioi-p06-c-operator-bootstrap`(root:root0700/0600)에 설치한다. 충돌/불일치는 중단한다.
2. 기존 개인 SSH 사용자 UID1002의 sudo 실행·실제 TTY와 deployment.lock·DB명/role/비특권/비owner/RLS/major17/DB 시작 epoch를 검사한다. TTY 부재는 메일/DB 변경 전에 거절하고 operator 전용 DB pool1·statement_timeout10초/lock_timeout5초를 적용한다. 새 `/var/lib/oioi-p06-c-before-operator-account`에 원본 host/env·두 snapshot/링크·컨테이너/PID와 auth6개 테이블의 pg_dump17 data-only 사본/sha를 root-only 보존한다. 일반 deploy/ocarun 권한을 늘리거나 DB schema/role을 바꾸지 않는다.
3. 기존 Console 이미지의 별도 `docker exec` Node process에서 기존 requestOtp/verifyOtp/completeSignup 서비스를 그대로 실행한다. 메일 transport만 root host로 위임하고 host가 현재 sender/region/compartment·Instance Principal로 **지정 이메일 한 곳에 인증 메일을 한 번** 제출한다. OCI CLI의 `--no-retry --from-json file:///dev/stdin`으로 payload/OTP를 메모리/pipe에만 두며 Web/Console metadata deny는 유지한다. suppressed·거절·불확실 제출·timeout은 수동 재시도 없이 중단한다. 이는 일반 Web 메일 경로 복구가 아니다. CLI 전송 옵션은 [OCI 공식 문서](https://docs.oracle.com/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/email-data-plane/email-submitted-response/submit-email.html)를 대조했다.
4. 사용자의 이메일 OTP/새 비밀번호 숨김 입력 후 실제 가입 transaction으로 USER/ACTIVE Account/Profile/Argon2id credential 한 개를 만든다. nickname은 `oioi-operator`다. 이어 같은 ID의 USER/ACTIVE/version없음을 확인하고 기존 공통 변경·회수 service로 ADMIN/ACTIVE/version1만 승격한다. 운영 UID/시각/대상/결과/승인 연결의 root-only marker를 보존한다. 가입/OTP·MFA version을 직접 SQL로 우회하지 않는다. 계정 단계 실패/불확실 성공은 반복·자동 삭제·전체 DB restore 없이 중단한다.
5. 계정 준비 성공 후 새 transient `oioi-p06-c-enrollment.service`를 한 번 실행한다(RuntimeMaxSec1800/Restart=no/TimeoutStopSec240/ExecStopPost 보호 복구). 새 `/var/lib/oioi-p06-c-before-enrollment`에 정상 파일/컨테이너를 보호 백업하고 잠금을 복구 검증까지 유지한다. Origin은 HTTP127.0.0.1:3001이며 Console public/raw env의 등록 flag만 true로 바꾸고 동일 digest로 Console만 `--no-deps --no-build --pull never --wait` 재생성한다. Caddy/metadata·인증서/갱신·Cloudflare·Web/DB·pair/snapshot은 바꾸지 않는다.
6. 로컬 `enroll.mjs`가 자기 SSH localhost3001 포워드와 headed Chromium을 연다. 기존 포트 충돌은 중단하며 타 process를 종료하지 않는다. 기존 UI에서 실물 인증 앱 QR 등록→confirm→다음 새 OTP 로그인→보호 GET200→로그아웃을 사용자가 수행한다. 로컬 browser는 외부 요청을 차단하고 QR/password/OTP·trace/HAR/video/screenshot/storageState를 저장하지 않는다. 완료/실패는 staging의 finish/abort close.request로 닫기만 요청한다.
7. 정상/중단/30분 만료·오류는 원래 public/raw env를 보호 사본으로 복원하고 Console만 같은 digest로 재생성한다. setup/confirm403·등록 버튼 제거, 원래 HTTP/configHash·모든 원본 hash/링크·pending 부재·Web/DB ID/start/image·네 앱 health/readiness·preview 세 경로200/인증서·Console 인증서/일반 외부403·Caddy PID를 확인한다. 등록 창 변경 후 실패는 설정 복구 다음에 새 ADMIN/version1을 기존 service로 USER/version2로 한 번 회수한다. account/MFA 행은 보존하며 secret 삭제/reset·소모한 step 되돌리기·전체 DB restore는 하지 않는다. 미지 drift/version 불일치·복구 실패는 exit21로 중단한다.

승인·고정 hash·보호 설치 후 root launcher가 `account` 성공 때만 `enroll-start`로 연결한다. 다음은 검토 명령이며 현재 실행하지 않는다.

```bash
sudo python3 -I -B /var/lib/oioi-p06-c-operator-bootstrap/bootstrap.py account
sudo python3 -I -B /var/lib/oioi-p06-c-operator-bootstrap/bootstrap.py enroll-start
# 로컬 터미널: 실제 등록 창이 준비된 뒤 한 번 실행
env -u DEBUG -u PWDEBUG node .local/p06-c/operator-bootstrap/enroll.mjs
```

```bash
sudo systemctl stop oioi-p06-c-enrollment.service
sudo python3 -I -B /var/lib/oioi-p06-c-operator-bootstrap/bootstrap.py status
# service 비활성·최종 결과가 없을 때만 동일 보호 복구
sudo python3 -I -B /var/lib/oioi-p06-c-operator-bootstrap/bootstrap.py recover
# 계정만 만든 뒤 등록 시작 전 철회할 때의 고정 권한 회수
sudo python3 -I -B /var/lib/oioi-p06-c-operator-bootstrap/bootstrap.py revoke
```

account0은 계정 준비/등록 미실행, account1은 중단/재실행 금지다. enrollment0은 정상 등록/종료·설정 복구,20은 실패/중단/만료 후 복구와 권한 회수,21은 복구/회수 검증 실패로 중단이다. root0과 실제 browser proof가 모두 있어야 등록 검증을 완료로 판단한다. 사전 불일치는 창을 열지 않으며 생성한 계정은 별도 고정 revoke 명령으로 회수할 수 있다.

등록 후 Console ID/start가 바뀌므로 기존 HTTPS archive6dc1453a...를 그대로 실행하지 않는다. 새 보호 baseline과 실제 ID/configHash를 읽기 대조해 HTTPS 실행물의 새 hash/복구안을 제시하고 별도 승인받는다. 인증서·자동 갱신·ACME 예외·원래 image/configHash/pair/snapshot은 유지한다. 이 단계는 C 완료나 D 전체 완료가 아니다. 일반 Web 메일 경로 변경·metadata 차단 해제·새 IAM/token/SMTP·Cloudflare/Caddy/HTTPS Origin·임시 인증 matcher·일반 공개·Web/DB 재시작·새 이미지/배포·#166 병합·새 PR/파이프라인 변경은 제외한다.

### 2026-10-21 인증된 가입의 재개1

최초 운영자 실행의 메일 수신·OTP 검증 성공과 계정 단계 exit1, 계정0·VERIFIED 관찰은 [최신 결과](P06-C-RESULT.md#2026-10-21-최초-운영자-메일인증-성공과-가입-중단재개1)를 따른다. 기존 launcher/account는 재실행하지 않는다. 사용자가 재시도를 지시했으며 ignored `operator-resume1/APPROVALS.txt`·`run-reviewed.txt`에 다음 최소 실행 범위를 고정했다.

- 새 staging `/home/oioi/p06-c-operator-resume1-preparation`(UID1002/0700·파일0600), root `/var/lib/oioi-p06-c-operator-resume1`(root700/600), 보호 백업 `/var/lib/oioi-p06-c-before-operator-resume1`만 추가한다. archive/내부 hash·기존 bootstrap 고정 hash·최신 CI/정상 receipt·기존 백업/원본·현재 pair/서비스·닫힌 인증서를 먼저 대조한다.
- 기존 이메일·생성/검증 시각에 정확히 일치하는 유일한 미소모 VERIFIED와 계정0·DB 시작 시각·미생성 계정/승격/등록 marker를 확인한다. 새 메일/OTP·TTL 변경은 없다. 비밀번호10~32자·영문/숫자/특수문자·두 입력 일치를 숨김 입력으로 검사하고 값 대신 이유를 표시한다. 변경 전 입력 교정은 최대3회다.
- deployment.lock을 유지하며 설정/snapshot·auth6개 테이블을 새로 보호 복사한 뒤 기존 signup 한 번·공통 ADMIN/version1 승격 한 번만 수행한다. 감사 marker는 원래 root의 미생성 경로에 O_EXCL로 추가한다. 실패/불확실 응답은 phase와 exit1로 중단하고 재실행/직접 SQL/DB 전체 복원은 하지 않는다.
- 계정 준비 성공 뒤에만 기존 승인된 `bootstrap.py enroll-start`를 한 번 시작한다. SSH 실물 MFA/다음 새 OTP 로그인과 원래 등록 닫기·실패 시 USER/version2 회수 계약을 유지한다. 등록 전 철회는 기존 `bootstrap.py revoke`, 열린 등록 unit 중단은 `sudo systemctl stop oioi-p06-c-enrollment.service`다.

고정 hash는 RESULT를 따른다. 새 root 실행은 `sudo python3 -I -B /var/lib/oioi-p06-c-operator-resume1/resume.py`이며 설치 launcher는 성공 때만 원래 enroll-start를 이어 호출한다. Cloudflare/Caddy/HTTPS Origin/임시 허용·일반 공개·Web/DB 재시작·pair/snapshot·배포 파이프라인·#166 병합은 범위 밖이다. 등록 후 새 Console ID 기준으로 HTTPS 묶음을 다시 고정하고 별도 승인받는다.

### 2026-10-21 등록된 MFA를 보존하는 권한 복구1

실물 등록 후 helper 중단/자동 USER 회수와 현재 닫힌 VM 관찰은 [최신 결과](P06-C-RESULT.md#2026-10-21-실물-mfa-등록과-브라우저-helper-중단자동-회수)를 따른다. 기존 실패 승인 범위는 USER/version2 회수까지이므로 **재승격은 별도 승인**이다. ignored `operator-access-restore1/APPROVALS.txt`와 `run-reviewed.txt`에 고정했다.

- 새 staging `/home/oioi/p06-c-operator-access-restore1-preparation`(UID1002/0700·파일0600)과 root `/var/lib/oioi-p06-c-operator-access-restore1`(root700/600)만 추가한다. archive/내부 hash·최신 CI/정상 receipt·복구 baseline/기존 보호 사본·현재 서비스/인증서·closed403을 대조한다. 기존 경로 충돌/불일치 시 중단한다.
- deployment.lock 아래 root enrollment-result exit20·회수 marker version2·after-enrollment-baseline의 원본/링크/현재 container/PID·등록 닫힘을 확인한다. 방금 만든 account1/보호 입력 이메일의 USER/ACTIVE/version2·활성 MFA만 대상으로 원래 공통 service를 한 번 호출해 ADMIN/ACTIVE/version3으로 복구한다. 비밀값 없는 before-access metadata를 새 root에 보존한다. 기존 MFA secret·사용한 OTP step·비밀번호를 바꾸거나 version을 감소시키지 않는다.
- root 실행은 `sudo python3 -I -B /var/lib/oioi-p06-c-operator-access-restore1/restore-access.py apply`다. 실패/불확실 응답은 phase/exit1로 중단하고 재실행/임의 SQL을 하지 않는다. 철회가 명시적으로 요청되면 같은 경로의 `revoke`가 새 승격 marker/현재 ADMIN3·동일 baseline을 확인한 뒤 USER4로 한 번 회수한다.
- 승인된 재승격 후 로컬 `login-only.mjs`는 새 SSH localhost 브라우저에서 사용자 비밀번호/새 실물 OTP 로그인·관리 GET200·로그아웃·setup/confirm403/등록 버튼 부재만 검증한다. Enter/등록 완료 중간 화면에 의존하지 않는다. 등록 flag는 계속false이며 VM 설정·권한 변경/close.request 쓰기는 브라우저가 하지 않는다.

고정 hash/검증은 RESULT를 따른다. 새 계정/메일·MFA reset/재등록·등록 unit 재개방·env/Origin/Caddy/Cloudflare 변경·컨테이너/DB 재시작·배포/pair/snapshot 변경·일반 공개·#166 병합은 범위 밖이다. 다음 제한 HTTPS 검증 창은 새 baseline/hash로 별도 승인받는다.

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
