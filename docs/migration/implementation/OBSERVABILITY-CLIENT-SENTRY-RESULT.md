---
title: "Client Sentry 초기화·환경 정책·privacy 경계 개선 결과"
document_id: "OBSERVABILITY-CLIENT-SENTRY-RESULT"
version: "1.1"
status: "completed"
authority: "result"
updated_at: "2026-09-20"
depends_on:
  - "OBSERVABILITY-AUDIT"
---

# Client Sentry 초기화·환경 정책·privacy 경계 개선 결과

## 기준과 범위

- 조사 기준: [`OBSERVABILITY-AUDIT.md`](./OBSERVABILITY-AUDIT.md), commit
  `09ae7a122d49d970c11f4a303f50fbf4fb6f2e46`
- 승인된 계획: 사용자가 2026-09-20 대화에서 지정한 첫 번째 observability 개선 범위. 별도의 저장소
  PLAN 문서는 만들지 않았다.
- 구현:
  - `9cc20272cf70fa5c38aeb58b33467b9480bee3be`: client 초기화와 공통 환경 정책
  - `115369a1fd610aba54be3ba14be4690953ed73f1`: client privacy 경계
  - `b5c3a601b108c7e89c6869afb1520af02bed08de`: server JSON 오류 출력과 Sentry 활성화 정책 분리,
    image publish DSN gate
- PR: [#92](https://github.com/goldmayo/oioi-bwg/pull/92)
- 적용 규범: `09-error-ux-observability.md`의 unexpected error capture, structured context,
  sensitive data 금지와 `11-content-i18n-assets-runtime-architecture.md`의 `NEXT_PUBLIC_*` build-time 규칙

이번 결과는 error monitoring 복구만 다룬다. logging architecture나 tracing architecture를
새로 결정하지 않는다.

## 변경 전

- root의 `sentry.client.config.ts`에 `Sentry.init()`이 있었지만 `next.config.ts`는
  `withSentryConfig`를 사용하지 않았고 Next client entry도 이 파일을 import하지 않았다.
- client config에는 tracing 100%와 Replay sample rate가 있었으나 실제 client 초기화 경로에
  연결되지 않았다.
- server instrumentation은 `NODE_ENV`, server reporter는 `NODE_ENV || APP_ENV`, shared reporter는
  `APP_ENV`만 사용했다. `NEXT_PUBLIC_SENTRY_ENVIRONMENT`가 별도 환경 이름을 제공했다.
- shared reporter는 임의 `Record<string, unknown>`을 `setExtras()`로 전달했고, 미사용 warn/info/user/tag/
  breadcrumb/flush API도 application logger처럼 노출했다.
- browser event에 URL, query, user, linked cause, Zod/Ky metadata, 자동 network/console/DOM breadcrumb를
  제한하는 `beforeSend`/`beforeBreadcrumb` 경계가 없었다.

## 실제 변경

### Client 초기화

Next 16.3.3의 `instrumentation-client.ts` file convention과 설치된 `@sentry/nextjs` 10.42.0의 탐색
경로를 확인해 `src/instrumentation-client.ts`로 이동했다. production Turbopack build의 client chunk에
새 policy가 포함되는 것도 확인했다. 중복 init을 막기 위해 legacy `sentry.client.config.ts`는 삭제했다.

`withSentryConfig`는 추가하지 않았다. 이번 범위에서 필요한 client init은 Next file convention으로
동작하며, wrapper의 source map/release build integration은 명시적으로 보류한 범위이기 때문이다.
공식 근거는 [Sentry Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)과
[Next.js instrumentation-client](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client)다.

### 환경 정책

`src/shared/config/sentry.ts:getSentryRuntimeConfig`가 browser/server 공통 결정을 소유한다.

```text
enabled = APP_ENV가 staging 또는 production
       && NEXT_PUBLIC_SENTRY_DSN이 비어 있지 않음
```

`NODE_ENV`는 Sentry 전송 판단에서 제거했다. `NEXT_PUBLIC_SENTRY_ENVIRONMENT`도 제거하고 Sentry의
environment는 검증된 APP_ENV를 그대로 사용한다. 새 `SENTRY_ENABLED` 변수는 추가하지 않았다.
APP_ENV가 이미 배포 환경의 SSOT이고, DSN 존재 여부까지 확인하면 local build/smoke와 설정 누락을
한 정책에서 안전하게 처리할 수 있기 때문이다.

| Runtime | local | staging | production |
| --- | --- | --- | --- |
| Browser Sentry | OFF | DSN이 있으면 ON | DSN이 있으면 ON |
| Server Sentry | OFF | DSN이 있으면 ON | DSN이 있으면 ON |

`NODE_ENV=production`인 local smoke도 APP_ENV가 local이면 OFF다. application은 staging/production에서
DSN이 없을 때 Sentry만 fail-closed로 비활성화한다. OCI staging image publish job은 DSN을 필수 GitHub
environment variable로 검증하므로 운영 배포 경로에서는 누락된 설정으로 image를 게시하지 않는다.

`NEXT_PUBLIC_*` 환경변수는 public client bundle에 필요하므로 build-time 값이다. staging build 산출물의
client, server, SSR, edge chunk에서 APP_ENV와 DSN이 상수로 포함되는 것을 확인했다. 따라서 GitHub
environment에서 image build input으로 관리하고 OCI host의 `runtime-public.env`에는 중복하지 않는다.

### Client privacy 경계

현재 실제 consumer를 기준으로 capture context를 다음 값만 허용한다.

- 고정 allowlist `source`
- 영문·숫자·`_`·`-`로 제한된 최대 128자 Next digest
- error name에서 유도한 `client-contract | client-transport | runtime`

arbitrary extras는 제거하고 위 값을 Sentry tag로만 전달한다. 전송 직전 `beforeSend`가 event를 새로
구성해 원문 error message와 cause chain, Zod issue/input, Ky request/response, request URL/query,
user, arbitrary tag/extra/context를 버린다. stack은 최종 exception의 안전한 filename/function/line/column만
남기며 HTTP filename은 `/_next/` asset path만 허용한다. browser/OS는 고정 name allowlist와 숫자
version만 남긴다.

SDK가 기본으로 수집하는 console, DOM click, fetch/XHR breadcrumb는 버린다. navigation breadcrumb만
query/hash를 제거해 보존하며 `beforeSend`에서 다시 같은 정책을 적용한다. `sendDefaultPii=false`도
유지한다. 현재 호출되지 않던 shared logger의 warn/info/setUser/setTag/addBreadcrumb/flush API는
삭제했고, 호환이 필요한 `logger.error`만 **Sentry error reporter**라는 책임으로 좁혔다. 범용 logger로
확장하지 않았다.

local console도 raw Error/context 대신 name/source/digest/errorType만 출력한다.

## 변경 후 event 흐름

```text
Client Error
    ↓
Error Boundary / Query·Mutation cache / Login catch
    ↓
logger.error + captureClientErrorOnce
    ↓
source·digest·errorType allowlist
    ↓
APP_ENV + DSN environment policy
    ↓
Sentry SDK beforeSend / beforeBreadcrumb
    ↓
sanitized Sentry error event
```

자동 global handler에서 들어오는 browser exception도 reporter context가 없을 뿐 같은 `beforeSend`
경계를 통과하며 `sentry-auto-capture/runtime`으로 분류된다.

Next server request error는 Sentry 활성화 여부와 무관하게 `reportServerError`를 호출한다. reporter가 먼저
민감정보를 제거한 JSON error event를 stderr에 출력한 뒤 APP_ENV와 DSN을 확인해 Sentry capture만
선택적으로 실행한다. 따라서 local 환경이나 DSN 설정 누락이 container log까지 끄지 않는다.

## 조사 대비 보정한 판단

조사의 client 초기화 누락 판단은 실제 설치 코드와 build 결과에 부합했다. 추가 확인에서 SDK 10.42.0
타입은 `tracesSampleRate`가 정의되면 값이 0이어도 tracing을 활성 상태로 취급하고 0% sampling한다고
명시했다. 따라서 client에서는 `tracesSampleRate: 0`을 쓰지 않고 기본 `BrowserTracing` integration을
제외했다. `Replay` integration도 제외하고 두 Replay sample rate를 0으로 유지했다. Server는 기존
`skipOpenTelemetrySetup: true`를 유지하고 0 sample rate 설정을 제거했다.

`instrumentation-client.ts`는 framework가 hydration 전에 읽는 오류 수집 진입점이므로 일반 analytics처럼
hydration 뒤로 지연하지 않았다. 이는 초기 client exception도 수집해야 하는 이 경계의 책임 때문이다.

## 변경 파일별 이유

- `src/instrumentation-client.ts`, legacy client config 삭제: Next 16 client init 경로와 error-only SDK 옵션
- `src/shared/config/sentry.ts`: browser/server 공통 APP_ENV + DSN 정책
- `sentry.server.config.ts`, `src/instrumentation.ts`, `src/server/observability/server-logger.ts`: 같은 활성화 정책 사용
- `src/shared/lib/client-sentry-policy.ts`: event/context/breadcrumb allowlist와 sanitizer
- `src/shared/lib/sentry.ts`: arbitrary extras와 미사용 범용 API 제거, error reporter 책임으로 축소
- `capture-client-error.ts`, Query client, global error boundary: typed source/digest 전달
- Dockerfile, CI workflow, `.env.example`, OCI env example: 중복 Sentry environment 변수 제거, 실제
  build-time 입력 문서화, staging image publish 전 DSN 검증
- 관련 `*.test.ts`: local/staging/production 정책, SDK init, integration 제외, capture, privacy 회귀 검증

## 검증

최신 `origin/migration_develop` commit `b410c1e4898482ad79298703b298b2eae51277a8`을 merge한 뒤 review
수정 commit `b5c3a601b108c7e89c6869afb1520af02bed08de` 기준으로 production credential과 실제 Sentry 전송
없이 수행했다.

- instrumentation/server config 집중 Vitest: 3 files, 21 tests 통과
- OCI ops 집중 Vitest: 2 files, 9 tests 통과
- `pnpm verify`: type-check, architecture harness 8 tests, ESLint, Steiger, unit 53 files/216 tests,
  ops 2 files/9 tests 통과
- `pnpm format:check`: 통과
- `NEXT_PUBLIC_APP_ENV=staging NEXT_PUBLIC_SENTRY_DSN=https://public@example.test/1 pnpm build`:
  Next 16.3.3 Turbopack production build 통과, 22개 static page 생성 완료
- build artifact 검색: client/server/SSR/edge chunk에 APP_ENV와 DSN 상수 포함, edge instrumentation이
  환경 gate 없이 safe server reporter를 호출하는 것 확인
- `git diff --check`: 통과

실제 staging Sentry 수신, Sentry 조직 측 scrubbing/alert/quota, production 배포는 확인하지 않았다.

## 명시적으로 보류한 작업

- tracing과 span
- Replay
- source map upload와 release 연결
- OCI Logging 변경
- server application logging 확대 또는 server reporter 구조 변경
- Pino 등 structured logging library
- 범용 logger abstraction

후속 운영 검증에서는 안전한 synthetic marker로 staging browser/server event 수신과 sanitizer 결과를
확인해야 한다. 해당 검증에서도 실제 사용자 데이터나 production credential을 사용하지 않는다.
