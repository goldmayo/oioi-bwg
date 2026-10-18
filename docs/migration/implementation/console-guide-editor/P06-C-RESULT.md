---
title: "P06-C Console HTTPS 및 인증 요청 보안 경계 구현 결과"
kind: migration-result
status: in-progress
source_commit: 9475415caef65f4a1d930d600c704c9960eedb70
verified_at: "2026-10-19"
updated_at: "2026-10-19"
revision: 4
---

# P06-C 구현 결과

**코드·로컬 HTTP/HTTPS·Docker PostgreSQL 및 CI 검증 완료 / 실제 VM·Cloudflare HTTPS 검증 대기. C 전체 완료가 아니다.**
기준은 `goldmayo/oioi-bwg`의 `migration_main` `655b593d61ec937e9a3cc4b5fee927f11f431647`(#162),
구현 브랜치는 `feature/p06-c-console-https`다. 구현 `6ed4ece`, 추가 Action 검증 `3822d13`, 배포 호스트 보완 `16c317d`, 로컬 HTTPS/DB 검증 확장은 metadata의 커밋이다.
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
Console 호스트의 Worker route·Pseudo IPv4·IP 제거 transform 여부는 실제 적용 전에 확인해야 한다.

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

## 남은 완료 게이트와 운영 승인 범위

- 초기 Docker 연결 부재는 사용자의 연결 후 해소했다. 로컬 HTTP/HTTPS·격리 DB 전체 회귀와 위 CI의 두 이미지 검증이 통과했다. 이후 테스트/문서 커밋의 CI는 같은 PR에서 별도로 확인한다.
- Console DNS는 조회 시 해석되지 않았다. preview의 공개 Cloudflare 경로는 challenge 403, VM의 preview 원본 TLS는 정상이다. 기존 인증서는 Let's Encrypt이며 console 인증서·Cloudflare 캐시 bypass 설정은 미확인이다.
- 실제 VM의 비공개 HTTPS 브라우저 검증, 실제 Cloudflare client IP 두 개의 독립 제한, 직접 원본 접근 거절과 CDN 캐시 제외는 **미검증**이다. 로컬 모사 peer 성공으로 대체하지 않는다.
- 운영 적용 전 보호된 원본 Caddyfile·host materializer·Console public/runtime env·정상 pair/snapshot을 root-only 백업하고 복구 경로를 확정해야 한다. Caddy 조각은 기존 preview block을 보존해 합친 후 validate한다. 실패 시 원본 Caddyfile 복원→validate→reload, 기존 승인된 pair/env 복구→두 앱 네 health/readiness와 preview 원본 200 대조 순서다.
- 제한 HTTPS 검증은 loopback listener와 SSH 전달을 우선 검토하며 공용 403을 유지한다. 기존 인증서 확장 또는 제한 listener의 인증서 방식을 실제 설정과 함께 확정하고 별도 승인받는다. DNS 추가만으로 제한 완료라 하지 않는다.
- PR 병합, host asset 설치, runtime Origin 전환, Promotion/배포, Caddy reload, DNS/Cloudflare 변경은 아직 실행하지 않았다. 사용자 요청 §8에 따른 별도 운영 승인 대상이다. 실행 후보·정확한 보호 파일 경로와 복구 명령을 확정한 다음 승인받는다.

위 게이트를 통과하기 전에는 C를 완료로 바꾸지 않는다. D 실물 MFA·CLI/키 복구, E Web 관리/가입 종료, F 공개/www 전환은 기존 단계에 남긴다.
