---
title: "Logging / Sentry / Observability 조사 및 설계 리뷰"
kind: migration-evidence
status: completed
snapshot:
  mode: frozen
source:
  repository: goldmayo/oioi-bwg
  branch: migration_develop
  commit: d0b02dcb45a8bfa615bfbec8f76f166cd8d9a377
observed_at: 2026-09-20
---

# Logging / Sentry / Observability 조사 및 설계 리뷰

이번 문서는 현재 브랜치에 대한 정적 조사 결과다. 코드·설정·의존성을 변경하지 않았다.
4~6절은 **미승인 개선 제안**이며 active architecture나 구현 계획을 대체하지 않는다.
규범은 [헌법](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md)과
[09 Observability](../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md),
[11 Runtime](../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md),
[12 Deployment](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)가 소유한다.

- 조사 브랜치: `migration_observability_audit`. 시작 시 working tree는 clean이었다.
- `git fetch origin migration_develop` 후 원격은 `b410c1e4898482ad79298703b298b2eae51277a8`이었다.
  사용자의 **현재 브랜치 기준** 지시에 따라 로컬 `d0b02dc`에서 분기했고 원격 변경은 합치지 않았다.
- 아래 경로·symbol은 위 고정 SHA 기준이다. 확인은 코드 사실, 추론은 실행 경로에 따른 판단이다.
- 실제 OCI/Sentry 계정·운영 DB·로컬 비밀 환경 파일에는 접근하지 않았다. 운영 수신 여부는 별도다.

## 1. 현재 상태

### 1.1 결론과 실제 런타임

**Sentry는 현재 서버 오류 수집 중심이며, end-to-end observability로 작동한다고 볼 근거가 없다.**
서버 tracing은 의도적으로 껐고, 브라우저 초기화는 연결이 누락됐다. Application logging은
서버 오류 JSON과 운영 shell 이벤트에 한정된다. 일반 요청/외부 호출/DB latency 추적은 없다.

| 실제 실행 영역 | 코드 근거와 역할 |
| --- | --- |
| Browser / Client Component | `src/app/app-providers.tsx`, `src/features/chant-sync/ui/LyricsViewerClient.tsx`; Query, 사용자 상호작용, YouTube 상태 감시 |
| Next RSC / Node server | `src/app/**/page.tsx`, `src/server/services/**`; 같은 프로세스에서 service/DB 호출 |
| Route Handler | `src/app/api/**/route.ts`, `src/app/{healthz,readyz}/route.ts`; API와 health probe |
| Server Action | `src/features/auth/api/actions.ts`, 앨범 업로드 action; 로그인/로그아웃·업로드 |
| Proxy / instrumentation | 루트 `proxy.ts`가 Auth.js를 `/admin/:path*`에 연결; `src/instrumentation.ts`는 Node 초기화/요청 오류 hook |
| Node standalone / 개발 서버 | `package.json`: `next dev`, `next build`, `node .next/standalone/server.js`; Docker runner는 Node 22.16.0에서 `node server.js` |
| Node 도구·DB 작업 / CI | `scripts/*.ts`: guard, migration, role bootstrap, PostgreSQL integration; GitHub Actions의 검증·이미지 빌드 |
| Host shell / 운영 작업 | `ops/oci/*.sh`, filesystem metric systemd timer; deploy/rollback, preflight, metric publication |

Edge 전용 route/config, 별도 API 서버, 제품용 batch worker, seed script는 확인되지 않았다.
Proxy는 존재하므로 누락된 middleware 설정으로 취급하지 않는다. 부하 테스트 `tests/k6/*.js`는
검증 도구이며 제품 runtime이 아니다.

### 1.2 배포 구조: 선언과 실제 운영을 구분

[Dockerfile](../../../Dockerfile), [Compose](../../../compose.oci-development.yml),
[CI](../../../.github/workflows/verify.yml)는 Next standalone → ARM64 OCIR image → OCI DevOps/Compute
배포 경로를 구성한다. Compose는 기존 PostgreSQL network에 연결하며 `NODE_ENV=production`이다.
CI image의 제품 환경은 `NEXT_PUBLIC_APP_ENV=staging`, Sentry 환경도 `staging`으로 고정된다.
즉 배포 이름의 development와 Next의 development mode는 같은 의미가 아니다.

- Compose `json-file` driver: 파일당 10 MB, 5개 회전. stdout와 stderr 모두 Docker 수집 대상이다.
- [infra/oci/logging.tf](../../../infra/oci/logging.tf): CUSTOM log, 보존 30일, agent가
  `/var/lib/docker/containers/*/*-json.log`를 tail하도록 선언한다. app 전용 경로가 아니라 host의
  다른 container 로그도 범위에 들어갈 수 있다. `parse_nested=false`여서 Docker envelope 안의
  application JSON 문자열이 자동으로 구조화 검색된다고 가정할 수 없다.
- `ops/oci/deploy-release.sh`는 host에서 실행된다. 그 stdout를 위 Docker tail이 수집하지는 않는다.
  Run Command/DevOps output과 장기 검색 경로는 별도로 확인해야 한다.
- [M9 결과의 남은 검증](./M9-CICD-OCI-OPERATIONS-RESULT.md)은 OCI Logging Search와 staging Sentry
  event 확인을 후속으로 남겼다. Caddy access log 설정/실제 활성화, production endpoint 및 별도
  production image pipeline, agent 적용 여부, Sentry alert/보존/할당량/PII scrub 설정은 **코드베이스에서 확인 불가**다.

### 1.3 Sentry 구성과 호출 경로

| 항목 | 관련 파일 / symbol | 현재 역할과 판단 |
| --- | --- | --- |
| dependency | `package.json`, `pnpm-lock.yaml` | 직접 의존 `@sentry/nextjs: ^10.42.0`, lock 해석 10.42.0. Next 16.3.3 / React 19.2.5. 관련 node/react/browser SDK는 전이 의존이며 별도 logger 도입 증거가 아님 |
| server 초기화 | [src/instrumentation.ts](../../../src/instrumentation.ts): `register` | `NODE_ENV=development`면 건너뜀. 그 외 `NEXT_RUNTIME=nodejs`에서만 server config import |
| server 옵션 | [sentry.server.config.ts](../../../sentry.server.config.ts): `Sentry.init` | 공개 DSN 변수, 환경 기본 production, `sendDefaultPii=false`, `beforeSend=sanitizeServerSentryEvent`, `debug=false` |
| browser 초기화 | [sentry.client.config.ts](../../../sentry.client.config.ts), `next.config.ts` | 파일에 init은 있지만 import하는 application 코드가 없고 `instrumentation-client.ts`와 `withSentryConfig`도 없음. 현재 build 경로상 browser SDK 초기화 누락으로 판단 |
| Next build integration | [next.config.ts](../../../next.config.ts) | plain NextConfig export. Sentry wrapper/loader/upload 설정 없음. Server는 독립 instrumentation import로 초기화되므로 browser 문제와 구분 |
| server 수동 exception | [server-logger.ts](../../../src/server/observability/server-logger.ts): `reportServerError` | 안전한 descriptor를 JSON stderr에 기록하고 새 Error를 `withScope/setTags/captureException`으로 전송 |
| API exception | [api-response.ts](../../../src/server/http/api-response.ts): `toErrorResponse` | input Zod/AppError는 HTTP 계약으로 반환; unknown/output contract failure만 위 reporter 호출 |
| Auth.js exception | `src/auth.ts`, `auth-error-reporter.ts`: `reportAuthError` | 정상 CredentialsSignin 제외; 나머지는 고정 `AUTH_FAILURE`로 reporter 호출 |
| Next global server handler | `src/instrumentation.ts`: `onRequestError` | method/routerKind/routeType만 allowlist. request URL/body/headers 제외. 개발 모드에서는 handler가 조기 반환 |
| browser 수동 exception | [src/shared/lib/sentry.ts](../../../src/shared/lib/sentry.ts): `logger.error` | local 등에서는 raw error/context를 console에 출력; staging/production에서는 withScope/setExtras/captureException. SDK 초기화를 대신하지 않음 |
| Query/Mutation | `src/shared/api/query/query-client.ts`: `captureClientBoundaryError` | ClientContractError와 비정상 HTTP 계약의 ClientTransportError(HTTP_ERROR)만 captureClientErrorOnce로 보고. 정상 API 500은 server capture가 담당. 일반 Error/네트워크 실패는 이 handler가 capture하지 않음 |
| Error Boundary | `src/app/(admin)/admin/error.tsx`, `src/app/global-error.tsx` | admin은 captureClientErrorOnce, global은 logger.error 직접 호출. global에 digest extra 전달. 별도 Sentry.ErrorBoundary wrapper는 없음 |
| 로그인 client catch | `src/features/auth/ui/LoginForm.tsx` | captureClientErrorOnce에 `source=admin-login-form` 전달 |
| 업로드 action | `src/app/(admin)/admin/albums/_lib/upload-album-image-action.ts` | Zod만 제외하고 고정 AlbumImageUploadError를 shared logger로 전송. 원본 storage error는 전달하지 않음. server JSON reporter 경로와 다름 |
| captureMessage | `src/shared/lib/sentry.ts`: `warn/info` | warning/info Sentry message API는 있으나 실제 consumer 호출은 검색되지 않음. Sentry Logs API 사용이 아님 |
| 나머지 API | 같은 파일: `setUser/setTag/addBreadcrumb/flush` | export만 있고 실제 consumer 호출 없음. setUser는 id/email 지원하지만 실제 사용자 연결은 없음 |
| tracing/span | server config, client config | server `tracesSampleRate=0`, `skipOpenTelemetrySetup=true`; client 파일은 1.0이지만 로드되지 않음. 명시적 startSpan/startTransaction/수동 DB·외부 API span 없음 |
| Replay | client config | session 0.1, error 1.0이라는 옵션만 있고 replayIntegration 등록 없음. replay를 실제 수집한다고 볼 수 없음 |
| error sampling | 두 config | `sampleRate`/custom error sampler 없음. SDK 기본값과 조직 측 quota/filter는 구분해야 함. tracing 0은 error capture OFF를 의미하지 않음 |
| source map / release | Next config, Dockerfile, CI, sanitizer | Sentry upload token/org/project/withSentryConfig, release 연결이 없음. private source map upload 경로 미구성. 서버 sanitizer는 release/dist/debug_meta도 보존하지 않음 |

SDK 10.42.0의 설치된 `build/cjs/config/webpack.js`는 legacy client config의 Turbopack 비호환을
명시한다. `build/cjs/client/index.js:getDefaultIntegrations`에는 browser tracing 자동 integration이
있다. 따라서 “browserTracingIntegration을 직접 쓰지 않아서 tracing이 안 된다”가 아니라
**client init 연결 자체가 없다**는 판단이다. Replay integration은 별도로 필요하다.
공식 [Next Sentry setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)과
[Replay setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/)도 대조했다.
실제 전송 검증/build 실행은 이번 조사에서 하지 않았다.

### 1.4 환경·DSN·컨텍스트·민감정보

| 설정/경계 | 확인된 동작과 주의점 |
| --- | --- |
| local Compose | `compose.dev.yml`: NODE_ENV=development, APP_ENV=local. server init/hook skip; server reporter는 안전한 stderr, shared logger는 raw dev console |
| local production build | NODE_ENV=production이면 APP_ENV=local이어도 server reporter는 Sentry capture를 시도. DSN이 있으면 local release smoke와 운영 분리가 필요 |
| deployed development/staging | CI builder에 public DSN와 APP_ENV/SENTRY_ENVIRONMENT=staging 주입. NODE_ENV는 production. DSN 값 존재/유효성은 코드베이스에서 확인 불가 |
| production | config는 지원하지만 별도 production publish 구성은 확인되지 않음. Sentry 환경 fallback production은 미설정 환경의 잘못된 분류 가능성을 만듦 |
| 서로 다른 활성화 조건 | register는 NODE_ENV, server reporter는 NODE_ENV **또는** APP_ENV, shared logger는 APP_ENV만 사용. dev 서버에 APP_ENV=staging이면 capture API만 호출하고 init은 skip할 수 있음 |
| build/runtime env | Docker builder의 NEXT_PUBLIC 값은 Next 번들에 고정될 수 있음. runner env_file만 바꿔 browser DSN/environment를 바꾼다고 가정하면 안 됨. 실제 서버 번들 해석은 build 산출물 검증 필요 |
| env 문서/guard | `.env.example`에 Sentry 변수 없음. `ops/oci/deploy.conf.example`의 REQUIRED_RUNTIME_KEYS는 DATABASE_URL/AUTH_SECRET뿐. DSN 없는 build가 실패하도록 하는 guard는 없음 |
| 사용자 정보 | RequestContext의 user.id는 Authz용이며 Sentry와 연결되지 않음. setUser helper의 email 전달은 사용되면 09의 raw personal data 금지와 충돌; 현재 호출은 없음 |
| 서버 payload | `safe-server-event.ts:sanitizeServerSentryEvent`가 request/user/extras/breadcrumb/raw exception/cause/SQL 등을 버리고 허용 태그·trace ID·제한된 stack 위치만 새 객체에 남김 |
| stack 한계 | filename/function은 길이/개행 검사이며 path/URL 내용 redaction은 아님. 동적 stack 문자열이 민감 값을 포함한다면 잔여 위험. 일반 static code frame에서 실제 노출이 있었다는 증거는 없음 |
| 브라우저 payload | client beforeSend/beforeBreadcrumb 없음. raw error, arbitrary extras, `http-errors.ts`의 Zod/Ky cause를 넘길 수 있음. SDK 초기화 복구 시 URL/query/breadcrumb/cause 최소화도 함께 설계해야 함 |
| correlation | server JSON과 Sentry event ID 연결 없음. request ID, route template, release, 외부 provider request ID 전달 없음. instrumentation은 route 종류만 보존 |

서버 beforeSend는 application event에 대한 보호이지 모든 stdout/stderr의 sanitizer가 아니다.
Next/Auth.js/DB driver/OCI SDK의 기본 warning이나 uncaught 출력, shell 자식 프로세스 stderr까지
완전히 차단한다고 주장할 수 없다. 운영 로그 샘플 확인은 별도다.

### 1.5 로깅 인벤토리: 목적별 분류

| 분류 | 실제 발생 지점 | 평가 |
| --- | --- | --- |
| 개발 디버깅 | `useAdWatcher.ts:55,57` console.log | 사용자/관리자 lyrics 화면에서 광고 전환마다 실행. env gate 없음. 고정 문구라 직접 PII는 없으나 production browser noise |
| 개발 진단 | `shared/lib/sentry.ts:19,43,60,87` error/warn/info/log | error만 실제 consumer가 있음. raw error/context는 dev 로그에도 민감정보 포함 가능. breadcrumb는 dev 출력 후 Sentry API도 호출하는 구현 |
| application/DB error | `server-logger.ts:50` console.error(JSON.stringify(...)) | timestamp/level/event/source/error/request를 구조화. raw SQL/row 없음. 임의 console.error와 구분해야 함 |
| Sentry error/message | 위 capture 경로 | application info를 Sentry message로 보내는 API가 있으나 실제 운영 info consumer는 없음. 중앙 Sentry Logs pipeline 미구성 |
| expected warning | `auth-error-reporter.ts`, `api-response.ts` | 정상 인증 거부/AppError/입력 검증 오류를 오류 모니터링에서 제외. library 기본 경고를 프로젝트가 모두 override하지는 않음 |
| external API failure | OCI email → service → API reporter; R2 upload → action → shared logger | 실패는 경계에서 포착하지만 provider/operation/latency 분류 부족. `oci-email-delivery.ts`의 opcRequestId는 반환되지만 logging에 연결되지 않음 |
| request/response | `next.config.ts:logging.fetches.fullUrl=true` | 개발 fetch 진단용. 운영 access logging 아님. URL query 민감 값 주의. body/header 전체 로깅 구현 없음 |
| DB query logging | `src/server/db/index.ts:createDatabase` | Drizzle logger, postgres debug hook 미설정. 성공 query/SQL/params 로그 없음 |
| health probe | `readyz/route.ts`, `healthz/route.ts` | readyz DB 실패는 503만 반환하고 capture 안 함. 매 10초 probe마다 오류 폭증을 피하지만 원인 진단은 별도 신호 필요 |
| script 진행 정보 | `assert-local-database.ts:20`, migration `:69`, role bootstrap `:293`, integration `:120,124,270` | hostname, applied count, DB/role 이름, cleanup 결과. CLI stdout 사용 적절; audit trail의 불변성/완전성까지 제공하지 않음 |
| script 실패 | migration `:83`, role bootstrap `:300`, integration `:275,284` | stderr/exitCode=1. raw error.message 경로는 DB detail/SQL 등 노출 후보; server sanitizer 적용되지 않음. 실제 secret 노출 여부 미확인 |
| dump restore | `scripts/restore-local-dump.sh` | 진행/실패와 local dump path 출력; 공유 CI 로그로 올릴 때 경로 노출 주의 |
| 배포/audit 성격 | `ops/oci/deploy-release.sh:log_event` | severity/event/digest/deployment JSON; 성공·candidate 실패·rollback 기록. 제품 사용자 변경 audit는 아님 |
| 운영 도구 | preflight/install/probe/metric shell 및 systemd | PASS/FAIL와 상태, JSON probe 출력. 일부 printf는 env/임시 파일 쓰기이므로 로그로 분류하지 않음. metric payload는 metric 전송 데이터 |
| CI/도구 출력 | `.github/workflows/verify.yml`, `scripts/run-postgres-integration-tests.ts` child processes | 빌드·테스트·migration 도구 자체 출력 포함. application log와 분리해 CI/job output로 관리 |

`package.json`에 Pino/Winston/Bunyan 등 직접 logging library는 없다. lockfile의 `consola@3.4.2`는
citty/giget 도구의 전이 의존이며 application logger 사용 근거가 아니다.
`console.*`, Sentry API, logger import/call, stdout/stderr 및 shell 출력 패턴을 전체 tracked 소스·도구·설정에서
조사했다. tests의 mock/assertion은 제품 로그 발행자로 세지 않았다.
Next의 fetch logging은 [공식 logging 문서](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging)상 개발용이다.

## 2. 발견한 문제: 운영 영향에 따른 중요도

| 중요도 | 문제 / 근거 | 영향과 확실성 |
| --- | --- | --- |
| Critical | 확인된 항목 없음 | 운영 중단·실제 데이터 유출을 입증할 증거 없음 |
| High | browser init 누락: client config, Next config, entry 부재 | browser capture 호출이 있어도 전송할 초기화가 없음. 정적 경로로 확인; 배포 수신 실험은 미실행 |
| Medium | 환경 gate 불일치 / DSN guard 부재: 1.4 | local release의 원치 않는 전송 또는 staging capture 침묵 가능. 실제 운영 값 확인 불가 |
| Medium | 원본 오류 위치/분류 손실: reportServerError의 `new Error` | 수동 경로 stack은 reporter 생성 위치 중심. sanitizer가 stack을 보존해도 원본 발생 frame을 복원하지 못함. 자동 capture는 SDK 제공 frame을 보존할 수 있음 |
| Medium | source map/release 연결 미구성 + sanitizer metadata 제거 | browser init을 복구해도 minified stack·release별 회귀 조사에 제약. upload만 추가해서 해결되지 않음 |
| Medium | upload action이 AppError까지 capture | service의 UNAUTHENTICATED/FORBIDDEN이 Zod가 아니므로 upload.failure로 보고됨. 09의 expected failure 제외 원칙과 불일치. JSON 운영 error 경로도 우회 |
| Medium | client payload 최소화 경계 부재 | browser init 복구와 함께 해결할 조건부 위험. 현재 실제 유출로 판단하지 않음 |
| Medium | script raw error.message | DB 운영 도구가 shared server sanitizer 밖에서 SQL/DB detail을 출력할 가능성. raw 비밀값 로깅을 확인했다는 의미는 아님 |
| Medium | correlation·운영 수신 검증 공백 | request/release/event ID 연결 없음. OCI parse_nested=false와 host script 별도 출력 때문에 검색/상관분석 확인 필요 |
| Low | tracing/replay 옵션이 실제 상태를 오해하게 함 | tracing OFF는 M1 의도이며 결함 자체가 아님. client 100%/Replay 수치는 기능 도입의 증거가 아님 |
| Low | shared logger의 미사용 API·주석·debounce | flush 함수 존재만으로 전송 보장 안 됨. warn/info의 전역 debounce는 서로 다른 사건도 마지막 호출만 남기지만 현재 consumer 없음 |
| Low | dev full URL / 광고 console / 부분 dedupe | fullUrl은 개발 환경 주의. 광고 로그는 noise. WeakSet은 같은 Error identity만 보호; global boundary·서버/브라우저 간 중복까지 보장하지 않음 |

Auth.js error callback과 Next request hook에서 같은 실패를 각각 보고할 가능성은 있지만 실제 중복
수신은 확인하지 않았다. Query가 정상 API 500을 다시 capture하지 않는 것은 서버 보고와의 중복을
줄이는 합리적 선택이다. 반면 arbitrary client Error는 Query handler가 처리하지 않으므로 UI 경계와
global unhandled error 수신을 후속 검증해야 한다.

## 3. 잘 되어 있는 부분

- [server reporter](../../../src/server/observability/server-logger.ts)와 beforeSend allowlist가
  원본 DB error/cause/SQL/개인정보를 무분별하게 전송하지 않는다. 원본 전체를 복구하는 방향은 부적절하다.
- `server-only` 경계, scope-local tags/extras, API output contract 별도 capture가 있다.
- 정상 AppError/입력 오류/CredentialsSignin을 기본 capture에서 제외하고 client-safe 응답을 유지한다.
- `captureClientErrorOnce`는 Query와 admin boundary에서 같은 Error 객체의 중복 보고를 제한한다.
- `server-logger.test.ts`, `auth-error-reporter.test.ts`, `instrumentation.test.ts`에는 민감 값 제거,
  hostile getter, 허용 metadata, dev skip을 확인하는 테스트가 있다. **이번 작업에서 실행한 결과는 아니다.**
- DB query/row 전체 logging과 모든 request body capture를 하지 않는다. local email도 OTP를 console에 출력하지 않는다.
- Docker 로그 회전과 OCI 보존 선언, digest/deployment 기반 배포 이벤트는 유지할 가치가 있다.
- 단일 Next 서버에서 분산 tracing을 먼저 만들지 않은 선택은 현재 헌법과 부합한다.

## 4. 권장 architecture: 제안

### 4.1 역할 분담

**Error monitoring**은 Sentry가 맡는다. Unexpected exception, output/client contract failure,
사용자에게 영향을 주는 client exception을 오류 경계 한 곳에서 보고한다. expected rejection은
기본 제외한다. 필요한 서버 오류는 안전한 JSON 요약도 남기되 동일 event/request/release 식별자로 연결한다.

**Application logging**은 기존 `src/server/observability`에서 작은 typed event API를 제공하고
stdout/stderr → Docker → OCI Logging으로 보낸다. 시작/종료, 중요한 상태 변화, 외부 서비스의
실패·느린 호출에만 고정 event·operation·outcome·duration·허용 code를 기록한다. request logging은
route template/method/status/duration 수준으로 제한하고 health probe/정상 고빈도 요청은 기본 생략한다.
제품 audit가 필요하면 actor/action/resource/보존 요구를 별도 설계한다. 일반 로그를 audit 저장소로 간주하지 않는다.

**Tracing**은 위 두 영역의 수신·privacy·release 연결을 안정화한 후 선택한다. 먼저 확인할 질문은
RSC/service, OCI email, R2, DB 중 어느 latency가 문제인지다. 필요할 때 Sentry span을 작은 범위에
낮은 비율로 도입하고 데이터 양을 측정한다. 현 단계에 별도 OTel collector/분산 tracing backend는 권하지 않는다.
DB statement/params·외부 URL query가 span에 들어가지 않는지도 별도 검증한다. error beforeSend만으로
transaction/span/Replay 데이터가 보호된다고 가정하지 않는다.

### 4.2 Runtime × Environment 전략 (아래 표는 현재 동작이 아닌 권장안)

공통으로 password/token/cookie/header/email/OTP/raw row/body/query string은 기록하지 않는다.
local도 실제 dump를 사용할 수 있으므로 예외가 아니다. console은 출력 수단으로 허용하되 서버에서는
임의 객체 대신 안전한 JSON만 쓴다. Sentry 활성화는 NODE_ENV와 별개인 명시적 배포 환경/DSN 정책으로 통일한다.

| Runtime | Local | Development / Staging 배포 | Production |
| --- | --- | --- | --- |
| Browser | debug/warn/error 최소 console; Sentry 기본 OFF, 재현 실험만 명시 opt-in | 오류는 환경 분리 Sentry; 일반 info/debug OFF; 승인된 재현에만 제한 diagnostics | unexpected error만 Sentry; 정상 UI/광고 전환 로그 생략; browser JSON logger/원격 info 수집 불필요 |
| Next RSC / Route Handler | 안전한 JSON error/warn + 필요한 debug를 터미널; 정상 input 오류 생략 | JSON info/warn/error → Docker/OCI; unexpected → Sentry; 제한된 request summary로 수신 점검 | JSON 중요 event/warn/error; request 전체 로깅은 비용/필요 확인 후; raw URL/body 없음; unexpected → Sentry |
| Server Action / Auth Proxy | expected auth 거부는 UX만; unexpected 안전 JSON; 로컬 Sentry OFF | 서버와 같은 reporter; auth/proxy/action 구분만 허용; expected 거부는 기본 capture 제외 | 같은 정책; 권한 실패를 fatal로 오인하지 않음; token/session 데이터 제외 |
| instrumentation / startup | 초기화 성공은 필요할 때 한 번; secret 없는 설정 진단 | release/environment/telemetry enabled 상태 1회 JSON; startup/request unexpected Sentry | 시작/치명 실패 신호, 안전한 frame; hooks와 수동 경계 중복 점검; 설정값 원문 출력 금지 |
| Node DB/검증 script | 진행 stdout, 실패 stderr/exit code; Sentry 불필요; DB/경로 노출 제한 | CI log에 동일 출력; 자동 운영 task만 JSON summary; test fixture·credential 제외 | 명시 승인된 운영 도구만; JSON outcome/count/duration; 오류 메시지 allowlist; Sentry 자동 도입 불필요 |
| Host deploy / preflight / metric | dry-run/test 결과 console; 비밀값 없는 fixture | 기존 JSON deployment 이벤트 + tool stderr; DevOps/Run Command 수집 확인 | 동일 JSON과 실패 alert; timer는 journal/수집 경로 확인; Docker tail로 수집된다고 가정하지 않음 |
| Build / CI | 도구 native output 유지; application Sentry OFF | build/job log, artifact/release identity; source map token은 CI secret; build error는 CI로 | production image build도 같은 원칙; build와 runtime 사건 분리; 운영 secret 주입 금지 |

### 4.3 최소 필드와 privacy 방향

서버 event는 timestamp/level/event/source/environment/release를 기본 후보로 하고 request summary가
필요할 때 method/route template/status/duration/request ID를 추가한다. Error는 allowlisted type/code,
정제된 frame 위치만 허용한다. 외부 서비스는 고정 provider/operation/outcome만 먼저 추가한다.
원본 Error JSON serializer를 일반 허용하지 않는다. user email을 넣지 않으며 actor ID도 운영 필요와
보존·접근 정책이 정해졌을 때만 검토한다. 필드 확대는 현재 sanitizer/test와 함께 검토해야 한다.

## 5. logger abstraction 판단

**선택: B. 최소 logger abstraction 도입 — 기존 서버 abstraction을 작게 보완하는 방향.**
새 shared `logger.ts`나 전 runtime 공통 logger를 만들자는 뜻이 아니다. 이미 존재하는 server reporter와
client error reporter를 유지하고 책임/활성화 정책을 명확히 하는 것이 우선이다.
09의 structured logger 원칙은 특정 library 구매/도입을 요구하지 않으며 현 JSON 출력이 출발점이다.

| 대안 | 현재 프로젝트에서의 이점 | 단점·복잡도·과도한 추상화 위험 | 판단 |
| --- | --- | --- | --- |
| A. 직접 console/Sentry 유지 | 새 구조 비용 없음; 소비처 수가 적음 | 기존 allowlist와 두 reporter가 이미 있으므로 모든 호출을 직접 API로 되돌리면 privacy/env 중복. 손실된 init/release/correlation도 해결 안 됨 | 기존 상태를 그대로 두기는 부적절 |
| B. 최소 abstraction | 기존 safe reporter 재사용; event/level/env/privacy를 한 server 경계에서 강제; 적은 수의 운영 event를 JSON으로 표현 | schema/allowlist 유지와 context 전달 비용은 있음. 범용 debug/info/warn/error 모두 미리 만들면 미사용 API가 반복됨 | 가장 적합. 필요한 event/use case만 추가 |
| C. clientLogger/serverLogger/scriptLogger 체계 | runtime sink 차이가 명확함 | browser는 exception 중심, shell은 TS logger 소비 불가. 세 logger의 API/설정/test 유지비에 비해 실제 공통 요구가 적음 | runtime 책임 분리는 유지하되 세 logger 제품화는 보류 |
| D. Pino 등 structured library | 대량 JSON, level/child context, transport 요구가 생기면 유리 | 현재 중요 로그는 단일 JSON reporter와 shell 함수. 의존성·Next packaging·serializer privacy 검토 비용; browser init 등 실제 문제는 해결 못 함 | 높은 로그량/자동 context/성능 요구가 확인될 때 재평가 |

현재 logger 이름의 shared utility는 사실 Sentry reporter다. info/warn을 자동 Sentry issue로 보내는
개념을 application logging 표준으로 확장하지 않는다. script 진행 출력도 앱 logger에 강제로 넣지 않는다.

## 6. 개선 우선순위 및 검증 제안

1. **반드시 우선 해결:** browser init 경로와 환경 활성화 정책을 명시하고 client payload 최소화를
   함께 설계한다. Staging에서 browser exception/Query contract error/server unexpected를 각각 1회
   발생시켜 수신·환경·민감 값 부재를 확인한다. SDK가 event ID를 반환한 것만으로 수신 성공 판정하지 않는다.
2. **운영 안정성 권장:** source map/release와 sanitizer 보존 필드를 함께 검토한다. server 오류의
   안전한 원본 frame/고정 operation 분류, upload expected error 제외 및 서버 reporter 통일,
   script raw message 제한을 독립 concern으로 나눈다. 기존 privacy 회귀 테스트를 유지한다.
3. **운영 수집 검증:** 안전한 고유 event로 Docker stderr → agent → OCI Search를 확인한다.
   nested JSON 검색, 실제 tail 범위/보존/권한, host deploy output과 alert 전달을 별도로 확인한다.
   이어 request/release/event correlation을 작은 경계에서 도입한다.
4. **있으면 좋은 개선:** 광고 dev gate, full URL 최소화, 사용하지 않는 helper/부정확한 flush 주석 정리,
   의도적인 request summary/외부 호출 duration 측정. 미사용 검색만으로 일괄 삭제하지 않는다.
5. **지금은 하지 않아도 됨:** Pino 등 library, 세 runtime logger, Sentry Logs 전체 이관, 100% tracing,
   Replay, DB query 전체 로그, 독립 collector, 포괄적인 제품 audit 시스템. 실제 운영 요구 후 결정한다.

이번 검증 범위는 Git 기준 확인, tracked source/config/test 정적 조사, 설치된 SDK 코드와 공식 문서 대조다.
기존 M7 DATA 분석과 persistence/M9 결과는 과거 근거로 읽었고 현재 코드로 재확인했다.
`pnpm type-check/test/lint/build`나 DB/브라우저/운영 수신 실험은 의도적으로 실행하지 않았다.
실제 배포 환경 값·수신률·Sentry grouping·알림 작동·source map 해석·로그량·비용은 **코드베이스에서 확인 불가**다.
