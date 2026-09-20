---
title: "Sentry release·source map 연결 결과"
document_id: "OBSERVABILITY-SENTRY-SOURCEMAPS-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-09-20"
depends_on:
  - "OBSERVABILITY-AUDIT"
  - "OBSERVABILITY-CLIENT-SENTRY-RESULT"
related:
  - "09"
  - "11"
  - "12"
tags:
  - "observability"
  - "sentry"
  - "source-maps"
  - "release"
---

# Sentry release·source map 연결 결과

## 1. 범위와 식별자 결정

이번 변경은 OCI staging image를 만드는 production Next.js build에서 Sentry release를 주입하고 client와
server source map을 Sentry에 비공개 업로드하는 경계만 다룬다. tracing, Replay, application logger,
server error classification은 포함하지 않는다.

두 release 개념의 책임을 다음처럼 분리했다.

```text
Sentry build release = oioi-bwg@<GitHub full commit SHA>
OCI deployment release identity = <private OCIR repository>@sha256:<manifest digest>
```

source map 업로드는 image manifest digest가 생성되기 전 build 내부에서 실행되므로 digest를 Sentry release
이름으로 사용할 수 없다. 대신 기존 `git-<full-sha>` OCIR traceability tag와
`org.opencontainers.image.revision=<full-sha>` label이 Sentry release와 image digest를 연결한다. OCI의
배포·rollback identity가 manifest digest라는 기존 계약은 변경하지 않았다.

- 구현 commit: `88f5be408374a8e9f56873dc27572852a1d50aea`
- PR: [#94](https://github.com/goldmayo/oioi-bwg/pull/94)

## 2. Build와 secret 경계

일반 local/PR `pnpm build`는 source map upload를 실행하지 않는다. `SENTRY_SOURCE_MAPS_ENABLED=true`를
명시한 OCI image publish build만 다음 네 값을 필수로 검증한다.

- `SENTRY_ORG`: GitHub environment variable
- `SENTRY_PROJECT`: GitHub environment variable
- `SENTRY_RELEASE`: workflow가 `oioi-bwg@<github.sha>`로 생성하는 build argument
- `SENTRY_AUTH_TOKEN`: GitHub environment secret → Docker BuildKit secret

token은 Docker build argument나 `ENV`, OCI runtime env, image layer에 넣지 않는다. BuildKit secret mount의
`/run/secrets/SENTRY_AUTH_TOKEN`을 `pnpm build` process에만 전달한다. source map 업로드나 release 생성이
실패하면 별도 `errorHandler`로 무시하지 않고 image build를 실패시킨다.

`withSentryConfig`는 활성화된 publish build에서만 적용한다. Sentry SDK 10.42.0과 Next 16.3.3의
Turbopack `runAfterProductionCompile` 경로가 build 완료 후 debug ID를 주입하고 artifact를 업로드한다.
route manifest injection과 Sentry build plugin telemetry는 이번 error-only 범위에서 비활성화했다.

업로드 후 `.next/**/*.map`을 삭제하도록 지정한다. 따라서 client source map을 public static asset으로
배포하지 않고 server source map도 standalone runtime image에 복사하지 않는다.

## 3. Event privacy와 source map 해석

기존 client/server `beforeSend`는 event를 allowlist 객체로 다시 만들기 때문에 SDK가 추가한 `release`와
`debug_meta`도 제거했다. 이번 변경은 다음 고정 형식만 보존한다.

- release: `oioi-bwg@`와 40자리 lowercase Git SHA
- debug image type: `sourcemap`
- debug ID: canonical UUID 형식
- code file: host/query/hash/container root를 제거한 `/_next/` 또는 `.next/` 상대 경로

stack frame의 `abs_path`도 같은 build 경로로 정규화해 debug image `code_file`과 대응시킨다. `dist`는
현재 build에서 사용하지 않고 자유형 값이 될 수 있으므로 보존하지 않는다. user/request/body/header,
cause/extras, source context와 local variable은 계속 제거한다.

## 4. 변경 파일

- `next.config.ts`: 명시적으로 활성화된 publish build에 `withSentryConfig` 적용
- `src/shared/config/sentry-build.ts`: build-only 활성화, 필수 설정, release 형식 검증
- `src/shared/lib/sentry-build-metadata.ts`: release/debug metadata privacy allowlist
- client/server sanitizer와 테스트: safe metadata 및 matching `abs_path` 보존
- `Dockerfile`: BuildKit secret으로 upload token을 build process에만 전달
- `.github/workflows/verify.yml`: GitHub variable/secret 검증과 SHA release 주입
- `tests/ops/deploy-via-run-command.test.ts`: token이 build arg/ENV가 아닌지와 correlation 설정 검증

## 5. 수동 설정과 실제 검증

머지 전에 GitHub의 `oci-development-image` environment에 다음 값을 등록해야 한다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Variable | `SENTRY_ORG` | Sentry organization slug |
| Variable | `SENTRY_PROJECT` | 대상 Sentry project slug |
| Secret | `SENTRY_AUTH_TOKEN` | source map 전용 Sentry Organization Token |

Organization Token은 CI source map 업로드와 release 생성에 필요한 `org:ci` scope만 사용한다. token을
repository variable, `.env`, Docker build argument, OCI Vault/runtime env에 복제하지 않는다.

설정 후 `migration_develop` image publish에서 다음을 확인한다.

1. build log에서 Sentry release 생성과 source map upload 성공을 확인한다. token 원문은 출력하지 않는다.
2. Sentry **Project Settings → Source Maps**에서 새 debug artifact를 확인한다.
3. Release 목록에서 `oioi-bwg@<merge commit SHA>`를 확인한다.
4. 새 image가 staging에 배포된 뒤 이전 issue와 다른 privacy-safe client 오류를 발생시킨다.
5. 새 event가 같은 release를 가지며 stack frame이 원본 TypeScript/TSX 파일과 line/column으로 해석되는지
   확인한다. 이미 수집된 과거 event는 source map을 나중에 올려도 다시 처리되지 않으므로 새 event를 쓴다.
6. event JSON에 user/request/cause/extras가 없고 release/debug metadata만 새로 보존됐는지 확인한다.

실제 Sentry token, GitHub environment 설정, artifact upload 및 deminified event 결과는 외부 계정 상태라
현재 코드베이스에서 확인할 수 없다. PR 검증과 merge 뒤 위 절차로 확인해야 한다.

## 6. 근거

- [Sentry CI scope](https://docs.sentry.io/api/permissions/): `org:ci`는 source map upload와 release 생성용
- [Sentry release API](https://docs.sentry.io/api/releases/create-a-new-release-for-an-organization/):
  release는 source map과 debug 기능의 연결 단위
- [Sentry source map troubleshooting](https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/troubleshooting_js):
  debug ID/debug metadata 확인과 artifact 선업로드 요구
- 설치된 `@sentry/nextjs` 10.42.0 type/source: Turbopack production compile hook, release injection,
  source map upload 및 삭제 옵션

## 7. 검증

- `pnpm verify`: 성공
  - architecture harness 8개
  - unit test 55 files / 233 tests
  - ops test 3 files / 21 tests
- `pnpm format:check`: 성공
- `pnpm build`: source map upload가 비활성화된 일반 Next.js 16.3.3 Turbopack build 성공, static page
  22개 생성
- 가짜 token/org/project와 형식에 맞는 release로 `next.config.ts`를 로드해 Sentry build config와
  `_sentryRelease` injection이 구성되는 것 확인. 외부 업로드는 실행하지 않음
- `git diff --check`: 성공
- GitHub Verify #249: infra, quality, unit, PostgreSQL integration, build, aggregate verify 성공. PR에서는
  image publish/deploy가 의도대로 실행되지 않음

현재 WSL 환경에는 Docker CLI가 없어 변경한 Dockerfile의 실제 BuildKit build는 실행하지 못했다.
Dockerfile/workflow 경계는 ops test와 정적 검토로 확인했으며 실제 BuildKit secret mount, Sentry artifact
upload, staging deminification은 5절의 GitHub image publish에서 확인해야 한다.
