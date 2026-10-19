---
title: "P06-C Console HTTPS 및 인증 요청 보안 경계 구현 결과"
kind: migration-result
status: in-progress
source_commit: 64dca4c23233b07f2136d89b5bd2d363e6bef47c
verified_at: "2026-10-20"
updated_at: "2026-10-20"
revision: 12
---

# P06-C 구현 결과

**코드 병합·로컬 HTTP/HTTPS·Docker PostgreSQL·ARM64 후보 검증·HTTP 공동 VM 배포·DNS 전 HTTP 차단·사용자 Cloudflare DNS/cache 변경과 공개 HTTP 도달 확인 완료 / 인증서 단계 exit20·HTTP403 복구 완료 / HTTP-01의403 원인 추가 확인·실제 제한 HTTPS 검증 대기. C 전체 완료가 아니다.**
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

## 남은 완료 게이트와 운영 승인 범위

- 초기 Docker 연결 부재는 사용자의 연결 후 해소했다. 로컬 HTTP/HTTPS·격리 DB 전체 회귀와 위 CI의 두 이미지 검증이 통과했다. 이후 테스트/문서 커밋의 CI는 같은 PR에서 별도로 확인한다.
- 초기 공개 조회에서 Console DNS는 해석되지 않았고 preview Cloudflare 경로는 challenge 403, VM preview 원본 TLS는 정상이었다. 이후 사용자 DNS/cache 변경과 실제 공개 DNS·HTTP403/DYNAMIC을 위에 구분했다. Console origin 인증서·실제 인증 응답 캐시 제외는 여전히 미검증이다.
- DNS 전 직접 origin HTTP 차단/TLS 거절을 완료했다. 실제 VM의 제한 HTTPS 브라우저 검증, 실제 Cloudflare client IP 두 개의 독립 제한, 제한 HTTPS에서의 직접 origin/위조 헤더 차단과 CDN 캐시 제외는 **미검증**이다. 로컬 모사 peer 성공으로 대체하지 않는다.
- 1차 보호 백업·HTTP 공동 배포와 새 정상 pair 기준 DNS 전 보호 백업/HTTP 차단을 완료했다. 인증서 단계는 새 보호 백업과 한 번 HTTP403 복구(exit20)를 완료했다. 실패의 응답 출처 확인과 새 승인 전 발급을 재시도하지 않는다. 이후 HTTPS 창도 그 시점의 닫힌 Caddy/pair를 보존할 새 보호 경로·실행/복구 명령으로 별도 승인받는다. 기존 백업은 덮어쓰지 않는다. ACME 실패 시 현재 HTTP 전용 차단으로 복구·중단하며 Full(strict) 해제·DNS-only 전환·발급 무한 재시도는 하지 않는다.
- loopback/SSH TLS 검증과 실제 Cloudflare→Caddy 경로 검증을 구분한다. 공개 403을 유지한 제한 matcher·origin 인증서·실행/복구 명령은 별도 승인 전 미적용이다. DNS 추가만으로 제한 완료라 하지 않는다.
- #163/#165 병합·#164 HTTP 공동 배포와 HTTP 전용 차단 validate/reload만 완료했다. 후속 host asset 설치·HTTPS Origin 전환·Console ACME 조각은 한 번 적용했으나 검증403으로 HTTP403 조각에 복구했다. 제한 HTTPS Caddy/인증서 확보는 완료하지 않았다. DNS/cache 두 항목만 사용자가 완료했고 에이전트 Cloudflare 변경은 없다. 정확한 보호 파일 경로·실행 후보·복구 명령과 함께 각각 별도 승인받는다.

위 게이트를 통과하기 전에는 C를 완료로 바꾸지 않는다. D 실물 MFA·CLI/키 복구, E Web 관리/가입 종료, F 공개/www 전환은 기존 단계에 남긴다.
