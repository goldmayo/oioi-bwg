---
title: "P06-C Console HTTPS 및 인증 요청 보안 경계 구현 결과"
kind: migration-result
status: in-progress
source_commit: 64dca4c23233b07f2136d89b5bd2d363e6bef47c
verified_at: "2026-10-21"
updated_at: "2026-10-21"
revision: 26
---

# P06-C 구현 결과

**최신 상태:** [보안 패치의 두 앱 배포](P06-NEXT-SECURITY-RESULT.md) 후, 회사 브라우저용 창4를 root 설치·사전 검사·개방했다. [창4 실행 결과](#2026-10-21-창4-설치개방과-실제-ingress-검증)에 실제 자동 검사13항목과 인증 쿠키 속성 성공을 기록했다. 사용자의 HTTPS MFA 로그인·세션 쿠키·로그아웃과 최종 원복 확인은 진행 중이며 C는 미완료다. 창2는 종료 이력, 창3은 이전 배포 기준이라 실행하지 않는다. 두 회선 실험은 제외·미실시다.

**코드 병합·로컬 HTTP/HTTPS·Docker PostgreSQL·ARM64 후보 검증·HTTP 공동 VM 배포·DNS 전 HTTP 차단·사용자 Cloudflare DNS/cache 변경과 공개 HTTP 도달 확인 완료 / 최초 인증서 단계 exit20·HTTP403 복구 완료 / Cloudflare 국가 규칙의 ACME 예외 승인·사용자 적용·경계 확인 완료 / 승인된 재시도1 발급 성공(exit0)·origin/Cloudflare HTTPS403·기존 서비스 보존 확인 / 최소 HTTPS 창2 전환·개방 후 helper 중단·exit20 원복 완료. C 전체 완료가 아니다. 아래 미실행 표시는 각 기록 시점의 이력이다.**
기준은 `goldmayo/oioi-bwg`의 `migration_main` `655b593d61ec937e9a3cc4b5fee927f11f431647`(#162),
구현 브랜치는 `feature/p06-c-console-https`다. 구현 `6ed4ece`, 추가 Action 검증 `3822d13`, 배포 호스트 보완 `16c317d`, 로컬 HTTPS/DB 검증 확장 `2a274cd`를 거쳤다.
metadata의 source는 아래 실제 HTTP 공동 배포의 squash merge다. ARM64 후보 source와 초기 로컬 검증을 구분한다.
검토 PR은 [#163](https://github.com/goldmayo/oioi-bwg/pull/163)이다.
[P06-PLAN §6](P06-PLAN.md#6-https등록운영자-경계), active [Auth/Authz](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[B 완료 결과](P06-B2-3-RESULT.md#2026-10-18-b-운영-실증-완료와-최종-상태)를 따른다.

## 구현과 신뢰 경계

- `CONSOLE_ORIGIN`은 명시적 HTTPS 또는 HTTP loopback만 허용한다. URL 사용자 정보·경로·query·fragment·비정규 표현을 거절하며 runtime env materializer에도 반영했다.
- Console 전용 프로세스의 `AUTH_URL`을 그 Origin으로 고정한다. 세션·CSRF·callback 쿠키는 전용 이름과 secret을 유지하고 HTTPS에서 Secure, 항상 HttpOnly·SameSite=Lax·host-only다.
- 기존 Origin helper에 Host·forwarded authority 일치 검사를 더했다. Auth.js GET은 authority, POST·로그인/로그아웃·관리 Action·MFA/관리 mutation은 기존 helper와 Auth.js/Next CSRF 경계를 사용한다. 서비스 인가는 유지한다.
- Caddy 2.6.2용 [설정 조각](../../../../ops/oci/console.Caddyfile)은 **공개 403이 먼저 실행**된다. 자동 설치하지 않는다. 공개 gate 뒤에도 Cloudflare 연결 peer만 허용한다. 사용자 IP allowlist가 아니다.
- Caddy는 검증한 peer의 단일 CF-Connecting-IP를 X-Console-Client-IP로 덮어쓰고 Host·X-Forwarded-Host/Proto/For를 다시 설정한다. X-Real-IP·CF-Connecting-IP·Forwarded는 upstream에서 제거한다. 캐시 금지 응답 헤더도 설정한다.
- 앱은 HTTPS·설정 authority에 일치하는 위 전달 값만 IP로 해석한다. IPv6/IPv4-mapped 표현을 정규화하고, 누락·무효·HTTP 환경은 제한된 unknown bucket을 사용한다. **앱 포트 loopback 격리가 신뢰 전제**이며 host 내부 프로세스는 그 경계 안에 있다.
- 로그인 callback/Action과 MFA setup/confirm이 같은 계정 5회/5분·IP 20회/5분 limiter를 사용한다. window 환급·만료·메모리 상한을 유지한다. NAT 공유자는 IP 제한을 공유하지만 IP 변경은 세션/접근 자격에 영향을 주지 않는다. 단일 프로세스 재시작 시 메모리 제한 초기화 한계도 유지한다.

Web 인증·Compose·배포/rollback·DB schema·Secret/키는 변경하지 않았다.
Cloudflare CIDR과 CF-Connecting-IP의 의미는 [공식 IPv4](https://www.cloudflare.com/ips-v4),
[IPv6](https://www.cloudflare.com/ips-v6), [헤더 문서](https://developers.cloudflare.com/fundamentals/reference/http-headers/)를 대조했다.
이후 사용자의 대시보드 사전 점검은 아래에 별도 근거로 기록했다. 확인된 항목을 다시 조사하지 않으며,
IP 변형 등 실제 경로의 문제가 관찰되면 그 원인 설정만 추가 확인한다.

## 실제 수행한 검증

| 범위 | 실행 및 결과 |
| --- | --- |
| 기본 검사 | `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`, `pnpm format:check` 통과. Console unit 213건 포함 |
| 배포 설정 | `pnpm test:ops` 211건 통과. runtime env Python fixture의 HTTPS·잘못된 Origin/호스트·Secret 격리 포함 |
| 두 앱 build | `pnpm build` 통과. Web·Console standalone 생성 |
| HTTP 브라우저 | 기존 `console-standalone-smoke.mjs`를 `http://127.0.0.1:3101`에서 실행: health·쿠키·로그인 redirect·폼 hydration 통과 |
| HTTPS 브라우저 | `P06_CADDY_BINARY="$PWD/.local/p06-c/bin/caddy" node tests/ops/console-https-smoke.mjs` 통과. 실제 Caddy 2.6.2·Next 16.3.3 standalone·Chromium 사용 |
| HTTP/HTTPS + PostgreSQL | `pnpm test:integration:admin:local` HTTP 통과. 이어 아래 HTTPS profile로 동일 runner 통과: 실제 OTP 로그인·등록/차단 flag·관리 CRUD·Web/Console 인증 분리·세션/권한 회수. 두 실행 모두 연결/잠금 잔여 0·임시 DB 삭제 |
| CI | 코드 head `d77d7c5`의 [Verify 39138336253](https://github.com/goldmayo/oioi-bwg/actions/runs/39138336253) 전체 성공. 두 앱 이미지 build·Docker build/paired smoke·PostgreSQL·관리 브라우저 통합 포함. 이후 변경은 로컬 검증한 HTTPS 테스트 확장과 결과 문서 |
| Caddy 정적 검사 | 로컬 `caddy validate` 통과. SSH에서 실제 `/etc/caddy/Caddyfile`과 제안 조각을 stdin으로 합친 `caddy adapt` 통과. 파일 설치·reload 없음 |
| VM 읽기 관찰 | Caddy 2.6.2/systemd, preview→127.0.0.1:3000만 존재. Console 127.0.0.1:3001. 두 앱 health/readiness 네 경로와 preview 원본 HTTPS healthz 모두 200 |

HTTPS fixture는 임시 인증서의 공개 키만 Chromium에 고정하고 Node 요청은 그 인증서를 CA로 검증한다.
외부 listener 없이 127.0.0.1에 바인딩한다. 공개 403·비신뢰 loopback source의 위조 헤더 거절,
모사한 신뢰 peer의 두 IPv4/IPv6 전달 값 덮어쓰기, HTTPS 쿠키 발급/갱신·브라우저 호스트 범위,
다른 Origin의 callback/API 거절, 빌드된 Action의 다른/누락 Origin 거절, 잘못된 CSRF와 정상 로그아웃·redirect를 검사했다.
세션 쿠키 갱신은 **테스트 secret으로 만든 JWT fixture**를 사용했다. DB·실제 MFA 로그인 성공을 증명하지 않는다.
두 client bucket의 독립성·IP 변경에도 유지되는 계정 제한은 단위 테스트로 확인했다.

2026-10-19 사용자가 Docker Desktop/WSL 연결을 켠 후 실제 Compose PostgreSQL 17에서 HTTP와 HTTPS 전체 회귀를 추가 실행했다.
HTTPS driver는 ignored `.local/p06-c/run-admin-https.mjs`다. 위 Caddy snippet의 upstream만 테스트 포트 `3201`로 바꾸고,
`127.0.0.1:3443`에만 TLS listener를 열어 실제 remote host를 전달했다. Node는 fixture 인증서를 CA로 검증하고 Chromium은 그 키만 고정했다.
`NODE_EXTRA_CA_CERTS`·`P06_HTTPS_ORIGIN=https://127.0.0.1:3443`·`P06_TLS_KEY_PIN`을 설정해 동일 `pnpm test:integration:admin:local`을 실행한다.
실제 OTP 로그인에서 얻은 브라우저 쿠키의 Secure/HttpOnly/SameSite를 확인했다. 실제 TCP source `127.0.0.2`·`127.0.0.3` 각각 20회 허용·21회 제한,
위조 X-Forwarded-For/X-Console-Client-IP로 우회 불가도 확인했다. 이는 **loopback 두 주소의 실제 proxy→앱 검증**이며 실제 Cloudflare peer 두 개의 증거는 아니다.
HTTPS 확장 중 드러난 기존 fixture의 모든 HTTPS 요청 차단과 단일 Cache-Control 문자열 가정은 자기 앱 허용·no-store 지시자 검사로 수정한 뒤 재실행해 통과했다.
등록/CLI reset 등은 기존 격리 fixture의 회귀이며 D의 실물 인증기·운영 복구 완료가 아니다.

첫 전체 ops 실행은 `jq` 누락과 동시 실행 부하의 timeout으로 실패했다. ignored 로컬 도구 경로에 jq를 준비한 뒤 위 211건을 재실행해 통과했다.
중간 재빌드는 harness가 잠시 만드는 ESLint 회귀 fixture와 겹쳐 실패했다. harness 종료 후 두 앱 build를 다시 실행해 통과했다.
테스트/배포 시스템이나 timeout 설정은 변경하지 않았다. 첫 push hook에서도 affected type-check/lint/test, repo type-check/lint, harness, ops 211건, format 검사를 자동 실행해 모두 통과했다. 별도로 계획한 검증과 구분한다.

## 2026-10-19 PR #163 추가 리뷰 보완

검토 기준 `9dacbcf`의 [Verify 39139757539](https://github.com/goldmayo/oioi-bwg/actions/runs/39139757539) 전체 성공 이후,
`9475415`에서 아래 두 항목을 보완했다.

- HTTPS 인증 경계는 Host·X-Forwarded-Host·X-Forwarded-Proto가 누락되거나 빈 값이면 거절한다. HTTP loopback은 누락 허용·전달된 값 일치 검사를 유지한다.
- active 04 v1.5에 쿠키·필수 헤더·Origin/CSRF 계약을 명시하고, 11 v1.8의 loopback 전용 문구를 HTTP loopback/명시적 HTTPS 지원으로 개정했다. 인덱스 v1.25도 버전을 동기화했다.
- `pnpm type-check`, `pnpm test:harness` 18건, `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`(Console 221건), `pnpm format:check`, `pnpm build`를 재실행해 통과했다.
- 기존 `console-https-smoke.mjs`도 실제 Caddy·Next.js·Chromium에서 재실행해 통과했다. 후속 CI와 push hook 결과는 같은 PR에 기록한다.

이번 보완은 운영 적용이나 C 전체 완료를 뜻하지 않는다. 아래 실제 VM/Cloudflare 승인 게이트를 유지한다.

## 2026-10-19 코드 병합과 Promotion 후보 검증

- 사용자 승인 후 #163을 `5106876650670b819647344e5b1fae5ecdfa30b7`로 squash 병합했다.
- 승인된 파일 변경 0개의 [#165](https://github.com/goldmayo/oioi-bwg/pull/165)를 `ed19b6d9f033009349708dc35cb7bed2cd7be5cd`로 일반 merge했다. 저장소/main의 merge 허용 설정은 즉시 원본으로 복원·대조했고 develop ruleset은 유지했다.
- [#164](https://github.com/goldmayo/oioi-bwg/pull/164)의 [Verify 39183484581](https://github.com/goldmayo/oioi-bwg/actions/runs/39183484581) attempt 1 전체 성공. source는 `ed19b6d9f033009349708dc35cb7bed2cd7be5cd`이고 source/virtual merge tree는 `5584c7569e5438b78f53eab101a63579b427134a`다.
- candidate artifact `12156679197`을 다운로드해 PR/source/tree/run/attempt·실제 Environment repository·두 신규 ARM64 digest와 마지막 정상 배포 #158 receipt baseline을 대조했다. 두 이미지는 같은 source의 `origin=built`이며 동시 paired smoke를 통과했다. 정확한 digest/후보 hash는 고정 artifact와 #164 검증 본문을 참조한다.
- 당시 #164는 Draft로 유지했다. 이후 별도 사용자 승인으로 병합·HTTP 배포한 결과는 아래 운영 결과를 참조한다. 배포 파이프라인은 변경하지 않았다.

## 2026-10-19 Cloudflare 대시보드 사전 점검(사용자 확인)

근거는 사용자가 이 대화에 제공한 대시보드 확인 결과다. 에이전트의 dashboard/API 재조회나
실제 Cloudflare→Caddy 인증 성공 증거로 해석하지 않는다. **아래 표는 변경 전 사전 점검 이력이다. 이후 DNS/cache 변경과 공개 응답은 아래 2026-10-20 결과를 따른다.**

| 항목 | 사용자 확인 상태 |
| --- | --- |
| Console DNS | `console.oioibawige.com` 레코드 없음 |
| SSL/TLS·Edge | Full (strict), `*.oioibawige.com` Edge 인증서 활성 |
| Worker Custom Domain | 기존 apex·www만 연결 |
| Rules | Origin Rules·Redirect/Rewrite Rules·Request Header Transform Rules 없음 |
| Managed Transforms | 모두 비활성, 방문자 IP 헤더 제거도 비활성 |
| Cache Rule | `console-bypass-cache` 생성됨. 조건 `http.host eq "console.oioibawige.com"`, Bypass cache, 현재 비활성 |
| Always Use HTTPS | 2026-10-20 사용자 대시보드에서 OFF 확인. 설정 변경 없음. 에이전트 재조회 없음 |

위 항목은 완료한 사전 점검으로 재사용한다. 남은 origin 인증서·서버 제한 경로와 최소 Cloudflare
변경 요청·승인 순서는 [사전 준비 §2](P06-PREPARATION.md#2-c의-제한된-cloudflare-https-검증-준비)가 소유한다.
DNS 생성·Cache Rule 활성화는 Console 외부 차단과 기존 preview 보호를 실제 확인한 뒤 별도 승인받는다.
#164 병합/VM 배포는 아래 별도 승인으로 실행했다. 서버 HTTPS 전환은 별도 승인 대상이며 일반 공개는 F다. Cloudflare 두 항목의 후속 사용자 변경은 아래에 구분한다.

## 2026-10-19 제한 matcher 운영 실행물의 로컬 검증

#166을 Draft로 유지한 채 기존 C의 운영 실행물을 ignored `.local/p06-c/limited-https/`에 준비했다. 새 설계/계획 PR이나 파이프라인 변경은 없다.

- renderer는 검토한 원본 Caddy 조각 hash를 고정하고 Cloudflare TCP peer AND 임시 검증 헤더에만 proxy를 허용한다. 검사 뒤 `request_header`와 `header_up`에서 검증 헤더를 제거한다. closed 출력에는 임시 matcher/값/proxy가 없다.
- 실제 Caddy 2.6.2/TLS에서 일반·잘못된 헤더·비신뢰 peer의 403, echo upstream의 임시 헤더 부재, 같은 Caddy 프로세스의 reload 후 matcher 제거를 확인했다. 제거 뒤 이전 검증 헤더 포함/미포함 요청은 모두 403이고 추가 upstream 호출은 0이었다. preview 모사 backend는 다섯 번 200, 테스트 backend 인스턴스도 유지됐다.
- 이 검증은 CF peer를 loopback으로 모사한 **로컬 증거**다. 실제 VM의 정상 Docker pair 보존·Cloudflare 경로·운영 제거 후 외부 403의 증거가 아니며 해당 실증은 운영 승인 후 남아 있다.
- 첫 fixture는 site 주소 치환이 import 행까지 바뀌어 validate가 실패했다. fixture의 첫 site 항목만 치환하도록 수정한 후 재실행해 통과했다. VM 설정 실패는 아니다.
- 1차 보호 백업 operator는 고정 후보/current baseline·원본 hash·잠금·health를 대조한 뒤 새 root-only 백업만 만든다. 로컬 파일/lock/복사와 모사 root/Docker/health를 사용한 drift·pending·외부 snapshot·기존 백업/lock 충돌 등 8개 fixture를 통과했다. Python 구문/CLI와 root launch 본문의 `bash -n`도 통과했다. 이 로컬 검증 시점에는 실제 root 실행·VM 전달을 하지 않았으며, 이후 승인된 실제 결과는 아래에 구분한다.
- 실행물 archive SHA-256은 `4584d6c335310afeeea439297e28a3519238e359f2fdfb77693633c7f69ac6f2`, renderer는 `524fa604c15f7eb5d07f8146da60350646c5261df3a346badb54d4e50c2638e8`, 백업 operator는 `4febe4244d98f555bd9d3006ddea3cc0e87f37fae4fa6694472f52645307c2aa`다. 세부 범위는 실행물의 `APPROVALS.txt`/`launch-backup.txt`와 #166 본문에 연결한다.

첫 승인 요청은 staging `/home/oioi/p06-c-limited-https`, root launch `/var/lib/oioi-p06-c-launch`, 보호 백업 `/var/lib/oioi-p06-c-before-promotion`의 신규 생성·고정 파일 전달/검증·백업뿐이다. 활성 설정/컨테이너/DB는 변경하지 않는다. #164 병합·즉시 이어지는 HTTP pair 배포와 후속 HTTPS 검증 창, Cloudflare 인증서/DNS/cache는 각각 별도 승인이다.

## 2026-10-19 승인된 보호 백업과 HTTP 공동 배포

사용자는 고정 archive/hash와 `APPROVALS.txt`의 1차 보호 백업만 먼저 승인했고, 완료 보고 후 #164의 고정 후보 squash 병합과 기존 HTTP loopback 설정을 유지하는 공동 자동 배포를 별도로 승인했다. HTTPS Origin·Caddy 수정/reload·인증서·Cloudflare 변경·#166 병합은 두 승인에 포함되지 않았다.

- 고정 archive를 신규 staging에 전달하고 전체 파일 hash를 대조했다. 기존 SSH의 비대화 sudo가 거절돼 사용자가 기존 VM 터미널에서 보호 복사·고정 hash 확인 뒤 root operator를 실행했다. `p06_c_backup_phase_passed`·`backup_exit=0`과 전체 권한 검사가 성공했다.
- 실제 보호 백업은 `/var/lib/oioi-p06-c-before-promotion`이다. 소유자는 `root:root`, 전체 디렉터리0700/파일0600이며 manifest와 complete도0600이다. 사용자 두 번째 실행은 기존 root launch 경로 충돌 검사에서 중단돼 덮어쓰지 않았다.
- 병합 직전 사용자 root의 읽기 전용 검사 `p06_c_premerge_backup_verified`로 모든 백업/원본 hash·권한·current/previous snapshot·정상 baseline·기존 HTTP pair·DB·preview를 재대조했다. SSH에서도 기존 세 컨테이너의 ID/시작 시각/이미지·원본 Caddy/materializer hash와 일곱 앱/preview 응답200을 확인했다.
- head/source 전체 SHA `ed19b6d9f033009349708dc35cb7bed2cd7be5cd`, 성공 Verify attempt1, 미만료 candidate artifact `12156679197`과 정상 baseline receipt artifact `12105120483`을 다시 조회·다운로드했다. ZIP digest와 후보 원문 SHA-256 `d833aeabc8d3f6c89cbaa16d1639840641e27f82f400977bfc2786d95bba3076`, baseline release ID·exit0과 두 exact image digest를 대조했다.
- #164를 Draft 해제하고 고정 head를 지정해 `64dca4c23233b07f2136d89b5bd2d363e6bef47c`로 squash 병합했다. 부모는 하나이고 실제 merge tree는 검증된 source tree와 같다.
- [Deploy 39265305904](https://github.com/goldmayo/oioi-bwg/actions/runs/39265305904) attempt1 전체 성공. OCI Run Command `SUCCEEDED`·remote exit0·deployment succeeded를 확인했다. 새 build나 임의 재시도·rollback은 없었다.
- 정상 receipt artifact `12192252859`(`paired-deployment-39265305904-1`)를 다운로드해 ZIP digest와 `receipt.json`의 exit0·배포 run/attempt·merge SHA·candidate artifact ID를 대조했다. 동봉 후보는 검증 artifact와 byte 단위로 같고, 정상 release ID는 `18462a4004780a0b43bcadf77792ef8fa22b082390498774331ed2a704a31c1a`다.

| 앱 | 실제 배포한 immutable digest |
| --- | --- |
| Web | `sha256:45ee4fbf952b1846001eb5a63a141c3d1d60228622a96d0fa645690919de8717` |
| Console | `sha256:6ada86b1eff6cdd63e5e1ce1cc45def018a89ae708d6cd9d9d41b639e8990749` |

배포 후 SSH 읽기 검사에서 두 앱이 위 digest로 healthy이고 네 health/readiness가200이었다. Console은 `http://127.0.0.1:3001`·등록 닫힘을 유지한다. DB의 ID/시작 시각/이미지는 배포 전과 같고 healthy이며, 기존 preview 원본 TLS의 `/`·`/healthz`·`/readyz` 모두200이다. Caddyfile과 기존 HTTP 전용 materializer hash, 보호 백업 디렉터리 소유권/권한도 유지됐다.

사용자가 기존 VM 터미널에서 배포 후 읽기 전용 root 검사를 실행해 `p06_c_postdeploy_snapshot_verified`를 확인했다. 고정 hash의 기존 helper를 대조한 뒤 보호 백업 전체의 권한/사본 hash·후보 identity, current/previous의 보호 경로와 여섯 파일, 이전 정상 snapshot의 백업 대비 hash, 현재 runtime env/Compose와 snapshot 일치, 두 앱의 실제 digest/Compose configHash를 검사했다. `pending-pair` 부재·DB ID/시작 시각 유지·HTTP loopback/등록 닫힘·health/preview와 원본 Caddy/materializer hash도 통과했다. 복구 snapshot 내부 대조 대기는 해소됐으며 실제 링크 대상은 다음과 같다.

- `current-pair`: `/srv/oioibawige/deploy/18462a4004780a0b43bcadf77792ef8fa22b082390498774331ed2a704a31c1a-hxxkecl6`
- `previous-pair`: `/srv/oioibawige/deploy/37bd0ae9184be182791fcdcab8c08270f08f1c77e331e0f404719bec7bef1874-n_vz9kcy`

이 검사는 기존 rollback 자료의 실제 보존·현재 상태 일치를 확인한 것이며 추가 rollback이나 재배포를 실행한 것은 아니다.

재현 근거는 ignored `.local/p06-c/promotion164-deployment/`의 artifact/merge/deployment/VM proof와 사용자 root 완료 출력이다. root 전용 내용은 SSH에서 읽은 것으로 보고하지 않으며 Secret·env·manifest 원문은 기록하지 않았다. #166은 Draft·미병합을 유지한다. 문서 기록에는 앱 검사/build를 재실행하지 않는다.

## 2026-10-20 기존 인증서·ACME 읽기 관찰과 DNS 전 준비

사용자는 Console 전용 origin 인증서를 따로 발급/보관하지 않았다고 확인했고, 기존 Caddy의 Let's Encrypt를 우선 검토하도록 지시했다. 이 읽기 관찰 시점에는 인증서 발급·설치·Caddy·DNS 변경을 승인하지 않았다. 이후 HTTP 전용 차단의 별도 승인/결과는 다음 절에 구분한다. 같은 Cloudflare 대시보드 항목은 재조사하지 않았다.

- SSH에서 실제127.0.0.1:443에 preview SNI로 TLS 연결해 CA 검증을 통과한 공개 인증서 metadata만 읽었다. issuer는 Let's Encrypt YE1, SAN은 `preview.oioibawige.com` 하나이며 Console/wildcard는 없다. 만료는2026-12-14 00:58:41 KST, 인증서 DER SHA-256은 `cd7ffa46bb5025da23015a4feccd10acc43f158f4252b6fba471f5ad9917a858`이다. 개인키/인증서 저장소 원문은 읽거나 출력하지 않았다.
- Caddy2.6.2·caddy 서비스 active, `tls.issuance.acme` 있음·`dns.providers.cloudflare` 없음, 자동 HTTPS 비활성/On-Demand 설정 없음을 읽었다. 현재 Caddyfile hash는 기존 원본과 같고 preview만 포함한다. Console SNI TLS는 거절됐고 `/etc/caddy/p06-c`는 없다.
- WSL에서 기존 VM80 포트로 preview Host를 직접 보낸 요청은308이었다. 이는80 포트의 현재 외부 도달 증거이며 Console DNS나 실제 Cloudflare/CA HTTP-01 성공을 증명하지 않는다. 정상 receipt artifact `12192252859`도 미만료다.
- 기존 Caddy의 자동 발급 기능을 활용할 조건은 확인했지만 Console 공개 DNS와 실제 HTTP challenge 도달이 필요하다. 현재 인증서의 재사용은 불가능하며 새 인증서 발급 성공은 아직 미검증이다. Origin CA가 꼭 필요하다고 판단하거나 발급을 요청하지 않았다.

새 정상 release/current/previous·세 container ID/시작 시각/digest를 고정한 로컬 실행물은 ignored `.local/p06-c/https-window/assets/`에 있다. 기존 승인 archive `4584d6c...`는 그대로 보존했다. **새 묶음은 DNS 전 백업·HTTP 차단 단계 전용이다. 준비 시점에는 전달/실행하지 않았으며 이후 별도 승인으로 실행했다.**

- archive: `.local/p06-c/https-window/https-dns-preparation-reviewed.tar.gz`, SHA-256 `c7f7f3968bb2d720442a54f3c769328095ebcb1f28a1aa6234ec13e85c9b2cb1`(일반 파일14개)
- 새 백업 operator: `3c7f3f5b9fd08437d70dae1a72c94e871abce6405f2deb71d3bb17da506d7a66`, 차단/복구 operator: `8925f23452a3f55f217b1da2f3765a42185bfa07882ebe76490c6b6b286ef311`
- 검토 본문 `.local/p06-c/https-window/launch-reviewed.txt`는 root 메모리에서 고정 archive hash·항목·전체 파일 hash를 확인한 뒤 신규 root launch에만 복사한다. 기존 경로 충돌 시 중단한다. 범위/제외/중단 조건은 묶음의 `APPROVALS.txt`에 고정했다.
- 제안된 신규 경로는 사용자 staging `/home/oioi/p06-c-https-preparation`, root launch `/var/lib/oioi-p06-c-https-launch`, root-only 백업 `/var/lib/oioi-p06-c-before-https`, root:caddy의 `/etc/caddy/p06-c/active.caddy`다. 기존 deployment.lock 안에서 백업·원본 preview의 byte 보존·HTTP 전용 조각 validate/기존 reload·세 container/env/snapshot 불변·HTTP403/TLS 거절·preview를 검사한다. 인증서·host script·env·컨테이너·Cloudflare는 바꾸지 않는다.
- DNS 전 단계의 승인 후 수동 복구 명령은 `sudo python3 -I -B /var/lib/oioi-p06-c-https-launch/deny-http.py restore`다. 고정 백업/현재 상태와 조각 내용 대조 뒤 원본 Caddy validate/복원/reload만 수행한다. 이후 ACME/제한 조각으로 바뀌면 내용 대조에서 거절한다. 적용 실패의 검토된 복구는 한 번뿐이며 exit20은 복구 성공,21은 복구 실패로 중단한다. 사전 불일치는1이다.

새 백업 fixture8건과 차단 operator fixture8건(원복·validate/reload/postcheck 실패·복구 실패·충돌·drift·lock)을 통과했다. 실제 로컬 파일/lock/복사·원자 복구이며 root/Docker/Caddy 명령은 모사했다. 첫 operator fixture는 백업 경로 하드코딩과 로컬 caddy 그룹 부재로 실패했고 경로 도출·명시적 그룹 fixture로 보완한 뒤8건을 재실행해 통과했다. VM 실패가 아니다.

실제 로컬 Caddy2.6.2·임시 fixture 인증서/preview backend에서는 GET/POST 여섯 요청403/no-store, Console TLS 거절, 같은 Caddy PID의 reload·원복 전/중/후 preview200을 확인했다. 인증서 자동화를 켜되 로컬의 닫힌 CA endpoint만 지정한 fixture에서도 HTTP 전용 Console 인증서 발급이 시작되지 않았다. `deny-http.Caddyfile`·후속 참고 `closed-acme.Caddyfile`은 실제2.6.2 adapt로 검사했고, 후자는 Console issuer의 Let's Encrypt·TLS-ALPN 비활성만 확인했다. 실제 발급은 하지 않았다. Python AST/CLI·root launcher `bash -n`·14개 archive hash도 통과했다.

검증 근거는 같은 로컬 경로의 `certificate-preflight.json`, `adapter-proof.json`, `assets/local-proof.json`, `bundle-proof.json`이다. DNS 전 단계의 실제 외부 차단/preview 보호 후에만 DNS/cache 승인을 요청한다. 자동 발급 조건 때문에 필요한 DNS/인증서 순서와 후속 HTTPS 창의 별도 승인은 [PREPARATION §2](P06-PREPARATION.md#2026-10-20-기존-caddy의-lets-encrypt-우선-경로)를 따른다. HTTPS 창의 최종 실행물·hash·복구 명령은 실제 인증서/닫힌 HTTPS 경로 확보 후 확정하며 아직 실행 승인을 요청하지 않는다. 새 계획 PR·배포 파이프라인·브랜치 전략 변경은 없다.

## 2026-10-20 승인된 DNS 전 VM 차단 결과

사용자는 #166 `301e024` 검토 후 최신 문서 CI와 고정 실행물/원본 대조 성공을 조건으로 **새 보호 백업·Console HTTP 전용403·Caddy validate/reload·상태 확인만** 승인했다. 기존 preview HTTPS·세 컨테이너·배포 snapshot 보존과 불일치 시 중단을 요구했다. 인증서 발급·DNS/cache·HTTPS Origin·#166 병합은 제외했다. Always Use HTTPS OFF는 위 사용자 확인을 재사용했으며 Cloudflare를 재조사/변경하지 않았다.

- [Verify 39279348353](https://github.com/goldmayo/oioi-bwg/actions/runs/39279348353)의 정확한 head `301e0248edd4ce5418b3bf447f2d579cabdfff4e`·attempt1·completed/success와 실제 scope/verify 완료 로그를 대조했다. 문서 판정은 `success / docs_only=true`였다. 개별 job 조회가 대기/실행 중으로 남는 상태 불일치가 있어 성공 확인 전 VM 변경을 시작하지 않았다. 취소 요청은 이미 완료됐다는 이유로 거절됐고 실제 취소·재실행은 없었다. 이후 완료 로그와 run success로 승인 조건을 확인했다.
- archive `c7f7f396...`의14개 항목·전체 hash·검토 launch 본문, 원본 Caddy/materializer hash와 세 container ID/시작 시각/이미지·HTTP 설정·health·preview를 먼저 대조했다. 신규 경로 충돌이 없음을 확인한 뒤 archive와 launch 본문만 사용자 staging0700/파일0600에 전달했다.
- 비대화 sudo가 거절돼 사용자가 기존 VM 터미널에서 root 메모리의 archive/항목 hash 검증·보호 복사 후 고정 operator를 실행했다. `p06_c_dns_preparation_source_verified`, `p06_c_https_backup_phase_passed`, `p06_c_dns_preparation_passed`, `dns_preparation_exit=0`을 확인했다.
- 새 백업은 `/var/lib/oioi-p06-c-before-https`다. 고정 operator가 root 소유·전체 디렉터리0700/파일0600·사본 hash/완료 marker를 검사했다. 기존 1차 보호 백업도 전체 사본 hash/권한을 재검사했다. SSH에서는 두 백업 디렉터리의 root:root/0700 보존을 독립 확인했으며 root-only 내부를 직접 읽었다고 보고하지 않는다.
- 실제 변경은 원본 Caddyfile 뒤의 `import /etc/caddy/p06-c/active.caddy`와 HTTP 전용 조각뿐이다. 기존 preview 원문 전체의 byte/hash `088e22d...`가 그대로 prefix에 남았고, 현재 Caddyfile hash는 `cf202c961f17a804b2e38677051a6d79a62df8490bfa66d6f365dbd69c5ca5e2`다. 조각 디렉터리는 root:caddy/0750, 설치 파일은 고정 operator의 root:caddy/0640이다. Caddy 사용자 validate·기존 reload를 통과했으며 PID926/active를 유지했다.
- SSH의 실제 활성 config에서도 Console route는80 포트의403뿐이며 reverse_proxy와 Console TLS automation이 없음을 확인했다. 임시 candidate 파일도 제거됐다. host materializer hash는 `eb82316b...`로 같고 Console Origin은 HTTP loopback·등록 닫힘이다.

외부 WSL에서 DNS를 통하지 않고 승인 VM IP에 직접 연결해 다음을 실증했다.

| 요청/검사 | 실제 결과 |
| --- | --- |
| Console Host GET `/` |403, Cache-Control/CDN-Cache-Control/Cloudflare-CDN-Cache-Control 모두 no-store |
| GET `/api/auth/csrf` + 위조 검증/forwarded/IP 헤더 |403, 세 no-store 헤더 유지 |
| POST `/api/auth/callback/credentials` + 다른 Origin |403, 세 no-store 헤더 유지 |
| TCP443 연결 후 Console SNI TLS | Caddy TLS alert `TLSV1_ALERT_INTERNAL_ERROR`로 거절. TCP 실패/timeout으로 대체하지 않음 |
| preview SNI 직접 origin TLS `/`·`/healthz`·`/readyz` | 모두200. VM 내부 원본 검사도 모두200 |

두 앱 네 health/readiness는200, 세 컨테이너는 healthy이며 고정 post-#164의 ID/시작 시각/immutable image와 모두 같았다. root operator가 두 runtime env·공개/secret map·host 파일·current/previous snapshot 파일과 링크 불변을 백업 hash로 재검사했다. 앱/DB 재생성·재시작·배포·snapshot 수정·Vault/SQL 작업은 없었다.

복구용 원본과 위 `deny-http.py restore` 명령을 보존했다. 성공해 실제 VM 원복은 실행하지 않았으며 로컬 복구 fixture 성공을 실제 VM 원복 성공으로 바꾸지 않는다. 새 백업 경로를 재사용/삭제하거나 임의 재시도하지 않는다. 실제 근거는 ignored `https-window/`의 `approved-operation-gates.json`, `staging-result.json`, `root-application-result.json`, `external-after-apply.json`, `vm-after-apply.json`과 두 CI 완료 로그다. #166은 Draft·미병합을 유지하며 다음 DNS/cache·인증서·HTTPS 창은 각각 별도 승인이다.

## 2026-10-20 사용자 DNS/cache 변경과 공개 HTTP-01 경로 관찰

사용자는 기존 `console-bypass-cache` 활성화 후 A `console=129.225.183.112`, Proxied, TTL Auto 생성을 완료했다고 보고했다. Full(strict)·Always Use HTTPS OFF·기존 다른 설정은 유지했다. 에이전트는 대시보드/API 설정을 재조사하거나 변경하지 않았고, 공개 DNS/HTTP/TLS와 SSH 읽기만 수행했다. 인증서 발급·Caddy 변경·일반 공개는 승인되지 않았다.

| 실제 읽기 검사 | 결과와 한계 |
| --- | --- |
| Cloudflare·Google DoH의 A/AAAA | 두 resolver 모두 A `104.21.69.105`·`172.67.207.108`, AAAA `2606:4700:3034::6815:4569`·`2606:4700:3030::ac43:cf6c`, TTL300 응답. Proxied 주소이며 origin IP 직접 노출을 기대하지 않음. 전 세계 모든 resolver/CA 시점의 전파 보장은 아님 |
| Console·부모 `oioibawige.com`·`com` CAA | 조회 성공·CAA 응답 없음. CA 실제 발급 결과로 대체하지 않음 |
| Cloudflare HTTP `/` |403, 본문 `Console is not public`, Cache-Control/CDN-Cache-Control no-store, Server cloudflare·CF-Ray, CF-Cache-Status DYNAMIC |
| Cloudflare HTTP `/.well-known/acme-challenge/p06-c-readonly-probe` | 같은403·Caddy 차단 본문·DYNAMIC/no-store. Location·cf-mitigated 없음. 임의 경로가 redirect/Edge challenge 없이 차단 origin 응답까지 도달한 증거이며 유효 ACME 토큰200/CA 검증 증거는 아님 |
| 직접 origin HTTP `/`·같은 ACME 경로 | 모두 같은403 본문, 세 cache no-store 헤더 |
| Cloudflare HTTPS `/` | Edge TLS 검증 후 HTTP525. SSH Console SNI도 SSL error로 거절되며 Console origin 인증서 미확보/HTTPS site 미적용 상태와 일치. SSL 설정 완화로 해결하지 않음 |
| preview 직접 origin TLS `/`·`/healthz`·`/readyz` | 모두200. 기존 preview 공개 인증서 hash 유지 |
| VM SSH 읽기 | main Caddyfile `cf202c96...`·PID926/active, Console 비프록시403 route만 존재, 두 앱 네 health/readiness200. 세 컨테이너 ID/시작 시각/이미지·healthy가 이전 고정 상태와 같고 기존 두 보호 디렉터리 root:root/0700 보존 |

네트워크 근거는 ignored `.local/p06-c/certificate-window/network-preflight.json`, `dns-parent.json`과 SSH 읽기 출력이다. 일반 HTTP403의 DYNAMIC 관찰을 실제 인증 응답 캐시 방지 전체 검증으로 확대하지 않는다. 실제 Cloudflare 인증/IP/쿠키 검증은 이후 제한 HTTPS 창에 남긴다.

다음 인증서 단계의 고정 실행/복구 후보는 같은 로컬 경로에만 준비했으며 **VM 전달·root 실행·Caddy 변경·CA 요청을 하지 않았다.** 정확한 archive/hash·신규 보호 경로·명령·제외 범위의 소유자는 [PREPARATION의 발급 승인 범위](P06-PREPARATION.md#2026-10-20-dns-연결-후-인증서-단계의-실행복구-승인-범위)다. 기존 승인 archive와 보호 백업을 덮어쓰지 않는다.

로컬에서는 실제 Caddy2.6.2 `adapt`로 명시적 Let's Encrypt·HTTP-01 활성·Console만 TLS-ALPN 비활성·reverse_proxy 부재를 확인했다. Python AST·launcher `bash -n`·archive4개/전체 hash가 통과했다. 파일 복사/hash/권한과 제어 흐름 fixture7건(성공·첫 발급 error·시간 초과·validate 실패·main drift·미지 fragment 복구 거절·발급 인증서가 캐시에 남은 복구) 및 발급 오류 분류3건을 통과했다. root 소유권·Docker/Caddy/systemd/journal·CA/TLS 응답은 모사했으며 실제 발급/VM 복구 성공으로 기록하지 않는다. 근거는 `adapt-proof.json`, `operator-proof.json`, `bundle-proof.json`이다. 문서 상대 파일/anchor39개와 `git diff --check`를 통과했으며 앱 검사/build는 재실행하지 않았다.

## 2026-10-20 승인된 인증서 단계 실패와 HTTP403 복구

사용자는 #166 `5756143`·archive `62c6a1fa...`와 내부 hash·현재 정상 pair/receipt·Caddy/HTTP403/preview/백업 일치를 조건으로 새 보호 백업·Console 전용 Let's Encrypt HTTP-01 조각 validate/reload·최대180초 관찰·성공/실패 검증과 정해진 한 번 복구만 승인했다. HTTPS Origin/env·임시 허용 matcher·컨테이너 재생성·Cloudflare 변경·#166 병합·일반 공개는 제외했다.

- 최신 [Verify39285344434](https://github.com/goldmayo/oioi-bwg/actions/runs/39285344434)의 head `5756143d92d50390a606fc63dd2b1e7e88d8ab1d`·attempt1·Run API `completed/success`를 사용자 확인과 에이전트 API에서 대조했다. 먼저 scope/verify 완료 로그는 gate 성공을 보였지만 Run/Job/공개 summary가 Queued로 남아 변경을 보류했다. 같은 CI 재실행 요청 한 번은 거절돼 실제 attempt는1이었다. 이후 Run success를 확인해 게이트를 해소했고, 개별 Job 지연 때문에 추가 재실행하지 않았다.
- 실행 전 고정 archive4개/내부 hash와 미만료 정상 receipt artifact `12192252859` ZIP digest·receipt·후보 원문 byte 일치, main Caddy `cf202c96...`·HTTP403·preview/앱 health·세 컨테이너 ID/시작 시각/이미지·healthy·기존 보호 디렉터리 metadata·신규 경로 부재를 재대조했다. 신규 staging0700/파일0600에 archive/검토 launcher만 전달하고 원격 전체 hash를 검증했다. archive/hash는 바꾸지 않았다.
- SSH 비대화 sudo가 거절돼 사용자가 기존 VM 터미널에서 launcher SHA-256 `8f79e9a73448b6de15e3e021e01acdeb302cfe9d40ad7d02c1fea48512ad5a96`를 root 메모리로 대조한 뒤 고정 본문을 실행했다. source_verified·certificate_backup_passed 후 `p06_c_certificate_restored: HTTP403 retained; HTTPS=TLS rejected; pair/preview unchanged`, `p06_c_certificate_failed_restored`, **`certificate_exit=20`**을 확인했다. 정상 발급 성공 marker는 없었다. 추가 apply/발급/restore를 실행하지 않았다.
- 새 보호 백업은 `/var/lib/oioi-p06-c-before-certificate`, root launch는 `/var/lib/oioi-p06-c-certificate-launch`다. 이후 사용자 root의 **읽기 전용** 진단 `p06_c_recovery_backup_verified`로 전체 root:root·디렉터리0700/파일0600·사본/현재 원본 hash·HTTP 조각·정상 HTTP pair/preview를 다시 검사했다. 기존 두 보호 백업도 보존했다. SSH는 metadata만 확인했으며 root-only 내부 검증과 구분한다.

사용자가 정제한 root journal metadata에서 실제 실패 순서를 확인했다. 시각은 Asia/Seoul이다.

| 시각 | 실제 로그 |
| --- | --- |
| 01:40:58.434 | Console `obtaining certificate` |
| 01:40:59.560 | Console `trying to solve challenge`, http-01 |
| 01:41:00.106 | `challenge failed` / `validating authorization`, HTTP403·`urn:ietf:params:acme:error:unauthorized`. CA가 본 주소는 Cloudflare IPv6 `2606:4700:3030::ac43:cf6c`, 오류에 기록된 응답 URL scheme은 **https** |
| 01:41:00.871 이후 | 복구 reload로 발급 context canceled·lock 해제·job 종료. 이후 HTTP challenge 정보 부재 로그는 복구/취소 이후 기록 |

따라서 실제 CA HTTP-01 검증 실패는 확인했으나 **HTTPS 전환 지점과403 응답 생성 주체는 아직 미확정**이다. CA가 본 Cloudflare 주소만으로 Cloudflare 보안 규칙 차단이라고 단정하거나 일반403 조각이 challenge를 덮었다고 단정하지 않는다. [Caddy2.6.2 server.go](https://github.com/caddyserver/caddy/blob/v2.6.2/modules/caddyhttp/server.go#L254)는 사용자 handler 전에 HTTP challenge 처리를 시도한다. 이는 코드 순서이며 실제 요청이 그 처리까지 도달했다는 증거는 아니다. 사용자 확인의 Always Use HTTPS OFF·기존 규칙 상태를 임의로 뒤집어 해석하지 않는다.

실제 실패 요청에 한정해 Cloudflare 보안 이벤트의 2026-10-20 01:40:55~01:41:05 KST(10월19일16:40:55~16:41:05 UTC), Console host·ACME 경로의 Action/Service·규칙·Ray ID 존재 여부만 사용자에게 요청했다. 설정 재조사/변경이나 발급 재시도 요청은 아니다. 이벤트 부재만으로 origin 원인을 확정하지 않는다.

후속 사용자 상세 화면으로 **해당 ACME 요청에 Cloudflare 사용자 지정 규칙의 Managed Challenge가 적용됐음을 확인했다.** 2026-10-20 01:40:59 GMT+9·Console host·ACME 경로·GET·Let's Encrypt validation server User-Agent가 발급 로그와 일치하고, Edge 응답 완화 항목은 `사용자 지정 규칙에 의해 관리 챌린지`, 캐시 상태는 없음이었다. 따라서 CA HTTP-01 실패에 대응하는 Edge challenge의 출처는 확인됐으며, 위 미확정 설명은 이 화면 확인 전 이력이다. 이후 사용자가 `(http.request.uri.path contains "/admin")`, `(ip.src.country ne "KR")` 두 식을 제공했다. ACME 경로는 전자에 해당하지 않고 미국 검증 요청은 후자에 해당하므로 국가 Managed Challenge 규칙을 변경 대상으로 식별했다. 규칙 이름/ID는 미제공이며 원문 식·Action 일치로 대상을 대조한다. HTTPS 전환 지점은 아직 미확정이다. UA/분류만으로 일반 요청을 허용하거나 CA 클라이언트 IP를 고정 등록하지 않는다.

제안 변경은 위 국가 식 한 건에 Console 정확한 host·GET·`/.well-known/acme-challenge/` prefix만 제외하는 것이다. 정확한 변경/원복식과 지속 범위는 [PREPARATION](P06-PREPARATION.md#2026-10-20-cloudflare-국가-챌린지-규칙의-acme-예외승인안)을 따른다. 변경 직전 원본 식/Action/순서·활성 상태를 보관·대조하고 별도 승인받기 전 저장하지 않는다. 모든 사용자 지정/WAF 규칙을 생략하거나 일반 Console 요청을 허용하는 변경은 요청하지 않는다. **Cloudflare 변경·발급 재시도는 아직 실행하지 않았다.** 일반 HTTP403·preview·정상 pair 보존과 기존 실패 후 중단 계약을 유지한다.

복구 후 에이전트가 SSH/외부 WSL에서 독립 확인했다.

| 복구 후 실제 검사 | 결과 |
| --- | --- |
| Cloudflare HTTP `/`·임의 ACME 경로·위조 검증/IP 헤더 포함 로그인 POST | 모두403·정확한 Caddy 차단 본문·no-store·DYNAMIC |
| 직접 origin HTTP `/`·CSRF GET·로그인 POST | 모두403·세 no-store 헤더 |
| Console SNI TLS / Cloudflare HTTPS | VM Console TLS 거절 / 외부525. 정상 인증서 확보로 보고하지 않음 |
| preview origin TLS `/`·`/healthz`·`/readyz` | 모두200·기존 공개 인증서 hash 유지 |
| 두 앱/DB·Caddy | 네 health/readiness200·세 컨테이너 healthy. ID/시작 시각/이미지·Caddy PID926/active와 main Caddy hash `cf202c96...` 유지 |
| 보호 상태 | 기존/신규 백업·root launch root:root0700, 신규 파일0600은 사용자 root 재검증. current/previous/env/host 파일 hash 불변·비프록시 HTTP403 route·임시 candidate 부재 |

인증서 SAN·issuer·유효기간의 **성공 metadata는 확보하지 못했다.** 인증서/개인키 원문을 출력하거나 새 키/계정/인증서 저장소를 삭제·회수하지 않았다. 복구는 승인한 HTTP403 조각 복원 한 번이며 DNS/cache·Full(strict)·Always Use HTTPS·preview·정상 release를 바꾸지 않았다. 원인 확인 후 새 실행물/재시도 승인을 받기 전까지 고정 apply/restore·발급·다음 HTTPS 창을 실행하지 않는다. C 전체 완료가 아니다.

근거는 ignored `certificate-window/`의 `approval-received.json`, `receipt-preflight.json`, `staging-result.json`, `root-phase-result.json`, `root-diagnostic-result.json`, `vm-after-recovery.json`, `external-after-recovery.json`과 사용자 root 출력이다. root 원문/비공개 env/manifest는 공개 기록에 넣지 않는다. 기존 archive와 모든 보호 백업은 보존한다.

## 2026-10-20 승인된 국가 규칙 ACME 예외 적용과 상태 확인

사용자는 기존 비KR 국가 Managed Challenge 규칙 한 건에 Console 정확한 host·GET·ACME prefix만 제외하고 HTTP-01 갱신용으로 유지하는 범위를 별도 승인했다. 원복 식은 `(ip.src.country ne "KR")`이며 Action·활성 상태·순서·`/admin` 규칙과 나머지 설정은 보존하는 범위다. VM 변경·인증서 재시도는 승인하지 않았다. [정확한 식/범위](P06-PREPARATION.md#2026-10-20-cloudflare-국가-챌린지-규칙의-acme-예외승인안)를 따른다.

Cloudflare 도구/인증정보가 연결돼 있지 않아 에이전트가 API로 설정을 조회·저장하지 않았다. 사용자에게 승인된 정확한 식과 사전 대조 조건을 제공했고 사용자가 대시보드 저장 완료를 확인했다. Action/활성/순서·다른 규칙 보존은 해당 지시 아래 사용자 완료 확인이며 독립 API 대조로 기록하지 않는다.

저장 후 실제 네트워크 동작과 VM 상태를 읽기 확인했다.

| 검사 | 결과 |
| --- | --- |
| 동일 OCI VM 발신 → Cloudflare, Console GET `/` |403·`cf-mitigated: challenge`, Caddy 차단 본문 아님. 일반 요청의 국가 Challenge 유지 |
| 같은 발신 → Console GET `/.well-known/acme-challenge/p06-c-readonly-probe` |403·정확한 `Console is not public` 본문·no-store·DYNAMIC, cf-mitigated 없음. 해당 GET 경로가 Edge challenge를 통과해 닫힌 Caddy까지 도달 |
| 같은 발신 → 동일 ACME 경로 POST |403·`cf-mitigated: challenge`, Caddy 차단 본문 아님. method 범위 제한 유지 |
| WSL 외부 → Console 일반/임의 ACME HTTP GET | Caddy 차단 본문403·no-store·DYNAMIC |
| 같은 외부 → Console HTTPS |525. 인증서 확보/Full(strict) 성공 경로로 보고하지 않음 |
| preview 직접 origin TLS `/`·`/healthz`·`/readyz` | 모두200·기존 공개 인증서 hash 유지 |
| VM 상태 | 두 앱 네 health/readiness200·세 컨테이너 healthy. ID/시작 시각/이미지·Caddy PID926/active·main Caddyfile/materializer hash·HTTP loopback/등록 닫힘·비프록시403 route 유지. 기존/신규 보호 디렉터리 metadata 보존·임시 candidate 부재 |

이 비교는 **승인된 경로/메서드 예외와 기존 차단 보존의 실제 증거**다. 유효 ACME token200·CA 발급·Secure 쿠키/IP/인증 응답 cache 검증은 아니다. 에이전트는 설정/Caddy reload·apply/restore·컨테이너/DB·인증서 발급을 실행하지 않았다. 이전 archive62c6a1fa...와 모든 보호 백업은 보존했고 재실행하지 않았다.

근거는 ignored `certificate-window/`의 `cloudflare-country-rule-approval.json`, `vm-egress-after-country-exception.json`, `external-after-country-exception.json`, `vm-after-country-exception.json`과 사용자 대시보드 완료 답변이다. 다음 인증서 재시도는 새 고정 실행물/보호 경로·복구 범위의 별도 승인이 필요하다. 현재 일반 HTTP403·정상 pair/preview 보호 상태를 유지한다.

## 2026-10-20 인증서 재시도1 준비와 읽기 재확인

사용자는 기존 실패 묶음을 반복하지 않고 최소한의 새 실행물·hash·복구 절차를 준비한 뒤 발급 재시도 승인을 요청하도록 지시했다. 기존 Draft #166을 유지하고 [새 실행 범위·hash·명령](P06-PREPARATION.md#2026-10-20-인증서-재시도1-실행복구-승인안)을 준비했다. **이 절은 승인 전 로컬 준비 이력이며, 이후 승인·실행 결과는 다음 절에 구분한다.**

- 기존 head `62c36ee`의 [Verify39290644695](https://github.com/goldmayo/oioi-bwg/actions/runs/39290644695) attempt1 completed/success를 확인했다. 정상 receipt artifact12192252859는 미만료이며 ZIP digest·receipt/고정 candidate 원문 byte를 다시 대조했다. 이전 archive62c6a1fa...의 hash도 불변이다.
- SSH 읽기 관찰에서 현재 HTTP403/no-store/정확한 Caddy 본문·Console TLS 거절, main Caddyfile/materializer hash·PID926·preview 세 경로200/기존 인증서 hash·네 앱 health/readiness200·세 컨테이너 healthy/ID/start/image·HTTP loopback/등록 닫힘·비프록시403 route를 재확인했다. 기존 세 보호 백업의 디렉터리 metadata는 root:root0700이며 새 staging/launch/backup/candidate 경로는 없다. root-only 내부의 최신 검사는 SSH에서 실행하지 않았고 새 operator가 활성 변경 전에 권한·사본/원본 hash·links/containers/PID/preview를 대조하도록 했다.
- 같은 OCI VM 발신의 일반GET/ACME POST는 기존 Edge challenge403, ACME GET만 정확한 Caddy403/no-store/DYNAMIC·cf-mitigated 없음으로 다시 확인했다. 이전 실패 원인의 GET 예외가 동작하며 일반 요청 차단도 유지된다. 대시보드 설정을 재조사/변경하지 않았고 유효 토큰200·CA 성공 증거로 해석하지 않는다.
- 새 operator는 기존 실패 controller를 호출하지 않고 기존 DNS 보호 helper의 고정 source/manifest와 읽기 검증 함수만 재사용한다. 신규 경로와 실패 전 백업 읽기 검증을 추가했다. 공개 HTTPS 성공 검사는 국가 예외의 ACME probe 경로에서 **정확한 Caddy403 본문**까지 대조해 Edge challenge403 오인을 막는다. 발급 logger의 실제 오류/재시도만 실패로 분류하고 일반 임의 challenge 조회 로그와 구분한다.
- 로컬 제어 흐름 fixture9건(성공·발급 오류·시간 초과·validate 실패·main 불일치·미지 조각 복구 거절·인증서 캐시가 남은 복구·이전 백업 불일치·Edge challenge 본문 거절), 로그 분류6건·TLS 본문2건을 통과했다. root/helper·Docker/Caddy/systemd/journal/CA/TLS는 모사했으며 실제 VM 발급/복구 검증은 아니다. Python AST·실제 로컬 Caddy2.6.2 adapt(LE HTTP-01·Console TLS-ALPN 비활성·proxy 없음)·launcher bash-n·archive 일반 파일4개/내부 hash/launcher hash를 검증했다.

근거는 ignored `certificate-retry1/`의 `vm-preflight.json`, `cloudflare-preflight.json`, `receipt-preflight.json`, `operator-proof.json`, `guard-proof.json`, `static-proof.json`, `bundle-proof.json`이다. 인증서/개인키·env·manifest 원문은 출력하지 않았다. 기존 세 백업·정상 pair·receipt·preview를 유지하며 새 고정 범위의 별도 승인과 최신 문서 CI 성공 후에만 한 번 활성화할 수 있다.

## 2026-10-20 승인된 인증서 재시도1 성공과 서비스 보존

사용자는 새 고정 archive148c1b87...와 root launcher의 전달·보호 설치·백업·Console HTTP-01 활성화 한 번/최대180초·실패 시 한 번 복구만 승인했다. 기존 실패 묶음은 재실행하지 않았다. HTTPS Origin/env·임시 인증 접근·추가 Cloudflare 변경·일반 공개·#166 병합은 승인하지 않았다.

실행 전 head `22ef82e518cd54e179cb6598e3a37a6c232bd04a`의 [Verify39292178618](https://github.com/goldmayo/oioi-bwg/actions/runs/39292178618) attempt1 completed/success·archive/전체 내부 hash·미만료 정상 receipt12192252859의 ZIP digest/receipt/고정 candidate 원문 byte를 재대조했다. 현재 HTTP403·GET ACME 예외/일반 Challenge·preview/앱/DB·기존 보호 디렉터리 metadata·새 경로 부재도 다시 통과했다. 새 staging0700/파일0600에 archive/launcher만 전달하고 원격 hash를 검증했다.

SSH 비대화 sudo가 거절돼 사용자가 기존 VM 터미널에서 고정 launcher SHA를 root 메모리로 검증한 뒤 한 번 실행했다. `p06_c_certificate_retry1_source_verified`·`p06_c_certificate_retry1_backup_passed`·metadata·`p06_c_certificate_retry1_phase_passed`와 **`certificate_retry1_exit=0`**을 확인했다. 새 operator가 기존 세 백업과 현재 source/pair·preview를 대조하고 새 백업을 검증한 뒤 closed-acme 조각만 validate/reload했다. 발급 활성화는 한 번이며 **복구는 실행하지 않았다.** Caddy/CA 내부 네트워크 요청 수를 한 개로 주장하지 않는다.

| 성공 후 실제 검증 | 결과 |
| --- | --- |
| origin 인증서 신뢰/SAN/issuer | VM loopback·외부 직접 origin 모두 기본 CA 신뢰 검증 통과. SAN `console.oioibawige.com`, issuer Let's Encrypt YE2 |
| 유효기간 | 2026-10-19 16:21:32 UTC~2027-01-17 16:21:31 UTC(2026-10-20 01:21:32~2027-01-18 01:21:31 KST). notBefore를 실제 실행 시각으로 해석하지 않음 |
| 공개 인증서 DER SHA-256 | `7b3ec240c4867854b03d5eb954f4e9adfa9196c3d94de56e556f021fe1543ced` |
| 실제 Cloudflare HTTPS 일반/임의 ACME GET | 외부 WSL에서 모두403·정확한 Caddy 차단 본문·no-store·캐시 HIT 없음·cf-mitigated 없음. root operator도 VM 발신 ACME 예외 HTTPS403을 검증 |
| 직접 origin HTTP/HTTPS | 일반 HTTP·HTTPS 및 HTTPS CSRF 경로403/no-store·정확한 차단 본문. upstream 없음 |
| preview | VM/외부 origin `/`·`/healthz`·`/readyz` 모두200, 기존 공개 인증서 hash 유지 |
| 기존 pair/DB | 네 앱 health/readiness200·세 컨테이너 healthy. ID/start/image·Caddy PID926/active·main Caddyfile/materializer hash·HTTP loopback/등록 닫힘 유지. root operator에서 env/두 snapshot·링크·pending 부재까지 검증 |
| 보호 백업 | 새 `/var/lib/oioi-p06-c-before-certificate-retry1`와 launch는 root:root0700. 내부 전체 디렉터리0700/파일0600·사본/원본 검사는 사용자 root operator, 디렉터리 metadata/임시 candidate 부재는 후속 SSH 관찰로 구분. 기존 세 백업 보존 |

성공한 Console 전용 closed HTTPS403/HTTP-01 자동 갱신 설정을 유지한다. 인증서/개인키·env·manifest 원문은 출력하지 않았다. HTTPS Origin/env/materializer·임시 허용 matcher·컨테이너/DB·배포/snapshot·preview 인증서·Cloudflare 설정·#166 병합은 변경하지 않았다. 실제 Console 인증/Secure 쿠키·신뢰 IP 브라우저 검증은 아직 아니며 다음 HTTPS 창을 실행하지 않는다.

근거는 ignored `certificate-retry1/`의 `approval-received.json`, `staging-result.json`, `root-phase-result.json`, `vm-after-success.json`, `external-after-success.json`, `cloudflare-after-success.json`과 사용자 root 완료 출력이다. 새 재시도1 apply/restore의 수동 반복은 금지하고 기존 실패/복구 이력과 모든 보호 백업을 보존한다.

## 2026-10-20 제한 HTTPS 인증 창 최종 실행물 준비

사용자는 확보한 인증서/갱신·Cloudflare ACME 예외를 유지한 새 정상 기준 백업·HTTPS Origin 전환·임시 제한 matcher·실제 브라우저 인증 검증과 종료/원복안을 기존 Draft #166에 준비하도록 요청했다. [고정 hash·명령·최종 승인 범위](P06-PREPARATION.md#2026-10-20-제한-https-인증-검증-창-최종-실행복구-승인안)를 마련했으며 **새 묶음은 로컬 준비만 완료했다. VM 전달/설치·DB 조회·env/Caddy·service·컨테이너 변경은 실행하지 않았다.**

- 사용자는 Console TOTP 등록/인증 앱 보유 여부를 기억하지 못하며 집 Wi-Fi(PC)·휴대전화5G를 사용할 수 있다고 답했다. 동일 PC를5G 핫스팟으로 옮기는 검증을 준비했다. MFA는 승인 후 제한된 읽기 자격 조회와 사용자 인증 앱 준비 확인을 선행 gate로 두며 미등록이면 env 전환 전에 중단한다. 계정 생성·MFA 등록/reset·키/권한 변경을 대안으로 실행하지 않는다.
- SSH 읽기에서 새 Console 신뢰 인증서/closed HTTPS403·preview 세 경로200/기존 인증서 hash·네 앱 health/readiness200·세 컨테이너 healthy/ID/start/image·PID926/main/materializer hash 보존을 다시 확인했다. 실제 host materializer의 HTTP-only source hash를 읽어 검증했고 같은 #164 코드의 HTTPS 지원 파일을 임시 교체/원복 대상으로 고정했다. systemd255·기존 psql17 실행 파일 버전, 새 경로/임시 unit 부재도 확인했다. DB 자격으로 조회하거나 설정/서비스를 실행한 것은 아니다.
- 기존 Cloudflare 대시보드는 재조사하지 않았다. renderer의 CF peer CIDR을 [공식 IPv4](https://www.cloudflare.com/ips-v4)·[IPv6](https://www.cloudflare.com/ips-v6)와 대조했다. 기존 closed-acme 원문/issuer/HTTP-01·HTTP403을 유지하며 임시 token/진단 응답 header는 제한 handle에만 둔다.
- 실제 로컬 Caddy2.6.2/TLS/reload에서 일반/비신뢰 요청403·검증 header upstream 제거·client IP 덮어쓰기·matcher/token 제거와 제거 후 이전 값403·preview/PID 보존·token 로그 비노출을 통과했다. CF peer와 echo upstream은 모사이며 운영 실증이 아니다.
- 실제 로컬 headless Chromium/TLS에서 CDP의 Console origin 한정 token 공급·다른 host/redirect로 token 비전달·host-only/Secure/HttpOnly/Lax cookie scope를 확인했다. 임시 fixture CA/SPKI만 신뢰했고 실제 운영 브라우저에는 기본 CA 검증을 사용한다. [Chrome Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/)의 요청별 header 제어를 사용하며 운영 로그인/실제 Cloudflare 증거는 아직 아니다.
- 로컬 파일 fixture13건으로 정상 종료·abort·만료·MFA 부적격·validate 실패·Console recreate 실패·reload 실패·env drift 전에 matcher 닫기·본체 비정상 종료 복구·변경 전 무복구·실패 복구의 반복 거절·중복 service 실행·service 밖 실행 거절을 검증했다. 자격 조회/Secret stdin fixture6건은 등록/미등록/비활성/미존재/대상 불일치/입력 오류를 확인했다. root·Docker/DB·systemd·CA/TLS는 모사다. SQL은 라이브 DB에서 실행하지 않았다. Python AST·Node/bash syntax·로컬 systemd-analyze verify·archive 일반 파일9개/전체 내부 hash/launcher hash를 확인했다.

새 운영 창은 transient service 최대30분·deployment.lock·기존 네 백업 검증과 별도 새 보호 백업을 사용한다. Console만 같은 digest로 HTTPS 전환/원래 HTTP 복원을 하므로 Console ID/start가 바뀌는 점을 승인안에 명시했다. 정상 image pair/receipt/snapshot·원래 configHash와 Web/DB ID/start는 보존 대상이다. service 원복 성공만으로 인증 성공이라 하지 않고 root exit0과 실제 브라우저 proof를 함께 요구한다. 브라우저 비밀번호/TOTP·임시 token/cookie는 원문 기록하지 않고 MFA 소모 step의 정상 인증 변경을 되돌리지 않는다.

근거는 ignored `https-auth-window/`의 `vm-preflight.json`, `paths-proof.json`, `cidr-proof.json`, `local-proof.json`, `browser-gate-proof.json`, `window-proof.json`, `eligibility-proof.json`, `static-proof.json`, `bundle-proof.json`이다. 별도 실행 승인과 MFA/인증 앱 준비 전 개방하지 않는다. #166은 Draft·미병합이며 배포 파이프라인·추가 Cloudflare·일반 공개는 변경하지 않았다.

## 남은 완료 게이트와 운영 승인 범위

- 초기 Docker 연결 부재는 사용자의 연결 후 해소했다. 로컬 HTTP/HTTPS·격리 DB 전체 회귀와 위 CI의 두 이미지 검증이 통과했다. 이후 테스트/문서 커밋의 CI는 같은 PR에서 별도로 확인한다.
- 초기 공개 조회에서 Console DNS는 해석되지 않았고 preview Cloudflare 경로는 challenge 403, VM preview 원본 TLS는 정상이었다. 이후 사용자 DNS/cache 변경과 실제 공개 DNS·HTTP403/DYNAMIC을 위에 구분했다. Console origin 인증서와 닫힌 HTTPS403/no-store는 재시도1에서 검증했으며 실제 인증 응답 캐시 제외는 여전히 미검증이다.
- DNS 전 직접 origin HTTP 차단/TLS 거절을 완료했다. 실제 VM의 제한 HTTPS 브라우저 검증, 실제 Cloudflare client IP 두 개의 독립 제한, 제한 HTTPS에서의 직접 origin/위조 헤더 차단과 CDN 캐시 제외는 **미검증**이다. 로컬 모사 peer 성공으로 대체하지 않는다.
- 1차 보호 백업·HTTP 공동 배포·DNS 전 HTTP 차단과 최초 인증서 실패 후 HTTP403 복구(exit20), Cloudflare ACME 예외를 거쳐 새 승인 재시도1의 백업·발급 성공(exit0)을 완료했다. 수동 발급/restore를 반복하지 않는다. 이후 HTTPS 창은 그 시점의 닫힌 Caddy/pair를 보존할 새 보호 경로·실행/복구 명령으로 별도 승인받는다. 기존 백업은 덮어쓰지 않는다. Full(strict) 해제·DNS-only 전환·무한 발급 재시도는 하지 않는다.
- loopback/SSH TLS 검증과 실제 Cloudflare→Caddy 경로 검증을 구분한다. 닫힌 인증서/HTTPS403은 확보했지만 실제 인증 접근의 제한 matcher·HTTPS Origin/env와 실행/복구 명령은 별도 승인 전 미적용이다. DNS/인증서 확보만으로 C 완료라 하지 않는다.
- #163/#165 병합·#164 HTTP 공동 배포·HTTP 전용 차단과 새 승인 재시도1의 Console ACME/closed HTTPS403을 완료했다. 후속 host asset 설치·HTTPS Origin/env·임시 허용 matcher는 미실행이다. DNS/cache 두 항목과 국가 규칙의 좁은 ACME 예외는 사용자가 승인 범위로 완료했고 에이전트 직접 Cloudflare 변경은 없다. 후속 작업은 정확한 보호 파일 경로·실행 후보·복구 명령과 함께 별도 승인받는다.

위 게이트를 통과하기 전에는 C를 완료로 바꾸지 않는다. D 실물 MFA·CLI/키 복구, E Web 관리/가입 종료, F 공개/www 전환은 기존 단계에 남긴다.

## 2026-10-20 VM 계정 실측과 최초 운영자 준비

사용자가 작업 재개와 계속 진행을 지시한 뒤 고정 HTTPS archive6dc1453a.../launcher·최신 문서 CI·정상 receipt와 VM closed 인증서/403·preview/앱/DB를 재대조했다. 신규 사용자 staging0700/파일0600에 전달했고 사용자가 고정 launcher를 root 메모리에서 검증해 실행했다. `p06_c_auth_source_verified` 후 `targetVerified=true, found=false, activeAdmin=false, registered=false, eligible=false`와 **`auth_eligibility_exit=2`**를 보고했다. 보호 설치만 완료했으며 env/Caddy·등록/인증 창은 열지 않았다. 에이전트의 후속 SSH에서도 root launch0700·새 창 백업/candidate/임시 unit 부재를 확인했다.

처음에는 사용자에게 기존 계정/로그인 방식을 되물었으나, 이후 사용자의 직접 확인 지시에 따라 같은 VM DB를 에이전트가 조회했다. 현재 고정 Console/DB ID와 HTTP Origin/등록 닫힘을 검사한 뒤 기존 app credential을 메모리→psql stdin으로만 공급했다. `BEGIN READ ONLY`, statement_timeout5초/lock_timeout2초, DB명·oioi_app·PostgreSQL17·비특권·SELECT 권한/RLS 비활성을 대조해 행 필터링이나 잘못된 DB/role 때문에0으로 보인 경우를 배제했다. 모든 조회 뒤 ROLLBACK했다.

| 직접 확인한 집계 | VM 결과 |
| --- | --- |
| account / password_credential / admin_mfa | 각각0행 |
| ACTIVE ADMIN·비밀번호 보유 ADMIN·활성 MFA/Console 적격 ADMIN | 모두0 |
| 지정 이메일의 password credential |0 |
| account/password_credential/admin_mfa SELECT·RLS | 조회 권한 있음·세 테이블 RLS 꺼짐 |

이메일·password hash·MFA secret/키/복구코드는 조회 결과/공개 증거에 넣지 않았다. 실제 row 생성/수정·OTP/메일 발송은 하지 않았다. 사용자는 로컬 Docker에만 MFA가 있고 VM에는 없다고 정정했으며 인증 앱 준비를 확인했다. 로컬 상태를 VM에 복제하거나 기존 관리자 전제를 계속 사용하지 않는다.

별도 읽기에서 Web의 OCI 메일 설정 존재·production/oci 모드, 배포 JS 안의 Instance Principal/IMDS/메일 경로와 컨테이너→metadata TCP 실패를 확인했다. 따라서 기존 Web 가입 메일 경로와 B0 metadata deny의 의존성 충돌이 있다. **가입 POST/실제 발송 실패를 실행해 확인한 증거는 아니다.** 메일/OTP 요청은 DB 상태와 외부 발송을 만들므로 읽기 관찰로 대체하지 않았다. 기존 `console:mfa`의 local-compose guard와 #164 source의 동일 제한도 확인했다. 일반 Web 메일 경로 복구나 D 전체 완료로 보고하지 않는다.

새 로컬 일회성 실행물은 [최초 운영자 승인 범위](P06-PREPARATION.md#2026-10-20-vm-최초-운영자-계정과-mfa-선행-승인안)에 고정했다. **이 신규 묶음의 VM 전달·root 설치·실제 메일 제출·계정 생성/승격·MFA/env/컨테이너 변경은 아직 실행하지 않았다.** 기존 앱 서비스13개 파일의 hash를 #164 source와 대조해 그대로 묶고, 메일 transport만 root host의 OCI CLI로 위임하도록 준비했다. 지정 이메일 OTP 검증→USER 생성→공통 권한 변경 service의 ADMIN/version1 승격→SSH localhost 기존 화면의 실물 등록·다음 새 OTP 로그인→등록 닫힘의 경로다. metadata deny·공개403·기존 키/이미지/pair/snapshot·Web/DB는 유지한다. 정상/실패 시 원래 env/configHash로 Console만 재생성하며 Console ID/start는 보존 대상이 아니다. 실패한 등록 창은 설정 복구 후 USER/version2로 회수하며 계정/행을 삭제하거나 DB 전체를 복원하지 않는다. 계정 단계의 불확실한 성공·사전 불일치는 반복/임의 SQL 없이 중단한다.

실제 수행한 로컬 검증은 다음과 같다.

- 격리 Docker PostgreSQL17·별도 app/migrator role에서 기존 가입/권한 변경 서비스12건 통과: 대상 DB/시작 시각 guard, suppressed/불확실 발송·잘못된OTP·잘못된 비밀번호의 계정 미생성, 실제 OTP 검증/소모·USER/Profile/Argon2id 생성, ADMIN/version1 원자 승격·중복 거절·version 불일치 거절·USER/version2 회수. 메일 제출은 모사했고 임시 DB/role은 삭제했다.
- 로컬 파일/제어 fixture10건 통과: 정상·abort·만료·Console 교체 실패·미승인 env drift 보존/exit21·service 밖/중복 실행 거절·비정상 종료 복구·result21 반복 거절·변경 전 무복구. root/Docker/systemd/DB/브라우저는 모사다.
- 실제 로컬 Node의 size-prefixed stdin loader·TTY 부재 시 변경 전 거절과 기존 ARM64 Argon2 native binding hash를 대조해 잘못된 init을 DB 접속 전에 거절했다. host 메일 stdin/비밀값 argv 비노출·suppressed/거절 분류 fixture3건도 통과했다. 기존 VM native binding의 hash/load 가능 여부와 host CLI의 submit-email 입력 필드는 읽기 검증했으며 서명/실제 메일은 하지 않았다.
- Python AST·Node syntax·launcher bash-n·로컬 systemd-analyze verify·archive 일반 파일6개/내부 hash를 확인했다. 문서 상대 링크/anchor61개와 git diff-check도 통과했으며 문서만 변경하므로 앱 lint/typecheck/test/build는 재실행하지 않았다. 첫 로컬 bundle alias가 메일 template까지 가리킨 오류와 로컬 ARM64에서 x64 binding을 선택한 fixture 오류는 수정 후 재검증했다. VM 실패가 아니다. 실제 headed MFA 등록/VM 복구는 아직 검증하지 않았다.

직접 VM 관찰 근거는 ignored `https-auth-window/`의 `eligibility-runtime-result.json`, `account-inventory-readonly.json`, `account-visibility-readonly.json`, `deployed-mail-code-readonly.json`, `signup-prerequisite-proof.json`과 사용자 root 출력이다. 새 실행물/로컬 근거는 ignored `operator-bootstrap/`의 `APPROVALS.txt`, `source-provenance.json`, `worker-proof.json`, `controller-proof.json`, `transport-proof.json`, `bundle-proof.json`이다. Caddy PID926·기존 세 컨테이너 ID/start/image·네 앱 health/readiness200·preview 세 경로200/인증서·Console 인증서/closed403은 후속 SSH에서 보존을 확인했다.

기존 archive6dc1453a...와 root 설치를 보존하되, 이후 MFA 등록으로 Console을 재생성하면 고정 container ID가 달라지므로 그대로 실행하지 않는다. 등록 성공 후 새 보호 baseline과 실제 ID/configHash를 읽기 대조해 HTTPS 창의 새 hash/복구안을 제시하고 별도 승인받는다. 새 PR·배포 파이프라인·#164 후보는 변경하지 않으며 #166은 Draft·미병합이다. C는 아직 미완료다.


## 2026-10-21 최초 운영자 메일·인증 성공과 가입 중단·재개1

사용자가 최초 운영자 실행을 승인한 뒤 head `f355f77f65db0fdb48ee419fa0540c38d0ab8653`의 [Verify39441734469](https://github.com/goldmayo/oioi-bwg/actions/runs/39441734469) attempt1 success·정상 receipt12192252859/고정 candidate·archive429657cf.../내부 hash를 대조하고 새 staging에 전달했다. 사용자가 고정 launcher `b9fcd0fe...`를 root로 한 번 실행했다. source verified와 설정/snapshot·auth6개 테이블의 새 root-only backup passed 후 메일 제출 marker·이메일 코드/비밀번호 입력을 거쳐 **operator_account_exit=1**로 중단했다. enrollment-start는 호출되지 않았다. 사용자는 실제 메일 수신을 확인했다.

에이전트가 기존 app credential을 stdin으로만 공급한 READ ONLY/ROLLBACK으로 직접 재조회했다. account는0행, 대상 challenge는 생성 `2026-10-21 01:14:49.326940+09:00`·검증 `01:15:07.177+09:00`의 미소모 VERIFIED·실패횟수0이었다. 따라서 이메일 코드 검증까지 성공했으며 계정/권한/MFA는 생성되지 않았다. 첫 실행물이 비밀번호 불일치·정책 위반·가입 서비스 실패를 같은 일반 오류로 숨겨 **정확한 최초 원인은 확정할 수 없다**. 사용자의 비밀번호 오입력으로 단정하지 않는다. 기존 Web API의500과 이번 host 경유 메일의 실제 수신/검증 성공은 별개 관찰이다.

후속 SSH 읽기에서 기존 세 컨테이너 ID/start/image/healthy·네 health/readiness200·preview 세 경로200/기존 공개 인증서·Console 신뢰 인증서/HTTP·HTTPS403/no-store·Caddy PID926/main/materializer hash 보존을 통과했다. HTTP Origin과 등록 flag=false, enrollment unit not-found다. 계정 생성 재호출·추가 메일·env/Caddy 변경은 하지 않았다. 근거는 ignored `operator-bootstrap/account-failure-readonly.json`, `certificate-retry1/vm-after-success.json`과 사용자 root 출력이다.

사용자의 재시도 지시에 따라 **기존 일회성 launcher/account를 다시 실행하지 않는** 새 가입 재개1을 준비했다. [정확한 실행·중단 범위](P06-PREPARATION.md#2026-10-21-인증된-가입의-재개1)를 따른다. 동일한 미소모 VERIFIED의 생성/검증 시각·대상·유일성·계정0과 기존 보호 백업/원본을 재대조하고, 기존 completeSignup과 changeConsoleAccountAccess를 각 한 번만 호출한다. 기존 repository의 VERIFIED 소비 계약을 그대로 사용하며 OTP 상태를 직접 바꾸거나 expires_at을 연장하지 않는다. 비밀번호 형식/두 입력 일치는 변경 전 최대3회 숨김 입력으로 교정하며 값 대신 이유 코드만 표시한다. 가입 실패 시 현재 phase를 알리고 자동 재시도 없이 중단한다.

새 archive SHA256 `c00e4a6658743c8c52fdc236a0abb7b625ba1f39c87f45a53288fd8179c71241`, launcher `e685a79ed02267dcdb578618318aa02ac35ecf00c1786ef813640d2c028e68aa`, resume.py `c2e84f0666c71d15673790047ed3278ab7cfe8800d3b9ea4744099e8da852b81`다. 로컬 실제 파일/제어 fixture9건(정상·입력 교정/3회 실패·기존 계정/marker·challenge 변경·가입 응답 불확실·승격 실패·중복 시작)을 통과했다. root/DB/Worker는 모사이고 실제 VM 가입 성공 증거가 아니다. 기존 서비스/worker source는 변경하지 않았다. 새 계정 준비 성공 때만 기존 승인된 SSH 등록 unit을 한 번 시작하고 기존 등록 닫기/설정 복구·실패 시 USER/version2 회수 계약을 사용한다. 현재 재개1 root 실행/MFA 등록·HTTPS 인증 창은 아직 미실행이며 #166은 Draft·미병합이다.


## 2026-10-21 가입 재개1 성공과 SSH MFA 검증 진입

사용자가 새 고정 launcher `e685a79e...`를 root 메모리에서 검증해 실행했다. source verified·새 보호 backup passed·email-verified USER created·ADMIN/ACTIVE version1 account prepared와 **operator_resume1_exit=0**, 이어 **operator_enrollment_start_exit=0**을 확인했다. 메일 재발송은 없고 원래 일회성 account 단계를 반복하지 않았다. 최초 실패가 비밀번호 오입력 때문이었다고 소급 확정하지 않는다.

후속 직접 SSH에서 transient 등록 unit active/running·Console HTTP Origin 유지/등록 flag=true·같은 Console digest·세 컨테이너 healthy·네 health/readiness200을 확인했다. 승인된 등록 전환으로 Console ID는 `461e4579631bfe750c270eed9bab4bbb57347375d27dc4ac264e57385989f696`로 바뀌었으며 Web/DB ID·digest는 유지됐다. main Caddy/materializer hash·PID926·두 기존 인증서 hash·preview 세 경로200·Console TLS의 `/`와 `/api/auth/csrf` exact Caddy403/no-store도 읽기 재검증했다.

기존 고정 `enroll.mjs`의 headed Chromium과 전용 SSH loopback forward를 에이전트가 열었다. 사용자가 직접 새 비밀번호와 실물 인증 앱으로 QR 등록/confirm을 진행하는 단계다. **실제 MFA 활성화·다음 새 OTP 로그인·로그아웃·등록 닫힘/복구 성공은 아직 보고하지 않는다.** 근거는 ignored `operator-resume1/root-execution-result.json`, `enrollment-readiness.json`, `enrollment-protection.json`과 실제 브라우저의 등록 대기 상태다. HTTPS Origin/env·Caddy/Cloudflare·일반 공개·#166 병합은 실행하지 않았다.


## 2026-10-21 실물 MFA 등록과 브라우저 helper 중단·자동 회수

사용자가 등록 확인 완료와 로그인을 알린 뒤 helper의 입력 대기를 진행시켰으나 `p06_operator_browser_failed`/exit1로 중단했다. helper는 승인된 abort를 제출했고 이후 직접 READ ONLY에서 대상 account1이 **USER/ACTIVE·MFA version2·enabled=true·OTP 사용 상태 있음**을 확인했다. MFA 등록은 보존됐으나 보호 API200/로그아웃/등록 닫힘까지의 원래 browser proof는 생성되지 않았다. 사용자 보고만으로 전체 인증 검증 성공을 주장하지 않는다.

원래 helper는 채팅 완료 신호/Enter 뒤에 등록 완료 화면의 `로그인으로 돌아가기` 버튼을 기다린다. 사용자가 이미 다음 로그인 화면/관리 화면으로 진행하면 지나간 버튼을 기다리다 실패할 수 있는 결함을 실제 로컬 Chromium에서 재현했다. 원래 오류에는 phase가 없어 이번 실제 중단 경로 전체를 확정하지 못하지만, 사용자 완료 진행을 실패로 취급할 수 있는 helper를 에이전트가 만든 책임을 기록한다.

후속 SSH에서 close.request=abort·등록 unit not-found/inactive·Console HTTP Origin/등록 flag=false·복구된 Console ID `6c0a009c095923f943417e05309df54f3b316366261913cea0ad7bcf79b7f004`와 같은 digest·세 컨테이너 healthy/네 health/readiness200·Web/DB ID/start 보존을 확인했다. Console/preview 신뢰 인증서·HTTP/HTTPS exact403/no-store·preview 세 경로200·Caddy PID926/main/materializer hash·비프록시403 route도 다시 통과했다. root-only 최종 enrollment-result/사본·전체 권한은 새 실행의 변경 전 guard에서 읽기 대조하도록 남겼으며, unprivileged 관찰만으로 root exit20 marker까지 읽었다고 주장하지 않는다. 기존 등록 unit/복구/계정 실행물을 재실행하지 않았다.

별도 권한 복구1은 [최소 실행·철회 범위](P06-PREPARATION.md#2026-10-21-등록된-mfa를-보존하는-권한-복구1)를 따른다. 방금 생성한 계정 한 건의 USER/ACTIVE/version2·활성 MFA와 닫힌 복구 baseline을 대조한 뒤 기존 공통 service로 ADMIN/ACTIVE/version3 재승격 한 번만 준비했다. MFA reset/QR 재등록·비밀번호 변경·등록 창/env/컨테이너 전환은 없다. 새 로그인 전용 helper는 Enter나 중간 화면 대신 최종 admin URL/관리 GET200·로그아웃·등록 닫힘을 검사한다. 별도 승격 및 명시적 철회 명령은 서로 다른 O_EXCL marker와 기대 version을 사용하며 실패/불확실 응답은 반복하지 않는다.

고정 archive SHA256 `af116ca7329cc9f8680c79ed3ed3f1a7810bfba8d015199fcdc0ced09dfb2706`, launcher `512489415dccf8bcc21bac3f87fda4ff6a9e78fdbc653ae31bf0d87818d6a4c3`다. 새 묶음은 ignored `operator-access-restore1/`에 보존했다. 공통 source8개를 #164와 대조했고 로컬 제어 fixture8건·격리 실제 Docker PostgreSQL17 권한 service5건·실제 Node size-prefixed loader의 변경 전 잘못된 명령 거절·실제 Chromium의 빠른 화면 진행 race 재현/최종 URL 수용을 통과했다. DB fixture에서 sentinel MFA/사용한 OTP 상태 보존·version3/명시적 회수4·중복 거절을 확인했으며 실제 VM 권한 변경/로그인 성공 증거는 아니다. 첫 fixture의 Date 객체 동일성 비교와 HTML charset 누락은 수정 후 재검증했다. Python/Node/bash syntax·archive 일반 파일6개/내부 hash도 확인했다. 신규 VM 전달/재승격은 별도 승인 전 미실행이다. #166 Draft·기존 인증서/자동 갱신·Cloudflare ACME 예외·공개403·정상 pair/snapshot·Web/DB를 유지하며 HTTPS 인증 창은 아직 열지 않는다.


## 2026-10-21 권한 복구1·실제 로그인 검증 성공과 HTTPS 창2 준비

사용자가 archive `af116ca7...`의 대상 한 건 USER2→ADMIN3 복구와 SSH 로그인 검증을 별도 승인했다. 최신 문서 [Verify39462047372](https://github.com/goldmayo/oioi-bwg/actions/runs/39462047372) attempt1 success·정상 receipt12192252859/고정 candidate·archive/전체 내부 hash와 현재 닫힌 서비스를 대조해 새 staging0700/파일0600에 전달했다. 사용자가 launcher `51248941...`를 root로 한 번 실행했고 source verified·phase passed와 **operator_access_restore1_exit=0**을 확인했다. 원래 공통 권한 service의 ADMIN/ACTIVE/version3 복구, 등록된 MFA 보존·등록 flag 닫힘·정상 pair/preview 불변을 root가 검증했다. 명시적 USER4 철회는 실행하지 않았다.

직접 READ ONLY 재조회에서 account1·ADMIN/ACTIVE/version3·enabled MFA와 원래 세 컨테이너 ID/start/image/healthy·HTTP Origin/등록false를 확인한 뒤 새 로그인 전용 headed Chromium/SSH forward를 열었다. **실제 새 OTP 로그인→관리 GET200→로그아웃/세션 cookie 제거→setup/confirm403·등록 버튼 부재**가 자동 검증돼 helper exit0/proof를 남기고 정상 종료했다. 중간 화면/Enter 신호에 의존하지 않았고 등록 창을 다시 열거나 VM 설정을 바꾸지 않았다. 비밀번호/OTP·QR/키·Cookie 원문/trace/HAR/storageState는 저장·출력하지 않았다. 근거는 ignored `operator-access-restore1/root-execution-result.json`, `after-root-readiness.json`, `login-browser-proof.json`이다.

후속 직접 SSH에서 세 컨테이너 ID/start/image/healthy·네 health/readiness200·preview 세 경로200/기존 인증서·Console 신뢰 인증서/HTTP·HTTPS exact403/no-store·Caddy PID926/main/materializer hash·비프록시403 route 보존을 다시 통과했다. `after-login-closed-state.json`에 비밀값 없는 결과를 보존했다. Console ID는 `6c0a009c095923f943417e05309df54f3b316366261913cea0ad7bcf79b7f004`이며 새로운 재생성은 없었다. 기존 등록 실패 이력과 USER2 회수/ADMIN3 복구 marker·모든 보호 백업을 보존한다.

이 기준으로 **새 HTTPS 창2**를 ignored `https-auth-window2/`에 준비했다. [정확한 전환·종료/복구 범위](P06-PREPARATION.md#2026-10-21-실제-mfa-검증-후-제한-https-창2)를 따른다. 기존 archive6dc1453a.../자격 exit2 설치를 반복하지 않고 새 경로·새 token과 현재 Console/운영자 baseline을 사용한다. 원래 인증서/배포 네 백업에 더해 계정/재개/등록의 세 백업·auth dump hash·after-enrollment와 권한 복구1 before/complete·DB 시작 시각을 검사한다. 새 eligibility는 보호된 기존 이메일/account1·ADMIN/ACTIVE/version3·활성 MFA만 허용한다.

새 browser는 UI credentials callback의 필요한 값을 프로세스 메모리로만 받아 실제 UI 로그인 뒤 부정/재사용 인증을 검사하고 버린다. 중간 폼을 뒤늦게 읽거나 Enter를 기다리지 않는다. 집 Wi-Fi 제한 후 같은 PC의5G 핫스팟 전환을4분 안에 자동 감지하고 같은 세션의 관리 접근/독립 IP 제한을 확인한다. 외부 서비스/보안 설정을 바꾸거나 MFA/권한을 다시 수정하지 않는다. 최종 matcher 제거/이전 token·일반403·HTTP env/configHash/동일 pair·서비스/복구 검증은 그대로다.

고정 archive SHA256 `8f89317f3a3e7b529e381c59ee63463e6ec824dbf9187d2e3b4ba5cd7056715f`, launcher `f981882abdbad75384bcce91378c941a185e5e293dc84621a49e3c73d628b529`, window.py `effc21fb961465c4a6fe73ca8b657fce211fab8f56f181c1b78f606ae308d242`다. 신규 VM 전달/전환/개방은 아직 하지 않았다. 실제 브라우저 인증·Secure cookie/Origin/CSRF·Cloudflare IP 두 개/캐시 및 제거 후403을 다음 별도 승인 창에서 검증해야 하므로 C는 아직 미완료다.

실제 수행한 새 로컬 검증:

- 새 baseline fixture10건: 현재 ADMIN3/새 Console 수용, 역할/version/등록 재개방·이전 Console ID·원본 drift·DB 재시작·auth dump/체크포인트/링크 불일치 거절. 실제 로컬 파일/함수이며 root/DB/helper는 모사다.
- 기존 전환/복구 fixture13건을 새 경로에서 통과했다. eligibility 미충족/validate·compose/reload 실패·abort/만료/중복/비service·drift 우선 닫힘/exit21·비정상 복구 포함. 실제 VM/systemd 실행은 아니다.
- 새 eligibility stdin/대상 fixture8건과 실제 격리 Docker PostgreSQL17 SQL6건 통과. 실제 schema/app role에서 계정 없음·ADMIN2·USER3·정지·미등록 거절과 활성 ADMIN3 수용을 확인했다. DB/role identity literal만 폐기용 fixture에 맞췄으며 임시 DB/role은 삭제했다.
- 실제 로컬 Caddy2.6.2/TLS/reload에서 header upstream 제거·일반/비신뢰403·matcher 제거/이전 값403·preview/PID 보존·token 로그 비노출을 통과했다. CF peer만 모사했다. 실제 Chromium/TLS의 origin 한정 gate/다른 호스트 redirect에서 token·Console cookie 비전달도 통과했다.
- 새 browser 전체 흐름11그룹을 실제 로컬 Chromium/TLS에서 통과했다. 빠른 UI 진행·부정/재사용 인증·CSRF·Console 쿠키/CF cookie 구분·인증 세션의 익명 context 비공유·두 IP 자동 감지·logout·제거 후403을 검사했지만 auth/CF/회선 전환/VM 닫기는 모사다. 실제 VM HTTPS/두 회선 성공 증거가 아니다. 처음 fixture의 DEBUG 거절과 예상 그룹 수 보정 후 통과했다.
- Python/Node/bash syntax·로컬 systemd unit verify·기본 경로와 launcher 일치·archive 일반 파일9개/내부 hash를 고정했다. 신규 경로 생성기의 중복 치환을 로컬 대조에서 수정했으며 미승인 준비 archive는 ignored 하위 경로에 보존했다. 최종 해시를 반영하는 과정의 작업 디렉터리 오류는 문서 후속 커밋으로 정정하며, 이전 준비 해시의 실행/승인을 요청하지 않는다. 앱/이미지/배포 파이프라인·Cloudflare·기존 인증서/갱신·#166 Draft 상태는 그대로다.

## 2026-10-21 최소 HTTPS 창2 실행·중단과 원복

사용자가 두 실제 회선의 제한 분리·IP 변경 후 세션 유지·실패 반복에 의한 한도 소진을 이번 필수 검증에서 제외했다. 해당 항목은 미실시이며 IP 제한 구현은 유지한다. 앞선 전체 창2 계획과 archive8f89317f...는 이력으로 보존하고, 로그인 입력값 수집·부정/재사용 로그인 검사도 뺀 `https-auth-window2/minimal/`을 승인받았다. archive SHA256은 `12229f0fc384180f1078a44abaed90df2252401c1a402f255a0dde6b6865cc44`, launcher는 `779f334200c9da55752efaefa43655d2ddd7d02224404b7b8fc2d8d221f7bfc5`이며 controller와 복구 파일은 기존 고정본 그대로다.

문서 head `0bbcac493920513e94a2901dd3e41791886aeddb`의 Verify39467639498 필수 scope/verify 성공·정상 receipt12192252859 미만료·현재 닫힌 서비스를 대조한 뒤 네 보호 파일만 신규 staging에 전달했다. 사용자 sudo 위임 후 고정 launcher의 설치·eligibility 부분을 실행해 모두 exit0을 확인했다. 이후 사용자 진행 지시로 설치된 controller/manifest 해시를 검증하고 `start --operator-ready`를 한 번 실행했다. start exit0·opened marker·transient unit active를 직접 확인했다. 새 root-only 백업은 `/var/lib/oioi-p06-c-before-auth-window2`이며 같은 Console digest로 HTTPS Origin 전환·제한 matcher를 적용했다.

실제 headed Chromium helper는 새 CSRF 토큰 두 개의 비공유·no-store·캐시 HIT 부재까지 통과한 뒤 전달 IP·Origin·위조 헤더 검사 구간에서 exit1로 중단했다. 마지막 기록은 `fresh_csrf_not_shared_or_cached`이며 세부 assertion/응답을 기록하지 않아 당시 정확한 실패 지점은 확정하지 못한다. helper는 `close.request=abort`를 제출했고 **root 최종 결과 `exitCode=20`, `result=aborted`와 unit not-found/inactive**를 읽어 확인했다. 실제 HTTPS MFA 로그인·Secure 세션 쿠키·인증 캐시 격리·로그아웃 성공 proof는 없으며 통과로 기록하지 않는다.

원복 후 독립 SSH/외부 검사에서 원래 HTTP Origin·등록false·Console configHash/동일 digest·정상 pair/snapshot·Caddy/materializer hash와 기존 인증서를 보존했다. root controller가 보호 파일/링크/configHash를 검사했고, 독립 관찰에서 Web/DB ID/start/image 불변·네 health/readiness200·preview 세 경로200·일반/이전 token의 정확한 Caddy403/no-store·진단 IP 응답 헤더 제거를 확인했다. Console은 전환/복원으로 재생성돼 현재 ID가 `ff863e7aed935c179fe23d34f0d8d8909477043f9f879631f2d6c4a3d5b4da62`다.

닫힌 상태의 GET으로 여섯 위조 헤더를 각각 분리한 후속 진단에서 **`CF-Connecting-IP` 단독과 전체 조합만 Cloudflare403/error1000**, 나머지 다섯 헤더는 정확한 Caddy 차단403을 확인했다. [Cloudflare 공식 설명](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1000/)도 클라이언트의 이 헤더 포함을 error1000 원인으로 명시한다. 따라서 모든 위조 헤더를 묶어200/동일 IP를 기대한 helper에는 결함이 있다. 다음 검증에서는 이 Edge 거절과 다른 forwarded 헤더의 Caddy 덮어쓰기를 분리하고, 검사 직전 단계·허용된 응답 metadata를 기록해야 한다. 후속 닫힌 상태 관찰을 당시 열린 창의 정확한 실패 위치나 실제 앱 IP 검증 성공으로 소급하지 않는다. Cloudflare 설정을 완화하지 않았다.

근거는 ignored `https-auth-window2/minimal/`의 `transfer-proof.json`, `root-install-eligibility-execution.json`, `root-start-execution.json`, `browser-failure-proof.json`, `root-status-execution.json`, `vm-after-abort.json`, `external-after-abort.json`, `closed-header-diagnostic.json`과 실제 helper 출력이다. 설치/시작/복구를 반복하지 않고 모든 백업·실행물을 보존한다. 새 준비나 재개방 전에 helper 결함과 변경된 Console baseline을 반영해야 한다. 계정/역할/MFA reset·추가 배포·새 PR·파이프라인 변경은 없으며 #166은 Draft·미병합이다. 수정한 두 문서의 로컬 링크/anchor38개와 `git diff --check`를 통과했고, 앱 lint/typecheck/test/build와 기존 로컬 fixture는 재실행하지 않았다.

## 2026-10-21 helper 보완과 최소 HTTPS 창3 로컬 준비

사용자의 작업 지시 뒤 PC 로그인 가능 여부를 확인했고 모바일만 사용 가능하다는 답을 받았다. 기존 sudo 위임은 유지하며 ignored `https-auth-window3/`에 로컬 준비만 완료했다. 창2 실행물·백업·marker를 보존하고 새 경로·token을 사용한다. 설치 launcher는 보호 설치와 READ ONLY eligibility까지만 수행하도록 분리했으며 실제 start는 PC 로그인 준비 후에만 실행한다. 이번에는 VM 전달·설치·DB 자격 조회·개방을 하지 않았다.

helper는 `CF-Connecting-IP` 위조를 Cloudflare403/error1000 검사로 분리하고 나머지 헤더5종은 각각/조합의200·기존 관찰 IP·CSRF/no-store를 요구한다. 검사 직전 phase와 실패 시 응답 상태·허용된 boolean만 남기며 원문 IP/헤더/본문/쿠키/로그인 입력은 저장하지 않는다. 헤더 검사를 마친 뒤 로그인 브라우저를 연다. 새 controller는 기존 운영자/배포/인증서 검사를 유지하고 창2의 고정 source/manifest·정확한 exit20 결과·marker·보호 백업·현재 원본/링크·Web/DB를 추가 대조한다. 원복 후 Console ID/start를 고정해 이전 ID를 단순 교체하거나 일회 marker를 초기화하지 않는다.

archive SHA256은 `7d0483e342690f87a79c48c152557c64a3d25c4d645f96ea50a6948573656007`, 설치 launcher는 `2ed46a150ad0c7931ef1a3eff329909aae38e735d6ae76b1087ececef770774e`다. 실제 수행한 검사는 Python/내장 Python·Node·bash 문법, archive 일반 파일9개/내부 hash·진입점 hash 연결·입력0600, 전환/복구 포함 기존 controller23함수의 AST 동일·Caddy/renderer/materializer/SQL5파일 바이트 동일·창2 원본 보존이다. SSH 읽기 재확인에서 원복 후 컨테이너 ID/start/image·Caddy/materializer·인증서·403/health/preview와 창2/3 unit 부재·창3 신규 경로 부재를 확인했다. 근거는 새 `bundle-proof.json`·`vm-preflight.json`이며 sudo·VM 쓰기·로컬 runtime fixture·앱 테스트는 실행하지 않았다. 정적 준비는 실제 HTTPS 인증 성공이 아니며 남은 범위와 두 회선 제외는 그대로다.

수정한 두 문서의 로컬 링크/anchor39개와 `git diff --check`를 통과했다. 준비 시 정상 receipt12192252859 미만료와 #166의 Draft·미병합 상태를 읽기 확인했으며, 실제 재개 직전에는 최신 상태를 다시 대조한다.


## 2026-10-21 보안 패치 후 회사 브라우저용 HTTPS 창4 준비

사용자가 보안 패치 후 나머지 작업 재개를 지시했다. [보안 배포 결과](P06-NEXT-SECURITY-RESULT.md)의
Promotion #171 candidate와 정상 release `114cf13556fc9c52657ccaf6c8461d11a99bbde848ca9b97f7dafb5174faecfb`를
기준으로 SSH 읽기 전용 대조를 수행했다. 현재 Web/Console/DB ID·시작 시각·이미지와 닫힌 Caddy 설정이
배포 후 증거와 일치하고, 네 health/readiness와 preview 세 경로는200, Console HTTP/HTTPS는403이다.
인증서와 이전 보호 경로 metadata도 유지됐다. sudo·DB 조회·VM 쓰기는 하지 않았다.

기존 창3은 이전 release/container에 묶여 있어 재사용하지 않는다. ignored
`.local/p06-c/https-auth-window4/`의 새 준비물은 현재 배포 candidate·컨테이너와 Caddy 상태를 고정한다.
회사 브라우저에는 전용 헤더 없이 Cloudflare TCP peer를 거친 HTTPS 접근을 최대30분 허용하고,
진단 token은 CSRF 경로의 임시 IP 관찰 헤더에만 사용한다. 기존 MFA 로그인·IP 제한·등록false를 유지한다.
검증 종료/실패/만료 때 먼저 접근을 닫은 뒤 원래 HTTP env/materializer와 동일 digest/configHash를 복구한다.
보호 백업·deployment lock·단일 실행/원복 경계를 유지하며 www 전환/F 공개 완료를 뜻하지 않는다.

Python/내장 Python·Node·Bash 문법, 실제 Caddy2.6.2 adapt, archive 일반 파일11개/내부 hash 연결을 확인했다.
전환/백업/복구 등의 기존 controller20함수 AST와 materializer/SQL/닫힌 Caddy/전달 설정4파일 byte를 보존했다.
새 baseline은 과거 배포 링크를 현재 값으로 억지 대조하지 않고 #171 candidate와 현재/직전 보호 snapshot을 검사한다.
archive SHA256은 `47cecf83e8d746dd841b8dd90234806961b7e9f7cabc4511a39312970bae3170`,
설치 launcher는 `36131e0a3f82afc0693e6a50f18b2bf97b27b99c401db56e53a4b0220375c8cc`다.
정적 준비이며 실제 runtime/인증 성공 증거가 아니다. 이전 실행물·백업·marker를 수정하지 않았다.

사용자가 제공한 `Protect Admin Path`의 `(http.request.uri.path contains "/admin")`는
관리 API에도 적용된다. 실제 GET `/admin-login`과 `/api/admin/albums`가 CF challenge403,
`/api/auth/csrf`가 Caddy403/no-store인 것을 확인했다. 다른 호스트의 기존 보호는 유지하고 Console만
로그인 화면의 HTML GET에 Managed Challenge를 적용하는 식을 사용자에게 전달했다.
표현식은 [Cloudflare 헤더 배열 문법](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/http.request.headers/)을 대조했다.
사용자가 보낸 재입력 식의 `eg`, `anv`, 배열 표기와 `text/ html` 오타를 바로잡았다.
브라우저/인증 앱 이용 가능은 확인됐지만 저장·배포 완료는 아직 미확인이다.

실제 실행 전에는 수정된 CF 경계와 최신 배포를 다시 대조한다. 인간 로그인·관리 조회·세션 쿠키 속성/호스트 분리·
로그아웃은 회사 브라우저의 확인 결과로 기록하고 자동 ingress 증거와 구분한다.
D의 운영 CLI reset/재등록·복구, E의 host 차단과 Promotion은 후속 단계이며 F는 보류한다.
근거는 ignored 창4의 `vm-preflight.json`, `edge-before-window.json`, `bundle-proof.json`과 보호 실행물이다.


## 2026-10-21 창4 설치·개방과 실제 ingress 검증

사용자가 교정한 CF 식 저장·배포 완료와 회사 브라우저/인증 앱 입력 가능을 확인했다.
실제 HTML 로그인 GET은 CF challenge403, 관리 API·JSON 로그인 GET·CSRF GET은
Caddy403/no-store까지 도달해 변경된 경계를 확인했다. 현재 닫힌 배포와 새 경로 부재를 재대조한 뒤
위 고정 archive/launcher와 보호 입력을 신규 staging0700/파일0600으로 전달하고 해시를 검사했다.
기존 sudo 위임에 따라 숨김 TTY 입력 경로로 root 설치·READ ONLY eligibility와 start를 각각 한 번 실행했다.
설치 exit0, start exit0·opened marker·unit active를 확인했다. 11:37 KST 개방, 최대30분 후 자동 원복이다.

실제 Cloudflare→Caddy→Console HTTPS에서 다음13항목을 통과했다.

- 두 CSRF 토큰 비공유·no-store/HIT 부재, 유효한 동일 실제 전달 IP
- 누락/위조 Origin 거절, 클라이언트 CF-Connecting-IP의 Edge403/error1000
- X-Forwarded-Host/Proto/For·X-Console-Client-IP·Forwarded 각각과 조합의 덮어쓰기
- 진단 token 없는 일반 브라우저 요청 허용·진단 IP 헤더 부재, 익명 관리 API의 인증 거절

별도 HTTPS 응답에서 CSRF/callback 쿠키의 Secure·HttpOnly·Lax·Domain 속성 부재·Path=/를 확인했다.
첫 Python 기본 User-Agent 요청은403이었고, 브라우저 User-Agent 요청은200이었다.
이 관찰만으로 그403의 WAF 규칙을 특정하지 않으며, 자동 ingress의 일반 무헤더 요청도200을 확인했다.
실제 세션 쿠키의 검증이나 인간 로그인 성공으로 확대하지 않는다. Cookie 값·IP 원문·인증 입력은 저장하지 않았다.

근거는 창4의 `edge-after-rule.json`, `transfer-proof.json`, `root-install-execution.json`,
`root-start-execution.json`, `ingress-proof.json`, `anonymous-cookie-proof.json`이다.
현재 인간 브라우저 검증과 종료/원복 증거는 아직 미완료이며 아래 후속 기록이 있을 때만 상태를 갱신한다.
D/E 보안 패치 통합은 기존 PR #167/#168/#169에서 진행하며 별도 배포나 F 전환을 수행하지 않았다.
