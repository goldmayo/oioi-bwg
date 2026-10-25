# Sentry Slack relay

이 디렉터리는 Sentry issue alert를 Slack Incoming Webhook으로 전달하는 독립 Cloudflare Worker다.
OCI의 Next.js application runtime, application Sentry SDK, GitHub Actions 배포 알림과 별도로 배포한다.
private `@oioi-bwg/sentry-slack-relay` workspace가 소스·Node unit/type/lint를 소유한다. root의 unit/coverage와
Turbo 검증에서 한 번씩 수집하며 Web alias·browser 환경·Next build를 사용하지 않는다. 기존 handler와
Wrangler 설정·Worker 이름/URL·secret은 경로 이관으로 바뀌지 않는다. 실제 Worker 배포는 별도 승인 사항이다.

```bash
pnpm --filter @oioi-bwg/sentry-slack-relay type-check
pnpm --filter @oioi-bwg/sentry-slack-relay lint
pnpm --filter @oioi-bwg/sentry-slack-relay test
```

기존 `workers/` 아래 개인 `.dev.vars`·로컬 상태는 자동 이동하지 않는다. 필요할 때 소유자가 보호된 값을
직접 준비하며 추적 소스 이관이나 로컬 unit 검사에 실제 secret이 필요하지 않다.

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

- environment: `local`, `production`, 그 외 `unknown` (이전 `staging` 값 포함)
- level: Sentry의 고정 level 값
- 240자로 제한하고 email, URL, credential 표식을 제거한 issue title/message
- issue ID와 project ID
- event 경로와 query/hash를 제거한 `https://*.sentry.io/.../issues/<issue-id>/?project=<validated-project-id>` 링크
- ISO 8601 발생 시각
- 선택적 `app` tag: `web`, `console`
- 선택적 `failure.kind` tag: `contract`, `delivery`, `system`, `unknown`
- 선택적 release: `oioi-bwg@<소문자 40자리 Git SHA>`

Sentry payload의 user/email, request, headers, body, cookie/token, raw cause, arbitrary extras,
exception/전체 stack trace는 읽어서 Slack payload로 복사하지 않는다. application Sentry sanitizer가
첫 번째 privacy 경계이며 이 Worker는 Slack 전송 전 두 번째 allowlist 경계다.

## 알림 표시

오류 제목은 [Slack rich text link](https://docs.slack.dev/reference/block-kit/block-elements/link-element/)로
굵게 표시하고 누르면 검증된 Sentry 이슈로 이동한다. 제목과 URL을 별도 필드로 보내므로 문구의 `|`,
backtick, mention 표기가 링크 문법이나 실제 mention으로 해석되지 않는다.
title과 같은 내용이거나 `오류 타입: message`의 반복인 message는 생략한다. 별도의 진단 내용은 본문에
유지하며 제목이 150자를 넘으면 Unicode를 끊지 않고 줄인다. 기존 240자 제한의 전체 정제 제목은
알림/스크린 리더용 fallback에 유지한다. 150자는 간결한 표시를 위한 자체 기준이며 rich text의 API 한도가 아니다.
진단 본문은 `plain_text`로 보내 임의 markup을 실행하지 않는다.

설명 아래에 `environment: production`, `level: error` 같은 값을 표시하고, 유효한 `app`, `kind`, `release`를
inline code 값으로 묶는다. `app`/`failure.kind`는 event의 tuple 배열 tags에서 해당 key가 한 번만
나오고 위 enum과 일치할 때만 사용한다. 누락·중복·형식 오류는 추정해서 채우지 않고 생략한다.
다른 시스템의 임의 `kind`나 raw URL·사용자 정보·함수명·경로를 추가로 가져오지 않는다.

release는 `event.release` 문자열 또는 `event.release.version`에서 정해진 형식만 읽는다.
본문에는 SHA 앞 12자, fallback에는 전체 release를 남긴다. Worker의 Git HEAD·현재 배포 SHA로 대체하지 않는다.
일반 제목/설명 redaction으로 release를 우회 전달하지 않고 별도 검증된 필드만 사용한다.
앱 producer가 아직 전달하지 않는 값은 표시되지 않는다. 이 Worker 변경은 앱의 Sentry 수집 코드를 수정하지 않는다.

발생 시각은 [Slack 날짜 형식](https://docs.slack.dev/messaging/formatting-message-text/#date-formatting)으로
보는 사람의 기기 시간대에 표시한다. 해석하지 못하는 client에는 UTC가 명시된 fallback을 제공한다.
숫자 project/issue ID는 본문에서 빼고 검증된 상세 링크에 유지한다. `Sentry에서 보기` 버튼으로 이동한다.
불필요한 링크 preview는 끄고 위 진단 정보·제목·추가 메시지·시각·링크는 top-level fallback에도 남긴다.
이 relay의 action은 이슈 열기다. Resolve·Archive·담당자 선택은 공식 Sentry Slack 연동의 관리 기능이며,
이번 형식에 동작하지 않는 관리 버튼이나 새 관리 API/token을 넣지 않는다.

화면의 `SLACK_SENTRY_WEBHOOK_URL` 발신자 이름과 아이콘은 payload로 바꿀 수 없다.
[Incoming Webhook 규격](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/)에 따라
기존 Slack 앱 설정의 표시 이름·아이콘을 바꾼다. 예를 들어 이름은 `바위게 오류 알림`으로 정할 수 있다.
이 코드 변경은 Slack 앱 설정을 수정하지 않으며 Worker를 별도로 배포한 뒤 새 알림부터 적용된다.

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
[Sentry webhook 규격](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/)의
1초 응답 요구 때문에 800ms를 유지한다. 전체 요청의 1초 완료를 보장하는 것은 아니다.
Slack 지연/timeout에는 전달 여부가 불명확하거나 재시도 중복이 생길 수 있다.
3~5초를 기다리려면 durable queue와 별도 재시도 정책을 함께 설계해야 하므로 이번 범위에서 보류한다.

body는 Content-Length 사전 검사와 실제 stream byte 누적 제한(1,000,000 bytes)을 모두 적용한다.
길이 헤더가 없거나 작게 기재돼도 초과 chunk에서 읽기를 취소하며 HMAC은 수신 원본 bytes를 검증한다.

## 2. Worker secrets 등록

최초 배포는 4단계에서 Client Secret을 확보한 뒤 두 secret을 함께 업로드한다.
`secret put`으로 빈 Worker를 bootstrap하는 동작에 의존하지 않는다.

- `SLACK_SENTRY_WEBHOOK_URL`: Slack Incoming Webhook URL
- `SENTRY_WEBHOOK_SECRET`: Sentry Internal Integration **Client Secret**

### 환경변수 책임

relay runtime 입력은 아래 **Worker Secret 두 개**다. 일반 `vars`나 `.env` 입력은 필요하지 않다.

| 입력                       | 소유자·용도                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `SENTRY_WEBHOOK_SECRET`    | Worker Secret. Sentry Internal Integration의 Client Secret으로 HMAC 검증 |
| `SLACK_SENTRY_WEBHOOK_URL` | Worker Secret. 오류 알림 전용 Slack Incoming Webhook                     |

`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_SENTRY_DSN`은 Web/Console이 소유한다. `SENTRY_ORG`,
`SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `SENTRY_SOURCE_MAPS_ENABLED`, `SENTRY_RELEASE`는 앱의
Sentry build/release 설정이며 relay에 복사하지 않는다. GitHub 배포 알림의
`SLACK_DEPLOY_WEBHOOK_URL`도 별도 소유다. 환경·app·failure kind·release 표시는 검증된 **event**에서 읽는다.

2026-10-25 실제 Worker settings/secret 이름·타입 조회에서도 위 두 `secret_text`만 확인했고 일반
binding은 없었다. 값·계정 정보는 기록하지 않았으며 변경·삭제·회전을 수행하지 않았다.
감사와 현재 앱 태그 정책은 [결과 §13](../../docs/migration/implementation/SENTRY-SLACK-RELAY-RESULT.md#13-2026-10-25-서비스-태그와-relay-환경-감사)를 따른다.
앱/패키지/Worker 이름은 현재 역할을 유지하고, 여러 알림 채널로 확장할 실제 요구가 생기면 별도 검토한다.

## 3. Worker deploy

### 최초 설치

이 디렉터리에서 로그인한 뒤 아래 Python 예제를 실행한다. Python 3가 필요하다.
저장소 밖 `/tmp`에 mode 600 임시 JSON 파일을 만들고, 숨김 입력으로 값을 받은 뒤
첫 deploy에 `--secrets-file`로 전달한다. 성공·실패·일반적인 중단 시 파일은 제거된다.
강제 종료/호스트 장애 시 남은 `/tmp/sentry-relay-*` 디렉터리는 직접 삭제한다.
secret 값은 명령 인자, shell history, GitHub, Wrangler vars에 기록하지 않는다.

```bash
cd apps/sentry-slack-relay
pnpm dlx wrangler@4.135.0 login
python3 - <<'PYTHON'
import getpass
import json
import os
import subprocess
import tempfile

with tempfile.TemporaryDirectory(prefix="sentry-relay-", dir="/tmp") as directory:
    path = os.path.join(directory, "secrets.json")
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as file:
        secrets = {
            name: getpass.getpass(name + ": ")
            for name in ("SLACK_SENTRY_WEBHOOK_URL", "SENTRY_WEBHOOK_SECRET")
        }
        if not all(secrets.values()):
            raise SystemExit("Both secrets are required")
        json.dump(secrets, file)
    subprocess.run([
        "pnpm", "dlx", "wrangler@4.135.0", "deploy", "--secrets-file", path
    ], check=True)
PYTHON
```

### 기존 Worker 코드 업데이트

기존 연동이 설정되어 있다면 최초 설치나 secret 등록을 반복하지 않는다. 배포할 코드가 있는 checkout의
저장소 루트에서 시작한다. 아래 상태·기록을 확인하고 다른 작업의 checkout이면 배포를 멈춘다.
이번 알림 디자인의 코드 ref와 배포 대기 상태는
[결과 문서 §10](../../docs/migration/implementation/SENTRY-SLACK-RELAY-RESULT.md#10-2026-10-22-사용자-수동-배포-대기)을 따른다.

```bash
git status --short --branch
git log -1 --oneline
cd apps/sentry-slack-relay
pnpm dlx wrangler@4.135.0 whoami
pnpm dlx wrangler@4.135.0 deploy --keep-vars
```

`whoami`에서 기존 `oioi-bwg-sentry-slack-relay`가 있는 Cloudflare 계정인지 확인한다. 로그인하지
않았다면 `pnpm dlx wrangler@4.135.0 login` 뒤 다시 확인한다. `--keep-vars`는 대시보드의 일반
변수를 보존하고, 기존 두 Worker secret도 다시 입력하거나 회전하지 않는다. Worker 이름·계정을
유지하면 기존 `/webhooks/sentry` 주소와 Sentry integration·Slack webhook을 재설정할 필요가 없다.

배포 출력의 version ID·시각을 기록하고 아래 6절에 따라 새 알림의 제목 링크·표시·개인정보 제거를
확인한다. 새 형식은 이후 수신하는 알림에 적용되며 과거 Slack 메시지는 바뀌지 않는다. 기존 issue의
재발생은 new-issue rule의 수신 검증이 아니므로 별도 승인 후 test notification 또는 안전한 새 production issue를 사용한다.
배포 성공과 실제 Slack 수신은 따로 기록한다. OCI 앱 배포·Promotion은 이 Worker 업데이트에 필요하지 않다.

### 기존 secret 회전

secret 회전이 별도로 필요한 경우에만 대화형 입력으로 수행한다.

```bash
pnpm dlx wrangler@4.135.0 secret put SLACK_SENTRY_WEBHOOK_URL
pnpm dlx wrangler@4.135.0 secret put SENTRY_WEBHOOK_SECRET
```

required secret 선언은 그대로 유지한다. 실제 `.dev.vars`, `.env`나 repository 파일에 값을 저장하지 않는다.

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
2. 앱의 운영 environment는 `production`이다. 별도 staging 환경이나 rule/channel을 새로 만들지 않는다.
3. action으로 4단계의 Internal Integration을 선택한다.
4. 모든 event/occurrence마다 실행되는 조건이나 반복 interval action은 사용하지 않는다.

Worker 자체는 Sentry issue 상태나 중복 키를 저장하지 않는다. 알림 빈도와 new-issue 의미는 Sentry
alert rule이 소유한다. Sentry의 실패 재시도로 동일 alert가 다시 도착할 가능성은 있으므로 Slack을
감사 원장이나 정확히 한 번 전달되는 queue로 간주하지 않는다.

## 6. synthetic Sentry error → Worker → Slack E2E 검증

별도 승인된 운영 검증에서 기존 데이터나 사용자 입력을 사용하지 않는 synthetic error로 한 번 검증한다.
로컬 개발·build·자동 검증은 앱 환경 local이며 실제 Sentry/Slack 전송을 하지 않는다.

1. alert rule과 integration을 저장하고 Slack 채널을 비운 시각을 기록한다.
2. application의 기존 Sentry 테스트 절차 또는 승인된 일회성 production 진단으로
   `TypeError: Cannot read properties of undefined (reading 'map')` 같은 privacy-safe 오류를 발생시킨다.
3. Sentry에서 새 issue, environment, project, 발생 시각을 확인한다.
4. Slack에서 같은 issue ID와 안전한 title/message 및 Sentry 링크가 한 번 전달됐는지 확인한다.
5. Slack payload에 user/email, request/body/header, cookie/token, cause/extras, stack trace가 없는지
   확인한다.
6. 테스트용 변경이나 임시 trigger를 제거하고, 기존 issue를 재발생시켰을 때 new-issue rule이 매
   occurrence마다 알리지 않는지 확인한다.

로컬 자동 검증은 repository root에서 실행한다.

```bash
pnpm --filter @oioi-bwg/sentry-slack-relay test
pnpm dlx wrangler@4.135.0 deploy --dry-run \
  --cwd apps/sentry-slack-relay \
  --outdir /tmp/oioi-sentry-slack-relay
```

참고 문서:

- [Sentry webhook authentication](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/)
- [Sentry issue alert webhook](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issue-alerts/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
