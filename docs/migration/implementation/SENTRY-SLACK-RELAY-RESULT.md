---
title: "Sentry 오류 알림 Slack relay 구현 결과"
document_id: "SENTRY-SLACK-RELAY-RESULT"
version: "1.6"
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

**현재 상태: 2026-10-22 새 알림 형식의 Worker 배포·실제 Slack 수신 완료.**
현재 판정은 §11이 소유하며, §8~10의 미배포·사용자 수동 배포 대기는 당시 기록으로 보존한다.

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

## 9. 2026-10-22 제목 링크와 핵심 진단 태그 — 코드 완료, 미배포

사용자가 추가한 Sentry 공식 연동 형태의 예시와 적용 요청에 따라 같은 branch에 새 변경을 쌓았다.
시작 HEAD·origin·실제 원격은 모두 `fd114097baff4dcaf0cb2324941cb70215b4271f`였고 작업 트리는 깨끗했다.
`migration_main`은 계속 `4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`였다. §8은 `fd11409` 당시의
검증 기록으로 보존하며 아래 결과를 이전 단위의 검증으로 소급하지 않는다.

- 제목을 굵은 Sentry 이슈 링크로 바꿨다. Slack `rich_text`의 link element를 사용해 URL과 표시 문구를
  분리했다. `|`, backtick, `<@…>` 같은 문구가 새 링크/mention으로 파싱되지 않는 회귀를 추가했다.
- 추가 설명이 있을 때만 본문을 남기고 그 아래 환경·level·선택적 app/kind/release를 inline code로 묶었다.
  제목의 150자 표시는 읽기 위한 자체 기준으로 유지하고 전체 정제 제목은 fallback에 보존한다.
- `app`은 web/console, `failure.kind`는 contract/delivery/system/unknown만 읽는다. tuple 배열에서
  key가 중복되거나 형태·값이 잘못되면 생략한다. 다른 app 이름·임의 kind·surface·URL·사용자 정보는 읽지 않는다.
- release는 문자열 또는 release object의 version에서 기존 `oioi-bwg@<소문자 SHA 40자>`만 허용한다.
  본문에는 SHA 12자, 알림/스크린 리더 fallback에는 전체 release를 남긴다. Git HEAD로 추측하지 않는다.
- 앱의 Sentry producer/sanitizer는 바꾸지 않았다. 실제 event가 전달하지 않은 선택 값은 표시하지 않는다.
  P1-A/P2의 구현·배포나 실제 원격 metadata 수신이 완료됐다는 뜻이 아니다.
- Resolve/Archive/담당자 변경은 공식 연동의 기능이다. 이번 relay는 이슈 열기만 제공하며 관리 API·token·
  인터랙션 endpoint나 동작하지 않는 관리 버튼을 추가하지 않았다. HMAC·timeout·body·secret 경계도 유지했다.

표시와 입력 계약의 현재 안내는 Worker README가 소유한다. 새 프로젝트 문서·범용 telemetry abstraction,
dependency나 config 변경은 추가하지 않았다. 모노레포 정리·인증 UX·알림 규칙·소스맵 gate는 별도다.

| 이번 단위의 실제 검사 | 결과 |
| --- | --- |
| relay 단독 Vitest | 변경 전 21건, 변경 후 29건 성공 |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 12 task 성공, 12개 캐시. 기존 unit 81파일·410건 대상 |
| `pnpm type-check:repo`, `pnpm lint:repo` | 새 Worker 타입 검사와 repo lint 성공, 경고 없음 |
| workspace lint의 양쪽 `lint:fsd` | 위 캐시 결과에 포함 |
| `pnpm test:harness` | 18건 성공 |
| `pnpm test:ops` | 21파일·280건 성공 |
| `pnpm build --force --env-mode=loose` | 두 앱 컴파일·타입 검사·정적 생성·standalone 구성 성공, 2 task·캐시 0개 |
| README의 Wrangler 4.135.0 dry-run | Worker bundle 생성 성공, 업로드/배포 없이 종료 |
| `pnpm format:check`, `git diff --check` | 성공 |

검증한 Worker blob은 `ca52ab8776ed3c7ffcdbd9148c46c816ff495d61`,
test blob은 `1808ec5d72784e697f437d1d48d64819269abcc4`이며 이 절을 포함한 커밋이 변경 범위다.
실행 로그·서명한 가상 event·fake fetch가 받은 최종 JSON·로컬 모형은 `.local/observability/slack-linked/`에 있다.
Playwright로 390px/1120px, light/dark를 한 번에 캡처해 가로 넘침이 없음을 확인했다.
추가 태그 예시는 가상 값으로 명시했다. detector 0건은 규격/실제 Slack renderer 검증을 대신하지 않는다.

앱 build 입력은 source map upload·Sentry를 끈 local 환경, loopback origin, 임시 Console secret과
접근 불가 loopback DB URL이었다. 개인 env·MFA key·DB volume·운영 DB/VM/Vault는 수정하지 않았다.
실제 앱 DB/관리자 E2E·Slack 앱 설정·이슈 상태 변경·외부 알림 전송·Worker 배포·새 PR 생성은 하지 않았다.
실제 채널의 새 형식과 metadata 수신은 별도 배포 뒤 확인해야 한다.

branch 누적 diff의 400줄 목표 초과는 같은 알림 표시의 두 단위와 privacy 회귀·역사 기록을 함께
검토하기 위한 것이다. 리뷰 순서는 README 입력/표시 계약 → Worker → ops 회귀 → §8/§9 결과다.

## 10. 2026-10-22 사용자 수동 배포 대기

사용자가 집에서 직접 배포하기로 하여 새 알림 디자인의 배포를 보류했다. 구현 완료와 외부 적용을
구분하며, 배포·새 형식의 수신 증거가 기록될 때까지 후속 작업 브리핑에 **Sentry 알림 디자인: 미배포**를
계속 표시한다. 이는 대화 중 브리핑 요청이며 정해진 시각의 자동 알림을 설정한 기록은 아니다.

- [x] 코드·로컬 검증·commit/push: `feature/sentry-slack-message-layout`의
  `f085fdbe5363b7b1aacec93a496c76e02a319a79`. 이번 기록 전 HEAD·원격 추적 ref·실제 원격이
  모두 같고 작업 트리가 깨끗함을 재확인했다. §9의 검증을 이번 문서 변경에서 재실행한 결과로 쓰지 않는다.
- [ ] 사용자가 기존 Cloudflare Worker `oioi-bwg-sentry-slack-relay` 업데이트
- [ ] 배포한 코드 ref·Worker version ID·배포 시각 기록
- [ ] 새 Sentry 테스트 알림 또는 안전한 staging 새 issue의 Slack 수신·제목 링크·표시 확인

현재 코드가 있는 checkout은
`/home/hsj95/.codex/worktrees/observability-error-tracking/cheer-rock-crab`이다.
기본 checkout의 `feature/monorepo-configuration-cleanup`에는 이 알림 변경이 없으므로 그 경로에서
배포하지 않는다. 다른 PC에서는 위 원격 작업 branch의 코드를 먼저 확보하고 배포 대상 ref를 확인한다.

실행 명령과 기존 secret·일반 변수 보존 방법은
[Worker README의 기존 Worker 코드 업데이트](../../../workers/sentry-slack-relay/README.md#기존-worker-코드-업데이트)가
소유한다. 최초 설치·secret 회전·Sentry 규칙 재생성은 이번 코드 업데이트에 필요하지 않다.
실제 배포나 외부 알림 전송은 이 기록을 작성하면서 실행하지 않았다. 문서만 수정했으므로 앱 build·
타입·lint·test는 별도로 재실행하지 않으며 commit/push hook이 실행한 검사는 해당 실행 결과로 구분한다.

다음 관측성 구현 단위는
[관측성 계획 §7의 P1-B](https://github.com/goldmayo/oioi-bwg/blob/dd2b41f1e03a2e29d43f98badabb283d0c595986/docs/migration/implementation/OBSERVABILITY-ERROR-TRACKING-PLAN.md#7-구현-checkpoint와-예상-변경-위치)다.
Console의 정상 인증 거부가 실제 로그인 이동/403 UX로 처리되는지와 탈출한 예외의 수집을 다룬다.
별도 branch의 P1-A `56c2506`은 코드·검증 완료이나 미병합이므로 다음 단위에 들어가기 전 최신
`migration_main`과 선행 변경 포함 여부를 재확인한다. 이번 Worker 배포 대기와 별개이며 아직 착수하지 않았다.

## 11. 2026-10-22 새 알림 형식 배포와 실제 수신 완료

사용자가 기존 배포 보류를 해제하고 Slack Worker 배포와 테스트 알림 **1건 전송**을 승인했다.
기본 checkout과 앱 Sentry 작업을 보존하고, 별도 `feature/sentry-slack-message-layout` worktree의
깨끗한 `0ab0923c5dbb59405cd18fc8cc7ef5cc065d3bc8`에서 기존 Worker를 업데이트했다.
배포 코드 변경은 `f085fdbe5363b7b1aacec93a496c76e02a319a79`, Worker Git blob은
`ca52ab8776ed3c7ffcdbd9148c46c816ff495d61`다. 이번 작업에서 Worker 코드는 수정하지 않았다.

- [x] 기존 `oioi-bwg-sentry-slack-relay` 업데이트
- [x] 배포 ref·Worker version·배포 시각과 100% 활성화 확인
- [x] 실제 Sentry staging 새 issue → Worker → Slack의 새 형식 수신 확인

| 실제 실행/관측 | 결과 |
| --- | --- |
| Wrangler `whoami` | 만료된 로컬 OAuth 로그인을 갱신한 뒤 기존 Worker가 있는 계정 확인 |
| relay 단독 Vitest | 29건 성공. 이전 결과를 이번 실행으로 재사용하지 않음 |
| Wrangler 4.135.0 `deploy --dry-run` | bundle 12.54 KiB / gzip 4.10 KiB 생성, 원격 변경 없이 종료 |
| Wrangler 4.135.0 `deploy --keep-vars` | 기존 이름/주소로 배포 성공. version `4c6de6ec-4fec-4cfe-828f-e267ce7de640` |
| 배포 API 재조회 | deployment `b8b3637d-acef-47f9-90cb-205116b29d5e`, 새 version 100% 활성 |
| 배포 시각 | `2026-10-22T14:28:19.151328Z` = **2026-10-22 23:28:19 KST** |
| secret 이름/type 전후 대조 | `SENTRY_WEBHOOK_SECRET`, `SLACK_SENTRY_WEBHOOK_URL`의 두 secret_text binding 동일 |
| 실제 endpoint 거부 검사 | GET/OPTIONS 405, 무서명 POST 401, 잘못된 path 404 |
| 단일 staging 진단 event 제출 | Sentry HTTP 200, event ID `48a06f64b928454da9b35024c609ee68` |
| 새 Worker 관측 | POST 204, exception 0, 위 새 version ID와 일치 |
| Slack 실제 수신 | `#oioi-sentry`, **2026-10-22 23:36:56 KST**, message TS `1792679816.294489` |

테스트는 기존 Web DSN을 파일에서 읽어 기존 project `4512117278179328`과 일치하는지 검증한 뒤
개인정보 없는 staging event를 정확히 한 번 제출했다. test marker는 `slack-layout-check-48a06f64`,
새 issue는 [7806902379](https://sentry.io/organizations/oioibawige/issues/7806902379/?project=4512117278179328)다.
제출 시각 23:36:14 KST부터 실제 Slack 수신까지 약 42초였다.
[실제 테스트 알림](https://oioibawige.slack.com/archives/C0C2Q7J3K0R/p1792679816294489)을
Slack 연결 도구의 채널 읽기와 고유 marker 검색으로 확인했다. 검색 결과는 1건이었다.

기존 title/message의 필드 나열 대신 굵은 제목 링크, inline environment/level/app/kind, 발생 시각과
상세 버튼이 Slack에 저장된 것을 확인했다. 테스트에 실제 앱 release를 넣지 않았으므로 release 표시는
검증하지 않았다. 실제 모바일 픽셀 배치나 링크 클릭 뒤 Sentry 화면은 직접 확인하지 않았다.
Windows UI 도구가 WSL 경로 오류로 시작되지 않아 해당 UI 검증을 성공으로 세지 않았다.

최초 기본 urllib User-Agent의 403은 성공으로 세지 않았고, 명시적 진단 User-Agent로 위 거부 응답을
확인했다. tail의 sampling-rate 1 옵션은 CLI가 거부해 제거했다. 최종 tail은 요청 헤더·서명·원문 URL·body를
저장하지 않고 응답 status·version·exception 수만 남겼으며, 관측 후 종료했다.

기존 secret 값이나 Slack webhook 주소를 읽거나 다시 등록/회전하지 않았다. 일반 변수는 `--keep-vars`로
보존했고 개인 env는 읽기만 했다. 테스트 body에는 user·입력·cookie/token·raw cause·stack을 넣지 않았고
DSN 원문은 출력하거나 증거 파일에 저장하지 않았다. Sentry 규칙/Integration·Slack 앱 이름·운영 DB·VM·Vault·
OCI 앱 배포·PR 생성/병합은 변경하지 않았다. 앱 release/Debug ID/소스맵 실제 복원과 운영 알림 규칙 보완은
이 Worker 배포로 완료 처리하지 않는다. §10의 미배포 브리핑 조건은 이번 배포·수신 확인으로 해제됐다.

문서만 갱신했으므로 두 앱 build·전체 검사 세트를 별도로 다시 실행하지 않았다. 문서 format/diff와
commit/push hook의 실제 결과는 각각의 실행 로그로 구분한다. 증거는 이 worktree의 ignored
`.local/observability/slack-deploy/`에 있으며 secret/원문 webhook payload를 포함하지 않는다.
