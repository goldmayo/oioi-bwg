---
title: "P06-E3 Web 인증 제거 결과"
kind: migration-result
status: complete
authority: evidence
source_commit: 1ae99bb
created_at: "2026-10-21"
updated_at: "2026-10-22"
---

# P06-E3 결과

사용자가 공개 Web의 인증 기능을 제거하고 회원 기능은 나중에 추가하도록 확정했다.
[P06 범위 개정](P06-PLAN.md#2026-10-21-web-인증-종료-개정), 헌법 §5, Auth §4.0,
Domain AUTH-001을 같은 변경 단위로 반영한다. 기준은 fetch한 `origin/migration_main`의 `1ae99bb`다.
구현·검증 코드 commit은 `70b17910e8a5f49bfaf43200555de234145c845e`다.
로컬 `migration_main`은 `5135f6e`여서 사용하지 않았다. 독립 `feature/p06-web-public-only`에서 작업했다.

## 변경

- Web `/login`, Auth.js handler/proxy·세션/권한 API, 계정 request context, 인증 reporter/type과
  Web `next-auth` 의존성을 제거한다. 공개 콘텐츠와 가입 POST의 부작용 없는 403은 유지한다.
- host guard는 `/login`·`/api/auth` 전체를 거절하고 callback/signout 쓰기 예외를 제거한다.
  새 앱은 인증 키 없이 실행하며 과거 Web/Console 쿠키를 identity로 사용하지 않는다.
- 기존 standalone/proxy 검사를 인증 거절과 공개 조회 기준으로 전환한다. 선택적 관리자 smoke도
  과거 유효 JWT 거절로 갱신하며 자동 CI에 전체 관리자 E2E를 추가하지 않는다.
- 배포 smoke 경로 예시는 `/ /more`로 바꾼다. 이전 이미지 복구를 위한 host secret mapping과
  runtime env 필수 키는 유지하며 새 Web 앱에서는 사용하지 않는다. Console·공통 서버·DB는 변경하지 않는다.

로그인 route와 유일 consumer인 인증 연결을 함께 제거하고, CI/복구 계약을 같은 상태로 검증해야 하므로
20파일/400줄 목표를 넘는다. 삭제가 대부분이며 별도 계정 관리나 의존성 업그레이드는 포함하지 않는다.
리뷰 순서는 상위 정책 → Web 인증 삭제 → host 차단 → smoke/배포 절차다.

## 검증

- `pnpm install --frozen-lockfile`: 성공. Web importer의 `next-auth`만 lockfile에서 제거했다.
- `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(410건), `pnpm format:check`: 성공.
- `pnpm test:ops`: 246건 성공, 기존 `jq`가 PATH에 없어 transport 16건 실패.
  기존 `.local/p06-c/bin`을 PATH에 추가해 `pnpm exec vitest run --config vitest.ops.config.ts
tests/ops/paired-run-command.test.ts` 24건을 재실행해 모두 성공했다. 전체 262건의 검증 범위를 충족했다.
- `pnpm build`: 최초에는 병렬 harness가 만든 일시적 ESLint 회귀 파일을 Console TypeScript가 읽어 실패했다.
  harness 종료 후 같은 명령을 독립 재실행해 두 앱 성공(Web 성공 캐시, Console 재빌드).
  build 결과 Web route 목록에 로그인/Auth.js/권한 route와 auth proxy가 없다.
- 인증 키 없는 Web standalone에서 `node tests/ops/web-standalone-smoke.mjs http://127.0.0.1:3217` 성공.
  익명/쿠키 동반 요청의 로그인·인증 GET/POST 404, 인증 쿠키 미발급, 공개 UI·JS/CSS·자산·브라우저 오류 부재를 확인했다.
- 기존 Compose PostgreSQL의 로컬 복원 데이터를 **조회만** 했다. 홈/응원법/앨범/곡 페이지와 DTO API,
  readiness의 200과 인증 쿠키 미발급을 실제 요청으로 확인했다. seed·migration·dump 복원은 하지 않았다.
- 추가 실제 요청에서 유효한 과거 형식 Web JWT에도 인증 route 404·쿠키 미발급을 확인했다.
  실제 이전 upload Action ID를 `/`·`/login`·`/admin/albums`에 보내 409와 명시적 거절 header/body를 확인했다.
- `node tests/ops/web-retirement-proxy-smoke.mjs`: 로컬 Caddy 2.10.2의 인증/관리/가입/Action 거부,
  encoded path/HEAD/OPTIONS 거부와 이전 upstream 도달 0, 공개 GET/HEAD 통과 성공.
- `node tests/ops/console-standalone-smoke.mjs http://127.0.0.1:3218`: 전용 host-only 쿠키,
  로그인 redirect·hydration·OTP 입력/오류 UX 성공. 실제 관리자 로그인·CRUD를 실행한 검사는 아니다.
  Console 소스·공통 서버/package·DB schema diff는 없다.
- 전체 관리자 E2E·운영 DB/VM 검증은 실행하지 않았다. `git diff --check` 성공.

로컬 로그·화면은 이 worktree의 `.local/p06-e3/`에 보관한다. `web-public-home.png`와
`web-login-removed.png`는 공개 조회 및 제거된 로그인 경로의 실제 브라우저 화면이다.
`console-login-preserved.png`는 기존 Console OTP 입력 화면이다.

## PR #191 CI 보정

최초 [Verify #474](https://github.com/goldmayo/oioi-bwg/actions/runs/39616570442)의
두 앱 빌드·quality·unit/ops·PostgreSQL·infra는 성공했지만 `build` job의 Web native smoke가
`Expected one traced Argon2 package`로 실패했다. Web 인증 제거로 standalone tracing에서
Argon2가 빠진 것이 정상인데 공통 smoke가 여전히 두 앱에 Argon2를 필수로 요구했다.
로컬 standalone HTTP 검사만으로는 이 컨테이너 전용 조건을 확인하지 못했다.

- `tests/ops/container-native-smoke.mjs`의 Argon2 필수 로드·hash/verify는 Console에만 적용한다.
  두 앱의 Sharp 버전·실제 이미지 변환 검사는 유지하고 native 실패 원인을 로그에 남긴다.
  같은 스크립트를 사용하는 Verify와 Promotion candidate smoke에 함께 적용된다.
- 실패 run의 `ci-web-image`, `ci-console-image`를 내려받고 GitHub artifact SHA-256과 일치함을 확인했다.
  동일 Web 이미지에서 변경 전 스크립트의 Argon2 오류를 재현하고 변경 후 native smoke 성공을 확인했다.
  동일 Console 이미지도 Argon2를 포함한 native smoke에 성공했다.
- 두 CI 이미지를 실제 실행해 `container-readiness-smoke`와 각 `web/console-standalone-smoke`도 성공했다.
  Web에는 인증 키를 전달하지 않았다. 기존 로컬 Compose PostgreSQL만 사용했다.
  첫 host network 시도는 WSL에서 접근되지 않아 종료하고 localhost 포트 공개 방식으로 재실행했다.
  검사용 두 컨테이너는 종료·제거했다.
- `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(410건, 기존 성공 캐시), `pnpm test:ops`(262건), `pnpm format:check` 성공.
  문법·단일 파일 ESLint/Prettier 검사도 성공했다. 로컬 로그는 `.local/p06-e3/p191-*`에 보관한다.

## 초기 운영 적용 대기 기록

아래는 #191 구현 완료 당시 상태이며, 이후 실행은 다음 절을 따른다.

이번 변경의 host guard 설치·`deploy.conf`의 `SMOKE_PATHS` 갱신·새 정상 Promotion은 미실행이다.
[운영 절차](../../../../ops/oci/web-retirement.md)에 따라 이전/새 pair의 공개 조회·인증 거절을 확인해야 한다.
기존 E2/#189의 배포 성공을 E3 적용 성공으로 해석하지 않는다. 따라서 E 전체는 운영 적용 전까지 미완료다.


## 2026-10-22 호스트 인증 차단과 정상 Promotion

사용자의 병합·배포 승인에 따라 실행했다. 아래 시각은 KST이며, 최초 구현 및 검증 이력은 보존한다.

- [#191](https://github.com/goldmayo/oioi-bwg/pull/191)의 CI 보정 commit은 `0ae8ec3badeaebcfddc8a17137d0a6cbf66ce5f0`다.
  [Verify #475](https://github.com/goldmayo/oioi-bwg/actions/runs/39619857537) 전체 성공 후
  `42448365987f6c27cdee1abeac2d42cc9da875d0`으로 squash 병합했다.
- 이전 Promotion과의 이력 충돌은 파일 변경 0개인 [#192](https://github.com/goldmayo/oioi-bwg/pull/192)로 연결했다.
  [Verify #476](https://github.com/goldmayo/oioi-bwg/actions/runs/39621950628) 성공 후, 사용자가 승인한
  이번 PR 한정 일반 merge로 `070a805b78b4f134c32778f9e045cc4b62fbc90a`를 만들었다.
  첫 시도는 병합 전 대조에서 중단해 설정을 복원했다. 두 번째 시도에서 병합했고 저장소와
  `migration_main` ruleset을 즉시 원래 squash-only로 복원·재조회했다. 파일 tree는 바뀌지 않았다.
- 사용자가 WSL의 `apply-host.py apply`를 실행해 00:32:55에 host 선행 적용을 마쳤다.
  첫 실행은 exit 1·결과 없음으로 중단했고 guard 미변경을 확인했다. 원인을 비밀번호 오류로 단정하지 않는다.
  진단을 보완한 재시도는 exit 0·`diagnostic: success`였다. sudo 비밀번호는 저장하거나 로그에 남기지 않았다.
- `/etc/caddy/web-retirement.caddy`의 SHA-256은
  `8bb9e186d837dd972f03f6847de3de8179b53f2edab6b39f6a1609ef47ddf675`다.
  보호된 `deploy.conf`의 `SMOKE_PATHS`를 `/ /more`로 바꾸고 실제 Caddy 2.6.2에서 전체 설정 검증 후 reload했다.
  root 보호 백업은 `/var/lib/oioi-p06-e3-20261021/`이며 main Caddyfile·Console 활성 설정은 보존했다.
- 당시 정상 #189 pair에서 로그인/인증/관리/가입/Action 차단 55건, 공개 조회 200,
  Console origin 제한 403·직접 health 200, HTTP→HTTPS 308을 확인했다.
  두 앱·DB container 보존을 확인했고 SSH 읽기에서도 같은 결과를 독립 대조했다.
  이 guard는 image/env rollback 밖에 있으므로 이전 pair에도 인증 차단을 유지한다.
- 정상 Promotion [#193](https://github.com/goldmayo/oioi-bwg/pull/193)의 source는
  `070a805b78b4f134c32778f9e045cc4b62fbc90a`, 실제 squash는
  `12013d072040113a907bc8746a8c1f35bdfd4232`다.
  source·검증 merge·실제 squash tree가 모두 `c2ada33fef0d0c57f699aad047f94bd68e193770`으로 같다.
- [Verify #477](https://github.com/goldmayo/oioi-bwg/actions/runs/39626254586) attempt 1의
  정적·unit/ops·PostgreSQL·app/container build 및 두 exact ARM64 image의 동시 native/readiness/browser smoke가 성공했다.
  candidate artifact `12357911832`의 SHA-256, 현재 head/tree/run/attempt와 이전 #189의 immutable 성공 receipt를 대조했다.
  전체 관리자 E2E를 자동 CI에 다시 넣거나 실행하지 않았다.
- 두 이미지는 위 source에서 새로 build됐다. 검증한 Web digest는
  `sha256:fce25cd6afacc749afb99eb14b2b6d26df7917bbaf23fa48e239248e9ace7594`, Console digest는
  `sha256:674cd273030c29213574117bcbf446dd3c67bcfbaeede9c18944fd766a8f0c97`다.
  release ID는 `e1fce907b69f9caf847f55e2242dd796b57d22e9912d80b2f9f5fd2605f21071`이다.


## 2026-10-22 배포 완료와 실제 서비스 검증

- [Deploy #10](https://github.com/goldmayo/oioi-bwg/actions/runs/39627995228) attempt 1이
  OCI Run Command exit 0으로 성공했고, immutable receipt artifact `12356894974`가 발행됐다.
  00:47:50 KST에 receipt의 source/tree·squash SHA·candidate artifact·두 digest·release ID를
  GitHub 원본과 대조했다. 후보를 다시 build하거나 SSH로 앱 배포를 우회하지 않았다.
- 실제 Web/Console은 00:46:42 KST에 위 후보 digest로 교체됐고 OCI revision도 build source와 같다.
  두 앱의 loopback 포트·healthy·health/readiness 200을 확인했다.
  DB container ID·시작 시각·image는 적용 전과 같았다. 운영 DB에 직접 연결하지 않았고
  migration·dump 복원·계정/비밀번호·MFA key/version 변경은 하지 않았다.
- 새 Web 직접 origin의 로그인·인증·관리 GET/POST는 404, 실제 Caddy TLS 경유는 403이었다.
  익명 및 과거 Web/Console 이름의 쿠키를 동반한 총 88건에서 인증 쿠키 미발급을 확인했다.
  이 VM 검사는 임의 과거 형식 쿠키이며 유효 서명 JWT 검사는 앞선 로컬 검증의 증거와 구분한다.
  가입 API 세 개의 malformed POST는 직접 origin에서도 403이었다.
- 실제 이전 upload Action ID를 `/`·`/login`·`/admin/albums`에 보낸 multipart 요청은
  직접 origin에서 409·`x-nextjs-action-not-found: 1`·정확한 `Server Action unavailable.` 본문,
  host에서 403으로 거절됐다. 공개 `/`·`/more`·health/readiness는 직접/host 모두 200이었다.
  host guard hash는 배포 전과 같았다.
- Console HTTPS origin·등록 false를 유지했다. Console origin TLS 직접 접근의 403은 기존
  Cloudflare 경유 제한 결과이며, 외부 Console `/admin-login`은 200이었다.
  00:48:17 KST 외부 preview `/`·`/more`는 200, `/login`·`/api/auth/session`은 challenge 없는
  403이었다. 이 다섯 요청에서 인증 세션 쿠키는 발급되지 않았다.
- 이번 배포 후 실물 관리자 로그인·CRUD·MFA 등록/회수는 다시 실행하지 않았다.
  그 실증은 [D 결과](P06-D1-RESULT.md#2026-10-21-실물-mfa-회수재등록과-https-설정-복원)의
  사용자 확인을 유지하며, 현재 이미지의 로그인 UI·인증 native 검증은 이번 candidate smoke가 소유한다.

**E 완료:** 공개 preview Web은 회원가입·로그인 없는 조회 전용이며 인증·관리는 Console에 남는다.
현재 pair는 #193, 새 guard로 인증 차단을 검증한 이전 pair는 #189다. 고의 장애를 통한 공동 rollback을
이번에 다시 실행하지 않았으며 기존 B의 복구 검증과 구분한다. F의 www 전환·레거시 종료와 G 계정 관리는 보류다.
최종 hostname의 인증 세션 cookie 속성/preview 격리 중 미관찰 항목도 F에서 확인한다.

로컬 실행 증거는 이 worktree의 ignored `.local/p06-e3-deploy/`에 둔다.
`candidate-verified.json`, `deployment-verified.json`, `live-verified.json`, `external-verified.json`과
host 적용/재대조·merge 설정 복원 기록이 위 결과를 뒷받침한다. 비밀 값과 원격 command ID 원문은 이 문서에 싣지 않는다.
