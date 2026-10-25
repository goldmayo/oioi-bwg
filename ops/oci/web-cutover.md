# P06-F www 전환과 레거시 Web 종료

정책·완료 조건은 [P06 계획](../../docs/migration/implementation/console-guide-editor/P06-PLAN.md#preview--www-전환과-레거시-종료),
실제 실행 증거는 [F1 결과](../../docs/migration/implementation/console-guide-editor/P06-F1-RESULT.md)가 소유한다.
이 절차는 기존 단일 VM·정상 paired Promotion을 사용한다. 단계를 건너뛰거나 과거 실행물을 재실행하지 않는다.

| 대상                        | 최종 상태                                           |
| --------------------------- | --------------------------------------------------- |
| `www.oioibawige.com`        | 기존 preview VM의 Web, HTTPS·공개 조회 전용         |
| `oioibawige.com`            | HTTPS www redirect, 기존 경로·query 보존            |
| `console.oioibawige.com`    | 기존 HTTPS·비밀번호/TOTP 유지, enrollment=false     |
| 기존 Web Workers 두 개      | 전환 검증 후 `oioibawige`·`oioibawige-staging` 종료 |
| staging·www.staging·preview | 전환 검증 후 DNS·Caddy·Worker 연결 종료             |
| R2·assets·독립 Sentry relay | 보존, staging이라는 이름만으로 삭제하지 않음        |

## 1. 읽기 점검과 전환 기준 고정

운영 credential/DB 조회와 실제 외부 변경은 검토한 실행 범위의 승인을 받은 뒤 수행한다.
값을 출력하는 `cat app.env`, `docker inspect` 전체 출력, `printenv`, shell trace를 사용하지 않는다.

1. GitHub의 최신 integration source·배포선·정상 deployment receipt와 VM current/previous pair를 대조한다.
   배포 lock/pending 부재, 두 앱/DB healthy, Console HTTPS/enrollment=false를 확인한다.
   현재 source asset과 설치된 host asset의 차이를 검토하고 필요한 파일만 명시적으로 upgrade한다.
   installer만 실행해 기존 protected config도 갱신됐다고 판단하지 않는다.
2. 현재 Caddy main 파일·import·인증서 경로, Cloudflare Custom Domains·routes·DNS·TLS·cache/WAF를 읽는다.
   기존 Console 공개와 신뢰 IP/Origin 경계를 보존할 exact diff를 준비한다.
3. 기존 Worker와 VM의 DB identity·콘텐츠/회원·업로드 URL 및 최신성을 읽기 비교한다.
   sitemap이 같아도 전체 데이터 일치를 증명하지 않는다. 403/challenge는 비교 성공으로 처리하지 않는다.
   차이가 있으면 변경 데이터를 보존할 이관·쓰기 중지·백업·복구안을 확정할 때까지 www 전환을 멈춘다.
   DB 전체 restore·seed·MFA reset·키/version 교체는 이 절차에 포함하지 않는다.
4. 보호 백업에 current/previous pair·Caddy·public/secret mapping·deploy 설정을 보존하고 소유권/권한을 확인한다.
   secret 원문은 GitHub·출력·artifact에 복사하지 않는다. 데이터 백업은 기존 운영 경계를 사용한다.

## 2. Console R2와 정상 Promotion

1. Console protected public 입력의 `R2_ENDPOINT`, `R2_BUCKET`, `ASSETS_PUBLIC_BASE_URL`과
   secret mapping의 `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`를 기존 R2/Vault 값으로 준비한다.
   [materializer](materialize-runtime-env.py)의 검증을 통과해야 한다. Web의 예전 복구용 mapping은 유지한다.
   기존 Auth/MFA secret을 재생성하지 않고 Console Origin과 enrollment=false를 유지한다.
2. #199 통합 뒤 일반 CI 성공을 확인하고 최신 `migration_main → migration_develop` Promotion을 만든다.
   일반 CI는 local, 운영 후보는 production 입력이다. 현재 source/test-merge tree가 같아야 한다.
   두 ARM64 exact digest·baseline·공개 build hash·동시 smoke proof를 확인한 뒤 같은 후보를 승격한다.
   이력 때문에 tree가 다르면 보호 설정을 임의 완화하거나 다른 candidate로 우회하지 않는다.
3. Deploy exit 0·receipt·VM current pair의 두 digest를 대조한다. 두 앱 health/readiness,
   preview 공개 조회·Web 인증 거절·Console 로그인 화면을 확인한다. 실패 시 기존 paired rollback을 따른다.
4. 로그인한 Console에서 승인된 이미지 한 건의 업로드와 assets URL 조회를 검증한다.
   기존 파일을 덮어쓰지 않으며 생성할 object·연결 데이터·정리 범위를 먼저 정한다.
   runtime 설정 검증만으로 실제 R2 업로드 성공을 보고하지 않는다.

## 3. www TLS/라우팅과 Cloudflare 연결

1. 실제 Caddy 설정에 최종 www·apex host를 준비하되 기존 preview·Console은 유지한다.
   www Web에는 [Web 차단 조각](web-retirement.caddy)을 reverse_proxy 앞에 적용한다.
   Cloudflare peer 신뢰·직접 origin 거절을 유지하고 앱/DB port를 공개하지 않는다.
2. 현재 인증서 방식으로 www/apex origin TLS를 준비한다. ACME 예외가 필요하면 해당 host의
   GET challenge 경로만 검토하며 zone 전체 WAF/TLS를 낮추지 않는다.
   적용 전 Caddy validate, 적용 후 올바른 SNI·인증서 검증을 수행한다. `curl -k` 성공으로 대체하지 않는다.
3. 기존 Worker Custom Domain과 겹치는 route를 해제하고 www를 기존 VM의 Proxied DNS로 연결한다.
   잠긴 Worker 레코드를 일반 A 레코드처럼 편집하지 않는다. apex는 경로·query를 보존해 www로 redirect한다.
   Full (strict), Console cache bypass/no-store·로그인 보호와 assets 연결을 유지한다.
4. 실제 www의 홈·곡/앨범 조회·이미지·health/readiness·metadata·robots/sitemap을 확인한다.
   Web login/admin/auth/API와 Next-Action·쓰기 요청 거절을 검사한다.
   Console 로그인·관리 조회·로그아웃과 host-only Secure/HttpOnly/Lax cookie,
   www에 Console cookie가 전달되지 않음을 최종 hostname에서 확인한다. 비밀번호/OTP/cookie를 기록하지 않는다.

## 4. 레거시 종료와 완료 판정

1. www 검증 성공과 데이터/설정 복구 기준 확정 후에만 두 옛 Web Workers를 종료한다.
   Custom Domain·route·workers.dev·preview URL·자동 배포 trigger/전용 credential 잔여를 확인한다.
   독립 Sentry relay와 공유 credential/리소스는 종료 대상에서 제외한다.
2. staging·www.staging·임시 preview의 DNS/Caddy 연결을 제거하고 옛 관리 접근 경로가 남지 않는지 검사한다.
   R2/assets·메일 DKIM/SPF/DMARC·Console 인증서/갱신은 보존한다.
3. 최종 www·apex redirect·Console·assets, 두 앱/DB·receipt·enrollment=false와 사용한 복구 기준을 기록한다.
   성공한 공개 설정에 자동 종료 timer나 채팅 종료 시 원복 동작을 추가하지 않는다.

전환 실패 시 레거시 종료를 진행하지 않는다. 검증한 VM pair와 보호한 Caddy/DNS 설정을 복구하고
실제 공개 응답을 다시 확인한다. 이미 중단한 Worker를 다시 켜는 것만으로 복구 완료라 하지 않는다.
데이터가 갈라졌거나 안전한 복구가 불명확하면 쓰기를 제한하고 마지막 검증 상태와 남은 작업을 보고한다.

## 2026-10-25 적용 상태와 인증서 유지

www/apex는 VM Proxied A·Full(strict), Console은 기존 HTTPS를 유지한다. 옛 두 Web Worker와
staging/preview 연결은 종료했다. 실제 검증·보존 대상과 복구 기준은 [F 결과](../../docs/migration/implementation/console-guide-editor/P06-F1-RESULT.md#2026-10-25-실제-운영-전환)를 따른다.

Origin TLS는 서버에서 생성한 CSR에 Cloudflare Origin CA가 서명한 인증서다.
인증서 만료는 **2027-10-25 15:04 KST(06:04 UTC)**이며 자동 ACME 갱신을 구성했다고 해석하지 않는다.
키/CSR/인증서는 `/etc/caddy/p06-f/origin.key`, `origin.csr`, `origin.pem`에 있고 root:caddy·0640,
디렉터리는0750이다. 개인키는 서버 밖으로 옮기지 않는다. 갱신 시 두 hostname의 CSR/인증서를 대조하고
Origin CA chain·SAN·만료를 검증한 뒤 Caddy validate/reload·Full(strict) 실제 공개 요청을 확인한다.
직접 origin 점검은 올바른 SNI와 Origin CA trust를 사용하며 `-k`로 대체하지 않는다.
