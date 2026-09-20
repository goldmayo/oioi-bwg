# Sentry Slack relay

이 디렉터리는 Sentry issue alert를 Slack Incoming Webhook으로 전달하는 독립 Cloudflare Worker다.
OCI의 Next.js application runtime, application Sentry SDK, GitHub Actions 배포 알림과 별도로 배포한다.

```text
Sentry new-issue alert
  → authenticated event_alert webhook
  → Cloudflare Worker
  → allowlisted Slack payload
  → Slack Incoming Webhook
```

Worker endpoint는 `POST /webhooks/sentry` 하나뿐이다. `Sentry-Hook-Signature`를 Internal
Integration Client Secret으로 HMAC-SHA256 검증하고 `Sentry-Hook-Resource: event_alert` 및
`action: triggered`만 처리한다. CORS와 `OPTIONS` 처리는 제공하지 않는다.

Slack에는 다음 값만 새 객체로 구성해 전달한다.

- environment: `local`, `staging`, `production`, 그 외 `unknown`
- level: Sentry의 고정 level 값
- 240자로 제한하고 email, URL, credential 표식을 제거한 issue title/message
- issue ID와 project ID
- event 경로와 query/hash를 제거한 `https://*.sentry.io/.../issues/<issue-id>/` 링크
- ISO 8601 발생 시각

Sentry payload의 user/email, request, headers, body, cookie/token, raw cause, arbitrary extras,
exception/전체 stack trace는 읽어서 Slack payload로 복사하지 않는다. application Sentry sanitizer가
첫 번째 privacy 경계이며 이 Worker는 Slack 전송 전 두 번째 allowlist 경계다.

`SLACK_DEPLOY_WEBHOOK_URL`은 OCI 배포 결과 알림 전용이다. 이 Worker는 Cloudflare Worker Secret인
`SLACK_SENTRY_WEBHOOK_URL`만 사용하며 GitHub Actions 또는 OCI application secret을 공유하지 않는다.

아래 번호는 설정 책임을 구분한다. 최초 설치의 실제 실행 순서는 Sentry Client Secret 의존성 때문에
**1 → 4 → 2 → 3 → 5 → 6**이다. Worker URL은 배포 전에도
`https://oioi-bwg-sentry-slack-relay.<Cloudflare account subdomain>.workers.dev`로 결정할 수 있다.

## 1. Slack App + Incoming Webhook 생성

1. Slack에서 이 용도의 App을 만들고 **Incoming Webhooks**를 활성화한다.
2. 오류 알림을 받을 채널에 App을 추가하고 Incoming Webhook URL을 발급한다.
3. URL은 비밀값으로 취급한다. 저장소, `wrangler.toml`, GitHub Secret, PR/issue, 셸 history에 넣지
   않는다.

Slack Incoming Webhook은 성공 시 HTTP 200을 반환한다. Worker는 Slack의 non-2xx 또는 800ms 내
응답 실패를 Sentry에 502로 돌려주며 Slack 응답 본문은 기록하지 않는다.

## 2. Worker secrets 등록

Cloudflare 계정에 Wrangler로 로그인한 뒤 이 디렉터리에서 대화형 입력을 사용한다.

```bash
cd workers/sentry-slack-relay
pnpm dlx wrangler@4.135.0 login
pnpm dlx wrangler@4.135.0 secret put SLACK_SENTRY_WEBHOOK_URL
pnpm dlx wrangler@4.135.0 secret put SENTRY_WEBHOOK_SECRET
```

- `SLACK_SENTRY_WEBHOOK_URL`: 1단계에서 발급한 Incoming Webhook URL
- `SENTRY_WEBHOOK_SECRET`: 4단계에서 확인하는 Sentry Internal Integration **Client Secret**

실제 값을 `.dev.vars`, `.env`, Wrangler vars에 복사하지 않는다. 두 이름은 `wrangler.toml`의 required
secret 선언에만 있고 값은 Cloudflare에만 저장한다. 테스트의 값은 외부 서비스에서 사용할 수 없는 fixture다.

## 3. Worker deploy

이 디렉터리에서 고정한 Wrangler 버전으로 배포한다.

```bash
pnpm dlx wrangler@4.135.0 deploy
```

출력된 `https://<worker>.<subdomain>.workers.dev` URL 뒤에 `/webhooks/sentry`를 붙인다. 배포 후
`GET`, `OPTIONS`, 잘못된 path가 각각 정상 메시지를 전달하는 endpoint로 동작해서는 안 된다.

Wrangler는 실행 시에만 `pnpm dlx`로 사용한다. root `package.json`, Next.js image, OCI runtime에는
Wrangler 또는 Cloudflare Worker runtime dependency를 추가하지 않는다.

## 4. Sentry Internal Integration/Webhook URL 설정

Sentry 조직의 **Settings → Developer Settings → Internal Integrations**에서 전용 integration을 만든다.

1. Webhook URL에 `https://<worker>.<subdomain>.workers.dev/webhooks/sentry`를 입력한다.
2. issue alert action을 사용할 수 있도록 integration의 alert rule action 기능을 활성화한다.
3. 생성된 **Client Secret**을 2단계의 `SENTRY_WEBHOOK_SECRET`으로 등록한다.
4. integration secret을 회전하면 Worker Secret도 즉시 같은 값으로 갱신하고 재검증한다.

Worker는 Client Secret으로 Sentry가 보낸 원문 body의 `Sentry-Hook-Signature`를 검증한다. 별도의
query parameter나 Bearer token을 Webhook URL에 넣지 않는다.

## 5. Sentry alert rule 연결

대상 project의 issue alert rule을 다음 원칙으로 설정한다.

1. 조건은 **새 issue가 생성된 경우**로 제한한다.
2. 필요한 경우 `staging`과 `production` rule/channel을 분리한다.
3. action으로 4단계의 Internal Integration을 선택한다.
4. 모든 event/occurrence마다 실행되는 조건이나 반복 interval action은 사용하지 않는다.

Worker 자체는 Sentry issue 상태나 중복 키를 저장하지 않는다. 알림 빈도와 new-issue 의미는 Sentry
alert rule이 소유한다. Sentry의 실패 재시도로 동일 alert가 다시 도착할 가능성은 있으므로 Slack을
감사 원장이나 정확히 한 번 전달되는 queue로 간주하지 않는다.

## 6. synthetic Sentry error → Worker → Slack E2E 검증

staging에서 기존 production 데이터나 사용자 입력을 사용하지 않는 synthetic error로 한 번 검증한다.

1. alert rule과 integration을 저장하고 Slack 채널을 비운 시각을 기록한다.
2. application의 기존 Sentry 테스트 절차 또는 승인된 일회성 staging 진단으로
   `TypeError: Cannot read properties of undefined (reading 'map')` 같은 privacy-safe 오류를 발생시킨다.
3. Sentry에서 새 issue, environment, project, 발생 시각을 확인한다.
4. Slack에서 같은 issue ID와 안전한 title/message 및 Sentry 링크가 한 번 전달됐는지 확인한다.
5. Slack payload에 user/email, request/body/header, cookie/token, cause/extras, stack trace가 없는지
   확인한다.
6. 테스트용 변경이나 임시 trigger를 제거하고, 기존 issue를 재발생시켰을 때 new-issue rule이 매
   occurrence마다 알리지 않는지 확인한다.

로컬 자동 검증은 repository root에서 실행한다.

```bash
pnpm exec vitest run --config vitest.ops.config.ts tests/ops/sentry-slack-relay.test.ts
pnpm dlx wrangler@4.135.0 deploy --dry-run \
  --cwd workers/sentry-slack-relay \
  --outdir /tmp/oioi-sentry-slack-relay
```

참고 문서:

- [Sentry webhook authentication](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/)
- [Sentry issue alert webhook](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issue-alerts/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
