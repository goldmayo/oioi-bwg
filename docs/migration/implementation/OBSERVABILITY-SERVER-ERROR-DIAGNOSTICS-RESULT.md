---
title: "Server error 진단 개선 결과"
document_id: "OBSERVABILITY-SERVER-ERROR-DIAGNOSTICS-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-09-20"
depends_on:
  - "OBSERVABILITY-AUDIT"
  - "OBSERVABILITY-SENTRY-SOURCEMAPS-RESULT"
related:
  - "03"
  - "09"
tags:
  - "observability"
  - "sentry"
  - "server-errors"
  - "privacy"
---

# Server error 진단 개선 결과

## 1. 범위

이번 변경은 audit에서 확인한 다음 두 server error 경계만 보정한다.

- `reportServerError`가 새 Error를 만들어 원래 오류 발생 stack frame을 잃는 문제
- 앨범 이미지 업로드 Server Action이 expected `AppError`까지 client용 shared Sentry reporter로 보내고
  server JSON error 경계를 우회하는 문제

tracing, request ID, user context, raw cause, application logger 확장, storage provider 응답 metadata는 포함하지
않는다.

## 2. 원래 발생 위치와 privacy 경계

`reportServerError`는 실제 `Error` 객체를 Sentry SDK의 `captureException`에 전달한다. SDK가 원본 stack을
해석해야 Sentry release/source map과 결합해 실제 발생 frame을 보존할 수 있기 때문이다. 문자열 등
non-Error throw는 기존처럼 고정 message의 새 Error로 정규화한다.

원본 Error를 application JSON log나 Sentry tag/context로 직렬화하지 않는다. 외부 transport 경계는
`sentry.server.config.ts`에 등록된 `sanitizeServerSentryEvent`이며, `beforeSend`에서 event를 새 allowlist
객체로 다시 만든다.

보존:

- 고정 event/source/operation/error type/error code
- 허용된 request method/router kind/route type
- release와 source map debug metadata
- 제한된 stack filename/function/line/column
- 유효한 trace ID

폐기:

- raw exception message와 cause chain
- request URL/body/header/cookie/token
- user/email/IP
- arbitrary extras/context/breadcrumb
- source context와 local variable

따라서 SDK process 내부에서는 frame 추출을 위해 원본 Error를 사용하지만 network로 전달하는 event는 기존
fail-closed privacy 정책을 유지한다. `beforeSend` 등록과 hostile event sanitization은 server reporter unit
test로 고정한다.

## 3. 앨범 이미지 업로드 Action

업로드 Action의 오류 분기는 다음과 같다.

```text
ZodError
→ 입력 validation message 반환
→ capture 안 함

AppError (UNAUTHENTICATED/FORBIDDEN 등)
→ generic upload failure 반환
→ expected application failure이므로 capture 안 함

그 외 unexpected failure
→ reportServerError
→ stderr JSON + Sentry
→ generic upload failure 반환
```

unexpected failure에는 다음 고정 분류만 붙인다.

- event: `upload.failure`
- source: `upload-album-image-action`
- operation: `album-image-upload`
- router kind: `App Router`
- route type: `action`

실제 R2 error, credential, object key, file name/body, provider response를 context나 tag로 전달하지 않는다.
오류가 request context 획득, file 처리, storage 호출 중 어디서 발생했는지 현재 경계만으로 확정할 수 없으므로
`storage` 같은 세부 error type을 추측해 붙이지 않고 `unknown`을 유지한다. 원래 frame으로 실제 발생 위치를
판별한다.

## 4. runtime 경계 정리

`src/shared/lib/sentry.ts`는 browser/client error reporter로 유지한다. Server Action은
`src/server/observability/server-logger.ts`를 사용하고, client source allowlist에서
`upload-album-image-action`을 제거했다. server sanitizer가 exception class 이름을 보고 upload event를
추론하던 호환 분기도 제거하고 명시적인 server tags만 신뢰한다.

## 5. 변경 파일

- `src/server/observability/server-logger.ts`: 원본 Error frame 보존, typed operation 기록
- `src/server/observability/safe-server-event.ts`: server operation allowlist와 sanitization
- `src/app/(admin)/admin/albums/_lib/upload-album-image-action.ts`: expected failure 제외 및 server reporter 사용
- `src/shared/lib/client-sentry-policy.ts`: server-only upload source 제거
- 관련 unit test: original Error identity, privacy projection, expected/unexpected upload 분기 검증

## 6. 검증

- `pnpm verify`: 성공
  - architecture harness 8개
  - unit test 55 files / 234 tests
  - ops test 3 files / 21 tests
- `pnpm build`: Next.js 16.3.3 Turbopack production build 성공, static page 22개 생성
- PR CI 결과는 PR에 기록한다.

## 7. 보류

다음 항목은 실제 필요성과 안전한 schema가 확정되기 전까지 넣지 않는다.

- raw request/cause/provider response
- route path와 user identifier
- R2 request ID, HTTP status, retry count
- 모든 server operation을 포괄하는 범용 logger abstraction
- tracing/span
