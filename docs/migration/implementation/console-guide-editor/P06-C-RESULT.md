---
title: "P06-C Console HTTPS 및 인증 요청 보안 경계 구현 결과"
kind: migration-result
status: in-progress
source_commit: 64dca4c23233b07f2136d89b5bd2d363e6bef47c
verified_at: "2026-10-19"
updated_at: "2026-10-19"
revision: 8
---

# P06-C 구현 결과

**코드 병합·로컬 HTTP/HTTPS·Docker PostgreSQL·ARM64 후보 검증과 기존 HTTP 설정의 공동 VM 배포 완료 / 실제 VM·Cloudflare HTTPS 검증 대기. C 전체 완료가 아니다.**
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
실제 Cloudflare→Caddy 인증 성공 증거로 해석하지 않는다. **Cloudflare 설정 변경은 아직 없다.**

| 항목 | 사용자 확인 상태 |
| --- | --- |
| Console DNS | `console.oioibawige.com` 레코드 없음 |
| SSL/TLS·Edge | Full (strict), `*.oioibawige.com` Edge 인증서 활성 |
| Worker Custom Domain | 기존 apex·www만 연결 |
| Rules | Origin Rules·Redirect/Rewrite Rules·Request Header Transform Rules 없음 |
| Managed Transforms | 모두 비활성, 방문자 IP 헤더 제거도 비활성 |
| Cache Rule | `console-bypass-cache` 생성됨. 조건 `http.host eq "console.oioibawige.com"`, Bypass cache, 현재 비활성 |

위 항목은 완료한 사전 점검으로 재사용한다. 남은 origin 인증서·서버 제한 경로와 최소 Cloudflare
변경 요청·승인 순서는 [사전 준비 §2](P06-PREPARATION.md#2-c의-제한된-cloudflare-https-검증-준비)가 소유한다.
DNS 생성·Cache Rule 활성화는 Console 외부 차단과 기존 preview 보호를 실제 확인한 뒤 별도 승인받는다.
#164 병합/VM 배포는 아래 별도 승인으로 실행했다. 서버 HTTPS 전환과 Cloudflare 변경은 여전히 별도 승인 대상이며 일반 공개는 F다.

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

## 남은 완료 게이트와 운영 승인 범위

- 초기 Docker 연결 부재는 사용자의 연결 후 해소했다. 로컬 HTTP/HTTPS·격리 DB 전체 회귀와 위 CI의 두 이미지 검증이 통과했다. 이후 테스트/문서 커밋의 CI는 같은 PR에서 별도로 확인한다.
- 초기 공개 조회에서 Console DNS는 해석되지 않았고 preview Cloudflare 경로는 challenge 403, VM preview 원본 TLS는 정상이었다. 이후 DNS/TLS/캐시 준비 상태는 위 사용자 확인으로 갱신했다. Console origin 인증서와 실제 캐시 제외 동작은 여전히 미검증이다.
- 실제 VM의 비공개 HTTPS 브라우저 검증, 실제 Cloudflare client IP 두 개의 독립 제한, 직접 원본 접근 거절과 CDN 캐시 제외는 **미검증**이다. 로컬 모사 peer 성공으로 대체하지 않는다.
- 1차 보호 백업과 기존 HTTP 공동 배포를 완료했다. 후속 HTTPS 검증 창은 새 정상 receipt/pair 기준의 보호 백업·실행/복구 명령을 확정해 별도 승인받는다. Caddy 조각은 기존 preview block을 보존해 합친 후 validate한다. 실패 시 원본 Caddyfile 복원→validate→reload, 기존 승인된 pair/env 복구→두 앱 네 health/readiness와 preview 원본 200 대조 순서다.
- loopback/SSH TLS 검증과 실제 Cloudflare→Caddy 경로 검증을 구분한다. 공개 403을 유지한 제한 matcher·origin 인증서·실행/복구 명령은 별도 승인 전 미적용이다. DNS 추가만으로 제한 완료라 하지 않는다.
- #163/#165의 코드·이력 병합, #164 후보 검증·승인된 HTTP Promotion/VM 배포를 완료했다. 후속 host asset 설치·HTTPS Origin 전환·Caddy reload·인증서/DNS/Cloudflare 변경은 실행하지 않았다. 정확한 보호 파일 경로·실행 후보·복구 명령과 함께 각각 별도 승인받는다.

위 게이트를 통과하기 전에는 C를 완료로 바꾸지 않는다. D 실물 MFA·CLI/키 복구, E Web 관리/가입 종료, F 공개/www 전환은 기존 단계에 남긴다.
