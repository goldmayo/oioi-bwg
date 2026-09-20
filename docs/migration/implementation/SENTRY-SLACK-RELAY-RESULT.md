---
title: "Sentry 오류 알림 Slack relay 구현 결과"
document_id: "SENTRY-SLACK-RELAY-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-09-20"
depends_on:
  - "OBSERVABILITY-AUDIT"
  - "OBSERVABILITY-CLIENT-SENTRY-RESULT"
related:
  - "09"
tags:
  - "observability"
  - "sentry"
  - "slack"
  - "cloudflare-worker"
---

# Sentry 오류 알림 Slack relay 구현 결과

## 1. 범위와 기존 구조 조사

현재 application은 OCI에서 Next.js Node standalone으로 실행된다. 과거 application용
Vinext/Cloudflare Worker runtime과 Wrangler 의존성은 M1/M2에서 제거됐다. 현재 Cloudflare 사용은 R2
storage이고 Worker application runtime은 없다.

`.github/workflows/verify.yml`의 `SLACK_DEPLOY_WEBHOOK_URL`은 OCI image 게시·배포·rollback 결과를
알리는 GitHub Actions 전용 secret이다. 제품 오류 알림과 수명주기, 발신자, secret owner가 다르므로
재사용하지 않았다. 새 relay는 `workers/sentry-slack-relay`에 격리했고 root application dependency,
Next.js source, OCI image 및 workflow를 변경하지 않았다.

## 2. 설계 결과

```text
Sentry issue alert(new issue)
  → POST /webhooks/sentry
  → HMAC-SHA256(Client Secret) 검증
  → event_alert/triggered schema 검증
  → privacy allowlist projection
  → Slack Incoming Webhook
```

- Sentry 원문 body와 `Sentry-Hook-Signature`를 Web Crypto로 검증한다.
- POST 외 method와 다른 path를 거부하고 CORS/OPTIONS 처리를 만들지 않았다.
- `event_alert`의 `triggered` payload만 지원한다.
- Slack 객체는 environment, level, 정제된 title/message, issue/project ID, Sentry issue URL, 발생
  시각으로 새로 만든다.
- request/user/exception/extra 같은 원본 subtree는 Slack 객체에 spread하거나 serialize하지 않는다.
- title/message의 URL, email, credential 표식, token 형태를 다시 제거하고 Slack mrkdwn을 escape한다.
- Slack non-2xx/timeout은 502로 반환하고 status만 안전한 JSON event로 stderr에 남긴다.
- 발생 빈도는 상태 없는 Worker가 아니라 Sentry의 new-issue alert rule이 소유한다.

`SLACK_SENTRY_WEBHOOK_URL`과 `SENTRY_WEBHOOK_SECRET`은 `wrangler.toml`에서 required secret 이름만
선언한다. 실제 값은 Cloudflare Worker Secret으로 수동 등록하며 저장소·GitHub·OCI와 공유하지 않는다.

## 3. 변경 파일

- `workers/sentry-slack-relay/src/index.mts`: 인증, validation, privacy projection, Slack delivery
- `workers/sentry-slack-relay/wrangler.toml`: 독립 Worker entry와 required secret 이름
- `workers/sentry-slack-relay/README.md`: 6단계 수동 설치·배포·E2E runbook
- `tests/ops/sentry-slack-relay.test.ts`: 허용 필드, privacy, 인증, payload, Slack 실패, method 검증
- `.gitignore`: Worker local state 및 `.dev.vars` 유출 방지

## 4. 운영 경계와 보류 사항

Worker 배포, Cloudflare secret 등록, Slack App 생성, Sentry Internal Integration 및 alert rule 생성은
외부 계정 권한이 필요한 수동 작업이다. 실제 값과 배포 상태는 코드베이스에서 확인할 수 없다. 실행
절차와 E2E 판정 기준은 Worker README에 기록했다.

KV/Durable Object 기반 deduplication, Slack interactive action, 모든 occurrence 전달, Sentry raw payload
보관은 도입하지 않았다. Sentry의 전송 재시도 때문에 드문 중복은 가능하며 이는 정확히 한 번 전달을
보장하는 감사 시스템이 아니다.

## 5. 근거

- architecture `09-error-ux-observability.md`: unexpected error는 Sentry capture, raw personal data와
  secret은 observability payload에서 제외
- `OBSERVABILITY-CLIENT-SENTRY-RESULT.md`: application Sentry event의 allowlist sanitizer와 환경 정책
- [Sentry webhook authentication](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/)
- [Sentry issue alerts](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issue-alerts/)
- [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

## 6. 검증

- `pnpm verify`: 성공
  - architecture harness 8개
  - unit test 53 files / 223 tests
  - ops test 3 files / 15 tests. 이 중 relay test 6개
- `pnpm format:check`: 성공
- `pnpm build`: Next.js 16.3.3 production build 성공
- `workers/sentry-slack-relay`에서
  `pnpm dlx wrangler@4.135.0 deploy --dry-run --outdir /tmp/oioi-sentry-slack-relay-dry-run`:
  Worker bundle 생성 성공

실제 Cloudflare 배포와 Sentry→Worker→Slack E2E는 실행하지 않았다. 외부 계정 secret과 alert rule이
필요한 수동 검증이며 README 1~6단계에 절차를 분리했다.
