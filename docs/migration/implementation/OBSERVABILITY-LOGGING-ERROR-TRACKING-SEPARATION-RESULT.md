---
title: "Logging과 Error Tracking 책임 분리 결과"
document_id: "OBSERVABILITY-LOGGING-ERROR-TRACKING-SEPARATION-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-09-21"
depends_on:
  - "OBSERVABILITY-AUDIT"
  - "OBSERVABILITY-CLIENT-SENTRY-RESULT"
  - "OBSERVABILITY-SERVER-ERROR-DIAGNOSTICS-RESULT"
related:
  - "09"
tags:
  - "observability"
  - "logging"
  - "sentry"
  - "privacy"
---

# Logging과 Error Tracking 책임 분리 결과

## 1. 범위

이번 변경은 application logging과 Sentry error tracking의 의존 방향을 분리한다. 새 logging library,
log-level 환경변수, tracing, Replay, access/request logging, OCI 수집 pipeline 변경은 포함하지 않는다.

조사한 실제 producer는 다음 네 영역으로 분류된다.

| 영역 | 변경 전 producer | 역할 |
| --- | --- | --- |
| client application logging | `useAdWatcher.ts`의 `console.log` 2건 | 광고 감지 상태 진단 |
| server application logging | `server-logger.ts`의 JSON `console.error` | unexpected server error의 안전한 운영 event |
| Sentry error tracking | shared `logger.error`, `captureClientErrorOnce`, `reportServerError`, Next instrumentation/API/Auth/Upload boundary | unexpected exception과 contract violation capture |
| CLI / ops logging | PostgreSQL integration/migration/role/guard scripts의 `console.log/error` | 사람이 보는 진행 상태와 실패 출력 |

테스트의 console spy/mock는 producer 집계에서 제외했다. 독립 Cloudflare Worker relay의 JSON stderr는
Next.js application runtime 밖의 운영 integration이므로 이번 변경 대상에서 제외했다.

## 2. Before

Client shared Sentry utility가 `logger.error`라는 이름으로 Sentry capture와 local console 진단을 함께
수행했다. 호출부만 보면 application log인지 error tracking인지 구분하기 어려웠다.

Server의 `reportServerError`는 하나의 `server-logger.ts` 안에서 allowlisted JSON stderr를 기록한 뒤
Sentry SDK를 호출했다. 이 때문에 logger 자체가 Sentry runtime 설정과 SDK에 의존했다.

```text
client logger.error
├─ local console
└─ Sentry

server reportServerError
├─ JSON stderr
└─ Sentry
```

## 3. After

```text
Browser diagnostics
  clientLogger
      ↓
  local console only

Server application log
  logServerError
      ↓
  allowlisted JSON stderr
      ↓
  Docker → OCI Logging

Error tracking
  captureClientException / captureServerException
      ↓
  Sentry

CLI / Ops
      ↓
  existing console stdout/stderr
```

`clientLogger`는 `NEXT_PUBLIC_APP_ENV`가 정확히 `local`일 때만 문자열 message를 console에 출력한다.
staging, production, 값이 없는 환경에서는 fail closed로 출력하지 않는다. Sentry SDK를 import하거나
exception/message/breadcrumb를 만들지 않는다.

`logServerError`는 기존 privacy allowlist와 JSON schema를 유지하면서 stderr만 담당한다.
`captureServerException`은 Sentry SDK와 안전한 tag만 담당한다. 두 sink는 서로 import하지 않는다.
`reportServerError`는 unexpected server error boundary에서 두 sink를 명시적으로 조합하는 coordinator다.

## 4. 호출 흐름

Server unexpected error:

```text
unexpected error
    ↓
API / Auth / Upload / Next instrumentation boundary
    ↓
reportServerError coordinator
    ├─ logServerError → safe JSON stderr → Docker → OCI
    └─ captureServerException → beforeSend sanitizer → Sentry
```

Client debug event:

```text
useAdWatcher
    ↓
clientLogger.debug
    ↓
local browser console only
```

Client unexpected error:

```text
Error Boundary / Query cache / Login mutation
    ↓
captureClientErrorOnce 또는 captureClientException
    ↓
client beforeSend sanitizer
    ↓
Sentry
```

## 5. Privacy와 변경하지 않은 항목

Server log는 raw Error/cause, SQL parameter, DB row, request body/header, cookie/token, email을 직렬화하지
않는다. 고정 event/source/operation, safe error type/code, 제한된 request method/router kind/route type만
기록한다.

다음은 변경하지 않았다.

- client/server Sentry `beforeSend` privacy sanitizer
- Sentry alert용 Cloudflare Worker와 Slack relay
- source map/release upload
- tracing과 Replay의 미도입 상태
- Docker/OCI log collection 구성
- PostgreSQL migration, integration, role, local DB guard script의 console 출력

## 6. 검증 기준

- local browser에서는 `clientLogger.debug/info/warn/error`가 각 console method로 출력된다.
- staging/production과 환경값 누락 시 client logger는 출력하지 않는다.
- client logger 호출은 Sentry event를 생성하지 않는다.
- server logger는 기존 allowlisted JSON error를 유지하고 Sentry event를 생성하지 않는다.
- server Sentry reporter는 application log를 쓰지 않고 원본 Error frame과 typed metadata를 capture한다.
- coordinator만 두 독립 sink를 함께 호출한다.
- 기존 Sentry sanitizer의 fail-closed projection test를 유지한다.
- script/CLI 파일에는 변경을 가하지 않는다.

실행 결과:

- 관련 unit test: 9 files / 37 tests 성공
- `pnpm verify`: architecture harness 8개, unit 57 files / 240 tests, ops 3 files / 21 tests 성공
- `pnpm build`: Next.js 16.3.3 production build 및 static page 22개 생성 성공
- `pnpm format:check`: 성공
- `git diff -- scripts`: 변경 없음

## 7. 보류

- Pino/Winston 또는 다른 structured logging library
- server info/warn/debug event 확대와 `LOG_LEVEL`
- Sentry Logs와 `captureMessage` 기반 logging
- request/access logging과 request ID
- tracing, Replay, OCI Logging pipeline 변경
- CLI logger abstraction
- client/server/script를 하나로 묶는 공통 logger interface
