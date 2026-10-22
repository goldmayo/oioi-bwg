---
title: "Sentry 오류 알림 Slack relay 구현 결과"
document_id: "SENTRY-SLACK-RELAY-RESULT"
version: "1.3"
status: "completed"
authority: "result"
updated_at: "2026-10-22"
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
외부 계정 권한이 필요한 수동 작업이다. 실제 secret 값과 외부 계정 설정은 코드베이스에서 확인할 수
없으며 저장소에도 기록하지 않는다. 실행 절차와 E2E 판정 기준은 Worker README에 기록했다.

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

PR #93 구현·리뷰 검증 뒤 사용자가 README 1~6단계를 따라 Cloudflare Worker 배포, 두 Worker Secret,
Sentry Internal Integration과 staging new-issue alert rule을 설정했다. Sentry의 test notification이
Slack에 도착했고, staging browser에서 privacy-safe `ReferenceError`를 발생시켜 새 Sentry issue가
생성된 뒤 Worker를 거쳐 Slack 알림이 도착하는 E2E를 확인했다. 관찰된 전달 지연은 약 1분이었다.

같은 issue를 다시 발생시켰을 때 Sentry event 수는 증가했지만 Slack 알림은 반복되지 않았다. 이는 모든
occurrence가 아니라 new-issue alert를 전달하도록 한 설계와 일치한다. 이 외부 검증은 사용자가 실제
Sentry와 Slack 화면에서 확인한 결과이며 secret 값, webhook URL 원문, 원본 event payload는 저장소에
기록하지 않았다.

## 7. PR #93 리뷰 후 보완

초기 head `507095d` 리뷰에 따라 최초 배포를 임시 mode 600 secrets JSON과
`wrangler deploy --secrets-file`로 안내하도록 수정했다. 상세 운영 절차는 Worker README가 소유한다.
README 예제는 가짜 숨김 입력과 subprocess mock으로 권한·인자·임시 파일 제거를 확인했다.
실제 fresh account 배포 성공을 의미하지는 않는다.

Sentry issue URL은 기존 query/hash/event 경로를 제거한 뒤 검증된 project ID 하나만
`?project=...`로 추가한다. body 제한은 전체 text 로딩 후 검사에서 stream 읽기 중 byte 제한으로
변경했다. Content-Length는 사전 거부에만 사용하며 실제 길이를 신뢰하지 않는다.
HMAC은 decode/re-encode 없이 원본 bytes를 검증한다.

Slack timeout 800ms는 유지했다. Sentry 공식 webhook 문서의 1초 응답 요구와 충돌하므로
동기 handler에서 단순히 3~5초로 늘리지 않았다. queue 및 전달 재시도 정책은 별도 설계 사항이다.

회귀 테스트는 project scope, 길이 헤더 없음/허위/초과, stream cancel, 정확한 1 MB 경계와
멀티바이트 body, stream 읽기 실패를 포함한다.

보완 후 `pnpm verify`(unit 223개, ops 20개 중 relay 11개), `pnpm format:check`,
`pnpm build`, Worker Wrangler dry-run이 모두 성공했다. 이후 위 6절의 실제 배포와 E2E도 완료했다.

## 8. 2026-10-22 알림 본문 개선 — 새 형식의 배포·수신은 미확인

사용자가 제공한 모바일 화면의 title/message 반복과 세로로 긴 metadata를 보완했다.
최신 `origin/migration_main`과 실제 원격이 일치한 `4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`에서
`feature/sentry-slack-message-layout`을 분기했다. P1-A의 `56c2506`과 모노레포 설정 정리는 섞지 않았다.
[관측성 계획 v1.1 §11](https://github.com/goldmayo/oioi-bwg/blob/dd2b41f1e03a2e29d43f98badabb283d0c595986/docs/migration/implementation/OBSERVABILITY-ERROR-TRACKING-PLAN.md)의
분류 확장·알림 규칙·소스맵 검증과 별개로, 기존 허용 필드의 표시만 먼저 다룬 단위다.

- 오류 제목 → 환경/심각도 → 필요할 때만 추가 메시지 → 발생 시각/상세 버튼 순서다.
  같은 메시지는 반복하지 않으며 project/issue 숫자는 상세 링크에 유지한다.
- 제목은 Slack header의 150자 한도를 지키고 surrogate pair를 끊지 않는다. 기존 240자 한도의 정제된
  전체 제목과 주요 정보는 top-level fallback에 남긴다. raw input의 수집 범위는 늘리지 않았다.
- 날짜 token은 기기 시간대를 사용하며 fallback은 UTC를 명시한다. 고정 event 이름·발신자·아이콘을
  꾸며 만들지 않는다. Slack 앱 표시 이름 설정과 현재 형식은 Worker README가 소유한다.
- Worker의 HMAC·원본 byte 검증·body 제한·800ms timeout·상태 없는 전달과 secret 경계는 그대로다.
  기존 ESM Worker `.mts`를 유지했으며 새 dependency·설정·범용 formatter package는 추가하지 않았다.

기존 테스트는 11건이며 새 회귀는 중복/추가 메시지, header 한도와 한글/emoji, unknown 환경·level,
시각 token·상세 URL·알림 fallback을 포함한다. 아래 검증은 이 단위에서 새로 실행한 결과만 기록한다.

로컬 preview는 가상 오류 3개를 실제 서명/handler에 통과시켜 fake Slack fetch가 받은 JSON으로 만들었다.
Playwright에서 390px/1120px와 light/dark 네 조합을 캡처하고 가로 넘침이 없음을 확인했다.
이는 실제 Slack renderer/수신 증거가 아니다. payload와 preview는 `.local/observability/slack-layout/`에 있다.
UI detector는 Worker 소스에서 0건이며 Block Kit 규격 검증을 대신하지 않는다.

| 이번 단위의 실제 검사 | 결과 |
| --- | --- |
| `vitest run --config vitest.ops.config.ts tests/ops/sentry-slack-relay.test.ts` | 변경 전 11건, 변경 후 21건 성공 |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 12 task 성공, 9개 캐시. unit 81파일·410건 성공 |
| `pnpm type-check:repo`, `pnpm lint:repo` | 성공. Worker도 타입 검사 대상이며 최종 lint 경고 없음 |
| workspace lint가 실행한 양쪽 `lint:fsd` | 성공 |
| `pnpm test:harness` | 기준선의 18건 성공 |
| `pnpm test:ops` | 21파일·272건 성공 |
| `pnpm build --force --env-mode=loose` | 두 앱 컴파일·타입 검사·정적 생성·standalone 구성 성공, 2 task·캐시 0개 |
| README의 Wrangler 4.135.0 dry-run | 최종 Worker bundle 생성 성공, `--dry-run: exiting now`로 종료 |
| `pnpm format:check`, `git diff --check` | 성공 |

긴 제목의 본문 보존과 fallback 중복 제거를 나눠 점검하고 최종 타입/lint/ops/Worker bundle을 다시 확인했다.
그 전후 가상 오류 3개의 최종 payload는 byte 단위로 같아 위 preview가 유효함을 확인했다.
검증한 Worker blob은 `aa963e696a73846fbe64948d805eba8f22e7c552`,
ops test blob은 `86e961ddba8a3896d250385f980429ce454695da`이며 이 결과를 포함한 커밋이 변경 범위다.
P1-A의 추가 회귀는 별도 미병합 branch에 있으므로 이 기준선 unit 대상은 410건이다.

앱 build는 source map upload·Sentry 전송을 끈 local 입력, loopback origin, 임시 Console secret과
접근 불가한 loopback DB URL을 사용했다. 개인 env·DB volume·MFA key를 수정하지 않았고 실제 앱 DB
조회/CRUD·관리자 E2E·원격 Sentry/Slack 조회/전송·VM/Vault 변경도 하지 않았다.

commit/push 대상은 위 코드·test와 README·이 결과의 네 파일이다. 새 PR·배포·알림 전송은 보류한다.
기존 §6의 수신 성공을 새 형식의 수신 결과로 재사용하지 않는다. P1-B 인증 UX, 신규 분류 전달,
Slack 규칙과 원격 소스맵 검증도 이 표시 변경에 합치지 않았다.
