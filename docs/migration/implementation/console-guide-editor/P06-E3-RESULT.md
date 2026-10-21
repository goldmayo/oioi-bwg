---
title: "P06-E3 Web 인증 제거 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: 1ae99bb
created_at: "2026-10-21"
---

# P06-E3 결과

사용자가 공개 Web의 인증 기능을 제거하고 회원 기능은 나중에 추가하도록 확정했다.
[P06 범위 개정](P06-PLAN.md#2026-10-21-web-인증-종료-개정), 헌법 §5, Auth §4.0,
Domain AUTH-001을 같은 변경 단위로 반영한다. 기준은 fetch한 `origin/migration_main`의 `1ae99bb`다.
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
- Console standalone smoke 결과는 마지막 검사 후 기록한다. Console 소스·공통 서버/package·DB schema diff는 없다.
- 전체 관리자 E2E·운영 DB/VM 검증은 실행하지 않았다. `git diff --check` 성공.

로컬 로그·화면은 이 worktree의 `.local/p06-e3/`에 보관한다. `web-public-home.png`와
`web-login-removed.png`는 공개 조회 및 제거된 로그인 경로의 실제 브라우저 화면이다.

## 운영 적용

이번 변경의 host guard 설치·`deploy.conf`의 `SMOKE_PATHS` 갱신·새 정상 Promotion은 미실행이다.
[운영 절차](../../../../ops/oci/web-retirement.md)에 따라 이전/새 pair의 공개 조회·인증 거절을 확인해야 한다.
기존 E2/#189의 배포 성공을 E3 적용 성공으로 해석하지 않는다. 따라서 E 전체는 운영 적용 전까지 미완료다.
