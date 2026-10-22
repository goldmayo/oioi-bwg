---
title: "오류 원인과 처리 결과 추적 개선 결과"
document_id: "OBSERVABILITY-ERROR-TRACKING-RESULT"
version: "1.0"
status: "active"
authority: "result"
updated_at: "2026-10-22"
depends_on:
  - "OBSERVABILITY-ERROR-TRACKING-PLAN"
  - "03"
  - "09"
---

# 오류 원인과 처리 결과 추적 개선 결과

## 1. 기준과 완료 범위

계획은 [PR #195](https://github.com/goldmayo/oioi-bwg/pull/195)의
[v1.1 고정본](https://github.com/goldmayo/oioi-bwg/blob/dd2b41f1e03a2e29d43f98badabb283d0c595986/docs/migration/implementation/OBSERVABILITY-ERROR-TRACKING-PLAN.md)이다.
계획 branch에만 있는 문서를 이 branch에 복제하지 않는다. 기존 9월 audit·결과는 역사 기록으로 유지한다.

`origin/migration_main`과 실제 원격이 일치한 `4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`에서
`feature/observability-p1-a-error-classification`을 분기했다. 모노레포 정리 branch의 미병합 변경은 포함하지 않았다.
03 v1.5·09 v1.4에서 정상 처리된 AppError와 탈출한 delivery 실패를 구분하고 index v1.28을 동기화했다.
헌법·도메인 code·HTTP status·인증 판정은 그대로다.

- [x] P1-A: Console server 오류 분류와 최종 정제, 대응 규범·회귀 검사
- [ ] P1-B: Console RSC 인증 전달과 실제 로그인/거부 UX 검증
- [ ] P2-A: Console app·경로 template·operation·breadcrumb
- [ ] P2-B: Web의 실제 consumer 적용
- [ ] P3: 기존 인증 판정 기반 typed rejection log
- [ ] P4-A: Console 서버 생성 request ID와 두 sink 연결
- [ ] P4-B: Web dynamic/API 요청 연결
- [ ] 계획 §11: 기존 Slack 규칙 보완과 이미지별 소스맵 운영 검증

## 2. P1-A 구현

실제 AppError instance와 contract enum code가 확인되면 `error.type=application`을 사용한다.
Next render 오류 hook의 `next.request_error`는 `handling=unhandled`, `outcome=render_error_captured`다.
이 경계의 application 오류는 `failure.kind=delivery`로 기록하며 caller의 handled 표기로 버리지 않는다.
output contract는 contract, 확인된 DB/Auth 장애는 system, 근거가 부족한 오류는 unknown이다.

명시적으로 처리한 AppError는 JSON error/Sentry sink에서 제외한다. 기존 HTTP adapter도 정상
401/403/404/409를 그대로 반환하며 reporter를 부르지 않는다. 인증 decision의 info log는 P3 범위다.
logger와 Sentry reporter는 서로 의존하지 않으며 같은 작은 분류 함수를 사용한다.

producer의 code·분류·관측 결과가 beforeSend 최종 allowlist에 남는다. 새 enum도 재검증하고 잘못된
application code와 arbitrary classification은 unknown으로 정규화한다. 실제 render hook 정보가 없으면
HTTP 500·브라우저 오류 화면·로그인 이동을 추정하지 않는다. 나머지 outcome vocabulary는 후속 consumer용이다.

SDK에는 원본 Error identity를 전달한다. 최종 event의 DeliveryError 표시는 고정 문구이며 기존 frame·release·
Debug ID 정제를 유지한다. raw message·SQL·개인정보·임의 cause를 metadata로 복구하지 않는다.
React가 원래 타입/code를 보존하지 않은 Error는 unknown으로 수집한다. 기존 A/B 이슈 해결을 뜻하지 않는다.

## 3. 실제 로컬 검증

| 명령/비교 | 결과 |
| --- | --- |
| Console `vitest run src/server/observability/server-logger.test.ts src/server/http/api-response.test.ts` | 변경 전 2파일·18건, 변경 후 2파일·32건 성공 |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 최종 12 task 성공, 9개 캐시. unit 81파일·424건: contracts 3 + server 88 + Web 93 + Console 240 |
| `pnpm type-check:repo`, `pnpm lint:repo` | 성공 |
| workspace lint가 실행한 양쪽 `lint:fsd` | 성공 |
| `pnpm test:harness` | 18건 성공. 모노레포 branch의 추가 harness는 이 기준선에 없음 |
| `pnpm test:ops` | 21파일·262건 성공 |
| `pnpm build --force --env-mode=loose` | 변경 전후 두 앱 모두 컴파일·타입 검사·정적 생성·standalone 구성 성공. 각 2 task·Turbo 캐시 0개 |
| build 출력의 route·정적/동적 표기 대조 | Web 21개·Console 18개가 변경 전후 동일 |
| `pnpm format:check`, `git diff --check` | 성공 |

최초 workspace 검사에서는 새 test event의 필수 `type` 누락을 발견해 fixture를 수정했다.
긴 test group의 lint 경고는 group 분리로 제거했다. 이후 오류 이름 선택도 고정 table로 단순화하고
workspace 검사를 다시 통과했다. 검사 억제·강제 cast·hook 생략으로 해결하지 않았다.
첫 commit은 본문 한 줄의 100자 제한으로 거절되어 메시지의 줄바꿈을 보완했다.

새 회귀는 정상 401/403/404/409 제외, 탈출한 인증 오류의 두 sink/final payload, 잘못된 enum·hostile getter,
원본 Error identity와 frame fixture, SQL/email/OTP/token marker 제거를 확인한다. 실제 instrumentation hook도
Sentry OFF에서 JSON 분류를 유지했다. Sentry SDK mock 검증이며 원격 수신이나 실제 심볼리케이션 검증은 아니다.

build는 source map upload와 Sentry 전송을 끄고 local 환경, loopback origin, 임시 Console secret,
`127.0.0.1:1`의 접근 불가 DB URL을 명령 입력으로 사용했다. 개인 env·MFA key·DB volume은 건드리지 않았다.
실행 로그는 작업 worktree의 `.local/observability/p1-a/`에 있다.

검증한 소스는 위 기준 SHA와 이 RESULT를 포함한 커밋의 diff다. Console 파일별 Git blob은 다음과 같다.

| `apps/console/src/` 아래 파일 | 검증 blob |
| --- | --- |
| `server/observability/safe-server-event.ts` | `321861b443647d52305879a2a316ac527adbd153` |
| `server/observability/server-logger.ts` | `0251678868b75bdb1a493ddf130656be0375773e` |
| `server/observability/server-sentry-reporter.ts` | `f0bebb7cb8021762ac476d92518cd80d74806a10` |
| `server/observability/server-logger.test.ts` | `d308c1b7a4ca24fa812b6eb51e36a181245fe543` |
| `server/http/api-response.test.ts` | `02c0c481452551d12630fa8c3bd08b89ef089813` |

## 4. 한계와 다음 단위

정상 인증 거부의 직접 진입/navigation/revocation UX는 P1-B에서 별도로 구현·Playwright 검증한다.
이번에는 실제 앱 DB 조회/CRUD·관리자 E2E·standalone browser smoke를 실행하지 않았다.
Sentry/Slack 현재 설정 조회·이벤트 전송·알림 규칙 변경·OCI/Vault/운영 DB 변경·배포도 하지 않았다.

총 diff의 400줄 목표 초과는 같은 계약의 규범, producer 두 sink, 최종 sanitizer, privacy 회귀를 함께
검토하기 위한 것이다. 리뷰 순서는 03/09 → 분류 함수 → logger/reporter → HTTP·privacy test → 이 결과다.
인증 adapter·Web 확장·Proxy·외부 알림·배포 gate는 섞지 않았다. 사용자 지시에 따라 새 PR 생성은 보류한다.
