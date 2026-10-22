---
title: "모노레포 설정 공통화와 구조 개선 계획"
kind: migration-plan
status: active
authority: plan
source_commit: 4d5e42dac37aeb13b3279b47a7907fbb7bc91be2
created_at: "2026-10-22"
---

# 모노레포 설정 공통화와 구조 개선

## 기준과 실행 계약

[Notion 조사 리포트](https://app.notion.com/p/400395eb18c2802dbe1df6a1d16db73a)의
2026-10-22 현행 재판정표(36개)와 MAIN-01/02를 빠짐없이 추적한다.
Notion 최종 편집 시각은 2026-10-21T17:17:49.914Z다. 역사 자료의 개인 env 관찰을 현행 결함으로 합산하지 않는다.

fetch한 origin/migration_main의 위 source_commit에서 feature/monorepo-configuration-cleanup을 분기했다.
기존 feature/observability-error-tracking-plan의 별도 계획 commit은 포함하지 않는다.
사용자는 작은 작업마다 로컬 검증·점검 후 커밋을 쌓고 하나의 PR로 제출하도록 요청했다.
파일/라인 목표 초과 시 같은 PR의 커밋 순서와 결합 이유를 설명한다. 자동 병합·배포는 범위에 없다.

상위 기준은 [헌법 §5](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Frontend §3](../oioi-bwg-architecture-clean-v1/02-frontend-architecture.md),
[Auth §4](../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Testing](../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[Runtime](../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md)과
[배포 runbook](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)이다.
환경변수의 선행 계획은 [환경 구성 계획](ENVIRONMENT-CONFIGURATION-PLAN.md)을 참조한다.
확정되지 않은 ENV-2의 전체 로컬 DB credential 체계 전환은 이 변경에 몰래 포함하지 않는다.

## 작업 순서와 완료 조건

1. 공통 검사 기반: ESLint/Steiger의 규칙을 config에 단일화하고 앱별 진입점·경로를 분리한다.
   root/pre-commit/package 경계 규칙의 실효 설정과 Turbo 영향 경로를 검사한다.
2. 브라우저 API 공개 경계: api entry는 허용하고 내부 deep import는 차단한다.
   root는 server-safe export를 유지하고 HTTP transport에 client-only 경계를 적용한다.
3. 검사 범위와 테스트 책임: 운영 TypeScript 파일의 검사 누락을 해소하고 browser/node preset을 공유한다.
   앱별 Vitest entry와 root 전체 unit/coverage 범위를 일치시킨다. PostgreSQL 테스트의 실제 Web adapter
   consumer는 삭제하지 않고 의존 책임을 명시하거나 alias를 한정한다.
4. Next build 설정: 두 앱의 공통 정책과 Sentry build 조립을 공유하고 Console 인증 옵션을 보존한다.
   앱별 env 입력과 Next instrumentation/request adapter는 앱에 유지한다.
   runtime Sentry 오류 분류 변경과 신규 관측 기능은 별도 개선 계획의 범위다.
5. 실행·환경: DB guard와 실제 실행의 입력을 맞추고 개발 Docker workspace 설치를 고친다.
   앱별 예제·Console 업로드 설정 검증·local metadata·shadcn 설정을 실제 consumer에 맞춘다.
6. 수명주기와 안내: 종료된 release 도구, 미사용 입력, 오래된 개발 안내와 Auth 충돌을 정리한다.
   과거 결과는 덮어쓰지 않고 명시적 현재 안내와 연결한다.
7. 최종 리팩토링 검사: 중복 정책·잘못된 추상화·경로 기준·역방향 의존·secret/빌드 경계를 다시 검토한다.
   로컬 전체 gate와 두 standalone smoke 후 한 PR을 생성한다.

각 단계는 구현 → 관련 검증 → diff/리팩토링 점검 → 결과 기록 → 한글 Conventional Commit 순서다.
이 표는 계획이며 완료 표시는 [실행 결과 체크리스트](MONOREPO-CONFIGURATION-RESULT.md)가 소유한다.
2026-10-22 중간 점검 이후의 재개 순서와 추가 항목은 이 문서 끝의
[추가 논의 반영](#2026-10-22-추가-논의-반영--재개-순서와-소유권)을 따른다.
위 순서와 아래 원문 38개 ID는 당시 계획과 추적성을 위해 보존한다.

## 원문 전체 항목 매핑

| 계획 | 원문 ID | 항목 | 처리 기준 |
| --- | --- | --- | --- |
| [ ] | ENV-01 | 콘솔 R2 필수 설정 누락 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ENV-02 | 콘솔 배포 R2 secret 매핑 미완성 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ENV-03 | readiness에서 기능 설정 누락 미탐지 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ENV-04 | 웹 DATABASE_URL 예제 누락 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ENV-05 | 웹 개인 env의 APP_ENV 누락 | 비추적 개인 설정은 변경하지 않고 브랜치 결함에서 제외한다. |
| [ ] | ENV-06 | APP_ENV 값 계약 불일치 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ENV-07 | staging 고정과 local 강제 지정 | local/staging의 현행 배포 의미를 문서화하고 운영 production 전환은 P06-F에 유지한다. |
| [ ] | ENV-08 | 실제 소비 없는 개발 플래그 | 실제 consumer와 예정 기능을 조사해 유지 또는 제거 사유를 남긴다. |
| [ ] | ENV-09 | NEXT_PUBLIC_ASSETS_URL 미사용 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ENV-10 | 콘솔에 웹 GTM 입력 전달 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | MAIL-01 | production에서 dev 메일 모드 오류 | 현재 앱 consumer가 없는 휴면 코드로 유지하고 재활성화 전 조건을 기록한다. |
| [ ] | MAIL-02 | Instance Principal과 IMDS 차단 충돌 | metadata 차단은 유지하며 메일 재활성화의 인증 설계 과제로 기록한다. |
| [ ] | OBS-01 | Sentry DSN·프로젝트 공유 | 공유 프로젝트를 유지하되 앱별 입력 책임을 문서화한다. 외부 프로젝트 생성은 하지 않는다. |
| [ ] | OBS-02 | 콘솔 Sentry 예제 누락 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | DB-01 | guard와 migration env 로딩 불일치 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | DB-02 | 공통 DB 도구의 웹 env 결합 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-01 | ESLint policy 공통 규칙 복제 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-02 | 루트가 양쪽 policy를 로드 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-03 | Node ESLint의 Next preset 의존 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-04 | 허용된 api public entry를 lint가 거절 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-05 | browser API와 root barrel 경계 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-06 | pre-commit 패키지 경계 규칙 누락 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | CFG-07 | repo TypeScript 검사 대상 누락 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | TEST-01 | root Vitest의 웹 전용 설정 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | TEST-02 | unit 명령·coverage 대상 불일치 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | TEST-03 | coverage의 없는 경로 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | TEST-04 | PostgreSQL integration의 웹 alias 결합 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | RUN-01 | 개발 Dockerfile manifest 누락 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | RUN-02 | 웹 forbidden 설정 누락 | Web 관리 route 제거로 적용 제외, Console 설정을 보존한다. |
| [ ] | UI-01 | 웹 shadcn의 잘못된 alias | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | UI-02 | 콘솔 shadcn 설정 부재 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | DOC-01 | README·로컬 안내 부정확 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ROOT-01 | 사용 종료한 release-it 잔존 | 해당 consumer와 검사 경로를 수정하고 로컬 검증 결과를 연결한다. |
| [ ] | ROOT-02 | 단일 앱 Compose env 예제 | legacy rollback consumer를 확인해 호환 예제를 명시한다. |
| [ ] | ROOT-03 | 일회성 이슈 생성 script | 수동 사용 가능성을 보존하고 자동 실행하지 않는다. |
| [ ] | ROOT-04 | root Next/TS 생성 파일 잔존 | 비추적 개인 산출물은 변경하지 않고 브랜치 결함에서 제외한다. |
| [ ] | MAIN-01 | 제거된 Web 기능의 env 예제 잔존 | Web 조회와 Console 업로드 consumer에 맞춰 예제를 정리한다. |
| [ ] | MAIN-02 | active 인증 문서의 Web 로그인 설명 충돌 | 헌법의 Web 인증 제거 결정을 보존하고 과거 보존 전제를 명시적으로 폐기한다. |

## 검증과 제한

- 의존성은 frozen lockfile로 맞추고, 설정 적용 결과·테스트 수집 대상·타입 프로그램 소속을 비교한다.
- 단계별 관련 harness/unit/ops/lint/type 검사 후 커밋한다. 마지막에는 pnpm verify 및 필요한 runtime 검증을 한다.
- 공통 config 변경의 양쪽 consumer task hash와 Docker manifest/실행 경로를 확인한다.
- 실제 DB 검증은 Docker Compose PostgreSQL만 사용한다. 개인 파일·볼륨·MFA 키를 보존한다.
- R2/메일 외부 전송, VM/Vault/GitHub 설정·secret 변경은 실행하지 않는다.
  외부 서비스 권한의 유효성은 예제·형식 검증과 구분해 미검증으로 남긴다.
- 관리자 전체 E2E는 active Testing 문서의 수동 실행 정책을 유지한다.

## 2026-10-22 추가 지시 — 공유 설정 TS 통일

사용자가 1단계 확인 후 JS/TS 혼재를 먼저 정리하고 TS로 통일하도록 요청했다.
기준은 `88920c7509fe4d779cc5914e64d463c17716a834`이며 CFG-04/05보다 앞서 수행한다.
1단계에서 선택한 Steiger `.mjs` fallback은 이 후속 변경으로 대체하고 당시 검증 이력은 보존한다.

- 공유 ESLint/Steiger 설정, 관련 자동 탐색 entry, 공통 architecture rule/path 구현을 `.ts`로 통일한다.
- 기존 jiti는 ESLint TS entry를, 기존 tsx는 Steiger와 Node harness의 TS import를 로드한다.
  설정의 JS 빌드 산출물·호환 wrapper·새 의존성을 추가하지 않는다.
- `config/tsconfig.json`의 strict 검사에 공유 구현과 workspace entry를 포함하고
  `type-check:repo`에 연결해 수동 실행·CI·push hook 모두 실제 타입을 검사하게 한다.
  운영 스크립트 전체의 기존 CFG-07 검토는 별도 단계로 유지한다.
- 변경 전후 실효 규칙과 경계 판정, root/app/package 경로, Turbo 입력을 비교하고
  기본 로컬 검사 후 후속 commit/push한다. 기존 JS 테스트·ops 도구 전체의 언어 전환은 포함하지 않는다.

## 2단계 실행 범위 — CFG-04/05

기준은 `9f8ade404b9b53df63015fefab55819e846e6d18`이다. 헌법 §9, Frontend §3·7,
Rendering/Query §29.2·35에 맞춰 다음 변경을 한 단위로 검증한다.

- `entities/*/api` 공개 진입점만 추가 허용한다. alias·상대 경로의 내부 파일 우회와 같은 레이어의
  다른 slice 참조는 거절한다. feature/widget의 임의 segment 공개 예외는 만들지 않는다.
- 네 Album/Song root에서 browser Query/Mutation 재수출을 제거하고 Console consumer 3곳을
  API entry로 연결한다. RSC의 model/UI/query key와 기존 hydration·invalidation identity는 유지한다.
- Web/Console HTTP transport에 `client-only`를 선언한다. 실제 import graph 회귀와 기존 API·
  consumer 테스트, 타입/lint/FSD/harness/unit/format, 양쪽 Next build로 경계를 검증한다.
- Next/Vitest/DB 설정·운영 스크립트 전체 TS 검사·운영 자원은 이 단계에서 변경하지 않는다.

## 3단계 실행 범위 — CFG-07 운영 TypeScript 검사

기준은 `4e012b9fb611a730ff420b81a5c8b97391722db5`다. 헌법 §5·14와 Testing §17의
workspace/repo 검사 책임을 유지하며 누락된 운영 `.ts` 스크립트 8개를 strict 검사에 포함한다.

- 기존 root `tsconfig.json`의 `.mts` launcher·worker에 대한 NodeNext 검사는 보존한다.
  `scripts/tsconfig.json`은 기존 Node preset을 상속하고 `tsx` 실행·esbuild bundle의 확장자 없는
  import에 맞춰 ESNext/Bundler를 사용한다. JS 도구 전체를 변환하거나 검사 범위에 추가하지 않는다.
- `type-check:scripts`를 `type-check:repo`에 연결해 `pnpm type-check`·verify·CI·push hook의
  기존 진입점에서 실행한다. 새 검사로 드러난 오류는 타입 계약을 정확히 표현하는 범위로 수정한다.
- tracked 운영 TS 파일의 실제 타입 프로그램 소속을 회귀 검사하고 잘못된 타입이 기존 repo 명령에서
  거절되는지 확인한다. DB·MFA·VM·Vault 관련 운영 명령은 실행하지 않는다.
- 타입/lint/FSD/harness/unit/format 및 필요한 ops 회귀 후 중복 설정·검사 누락·런타임 영향 여부를
  점검하고 결과를 별도로 추가한다. Vitest·coverage·PostgreSQL alias는 TEST-01~04에서 처리한다.

## 4단계 첫 단위 — TEST-01 앱별 Vitest 소유권

기준은 `d8713c59d44cb9ff5a9603f4693638546849169c`다. 헌법 §5·11·14와 Testing §17·18에
따라 설정 소유권을 먼저 분리한다. TEST-02/03의 실행·측정 범위 변경은 다음 단위로 남긴다.

- 실제 Vitest 4.1.2 수집 API로 root Web 24·Console 39·server 17·contracts 1·ops 21·PostgreSQL
  4개 파일을 확인했다. 두 앱은 jsdom, 나머지는 Node다. 파일 목록·exclude·setup·alias·timeout과
  coverage 설정을 `.local/monorepo-config/vitest-ownership/before.json`에 기록했다.
- 두 앱에서 실제 중복인 globals/jsdom/css/setup만 `.ts` browser preset으로 옮긴다.
  Node 설정은 globals·timeout·직렬 실행 책임이 다르므로 이번 단위에서 강제로 합치지 않는다.
- Web도 앱 내부 `vitest.config.ts`로 실행한다. 각 앱의 root·alias·include는 앱이 소유하고
  root는 Web 프로젝트 선택과 기존 coverage 정책만 유지한다. 전체 workspace 확대는 TEST-02다.
- 기존 공통 browser setup은 preset 옆으로 이동하고 절대 경로로 연결한다. config strict 검사와
  Turbo 공통 입력을 갱신한다. TEST-03의 오래된 coverage include와 TEST-04의 Web adapter alias는 유지한다.
- 변경 전후 수집 파일 전체·제외 범위·실행 환경을 비교하고 앱 cwd/루트의 명시적 config 실행을 검증한다.
  기본 타입/lint/FSD/harness/unit/format, root unit/coverage의 현행 동작을 실제 실행한다.
  앱 runtime/build·DB·개인 env·운영 설정은 변경하지 않는다.

## 4단계 두 번째 단위 — TEST-02 루트 실행 범위

기준은 `99d4428816be36878b084c03c17606b3a7251858`다. 헌법 §5와 Testing §17·18에 따라
루트 unit·coverage가 실행하는 테스트를 기존 Turbo workspace test의 합집합과 맞춘다.

- 변경 전 실효 설정·수집 파일을 `.local/monorepo-config/workspace-unit/before.json`에 기록했다.
  root는 Web 24개, workspace 전체는 Web 24 + Console 39 + contracts 1 + server 17 = 81개다.
- root `projects`는 `apps/*/vitest.config.ts`와 `packages/*/vitest.config.ts`를 선택한다.
  unit의 watch 진입점과 coverage 명령은 이 설정을 공유하고, CI의 `test:unit:run`은 기존 Turbo를
  유지한다. repo ops·PostgreSQL·관리자 E2E는 기존의 별도 명령에 남긴다.
- Node package 두 곳도 자신의 root를 명시하고 config strict 검사에 포함한다.
  각 workspace의 alias·include·environment·globals·setup·timeout은 그대로 유지한다.
  browser preset과 별개인 Node globals/실행 책임을 이번 단위에서 재설계하지 않는다.
- 세 루트 명령의 실제 수집 파일·환경·제외 범위를 비교하고 unit·coverage를 각각 실행한다.
  TEST-03의 오래된 coverage include는 보존하며, 전체 테스트 실행 성공과 측정 파일 0개 문제를
  구분해 기록한다. API·DB·앱 runtime 설정은 바꾸지 않고 TEST-04 alias도 유지한다.
- 기본 타입/lint/FSD/harness/unit/format과 두 앱 build를 실제 실행한다.
  결과 기록·리팩토링 점검 후 같은 브랜치에 새 커밋을 만들고 hook을 생략하지 않고 push한다.

## 4단계 세 번째 단위 — TEST-03 coverage 측정 경로

기준은 `6a6e90d760086a3d215c6464bf77b0aec3912772`다. Testing §17·18을 따라 기존 81파일의
테스트 실행은 보존하고 실제 소스가 측정되도록 coverage include만 정리한다.

- 기존 include는 없는 Web shared/hooks·shared/utils 및 Web feature hook만 가리킨다.
  변경 전 수집/환경과 추적 소스 목록을 `.local/monorepo-config/coverage-scope/before.json`에
  기록했다. 테스트·선언을 제외한 현재 소스 후보는 Web 111·Console 133·contracts 6·server 26개다.
- 두 앱과 두 package의 `src/**/*.{ts,tsx}`를 명시적으로 측정한다. 실행하지 않은 소스도 보고서에
  드러내고 기존 test/선언 제외 규칙은 유지한다. 단위 테스트 include·alias·환경과 V8 provider·
  기본 text/html reporter는 바꾸지 않는다. 새 coverage 수치 목표나 도메인 테스트를 추가하지 않는다.
- 변경 전후 실제 coverage를 실행해 측정 파일을 추적 소스 목록과 대조하고 테스트 파일·이름별
  결과도 비교한다. 파일 목록에 차이가 있으면 실행 코드와 provider 동작을 확인해 기록한다.
  ops·PostgreSQL·관리자 E2E 및 TEST-04의 Web adapter alias는 이번 단위에 포함하지 않는다.
- 사용자가 승인한 병렬 검증을 이번 실행부터 적용한다. workspace 검사는
  `pnpm exec turbo run type-check lint test --concurrency=4`로 묶고 repo 타입/lint는 별도로 실행한다.
  임시 소스를 만드는 harness는 workspace 검사 후, `.next`를 갱신하는 build는 타입 검사 후 실행한다.
  기존 verify/CI/hook의 검사 범위와 task 의존 관계는 유지하고 실행 도구를 새로 만들지 않는다.
- coverage·workspace/repo 검사·harness/FSD/format 및 두 앱 build를 실제 실행하고 결과를 기록한다.
  같은 브랜치에 새 커밋을 push한 뒤 브리핑하며 PR·병합·배포는 하지 않는다.

## 4단계 네 번째 단위 — TEST-04 PostgreSQL 의존 책임

기준은 `1a6f4b2f6be2c5895c8840ffa6f907495f17c334`다. Testing §6·15·17을 따라 실제 PostgreSQL
검증을 보존하면서 Web alias의 적용 범위를 실제 adapter consumer로 한정한다.

- 현재 네 integration 파일 중 foundation만 Web의 `toErrorResponse`를 소비한다. 실제 nickname·
  credential·Album/Song slug 충돌이 HTTP 409로 변환되는 검증을 제거하거나 mock으로 대체하지 않는다.
- root PostgreSQL entry는 전체 선택과 직렬 실행을 소유한다. 공통 server 검사 세 파일과 Web adapter를
  포함한 foundation 한 파일을 별도 project로 나누고, Web project의 alias·include는 Web이 소유한다.
  두 project가 실제 공유하는 Node 환경·timeout·server-only mock만 PostgreSQL 공통 설정으로 둔다.
  기존 테스트 파일·이름·검증 본문과 migration/role/runner/CI 실행 경로는 유지한다.
- 변경 전후 네 파일의 수집 목록·제외·환경·직렬 설정을 대조하고 실제 로컬 PostgreSQL runner를
  실행한다. 기존 Compose PostgreSQL 17의 임시 DB만 사용하고 runner의 연결·lock·DB 정리를 확인한다.
  Web alias가 server project에 적용되지 않는 회귀도 확인한다.
- 승인한 Turbo 병렬 workspace 검사와 repo 검사 후 harness/FSD/format 및 두 앱 build를 실행한다.
  리팩토링 점검과 RESULT 기록 후 새 커밋을 push한다. 다음 설정 개선은 별도 단위로 남긴다.

## Next build 첫 단위 — 공통 정책과 앱별 옵션

기준은 `6b65d7cabb0e84b54b8ac0cf0562d44c884cf4a8`이다. 헌법 §5·11, Testing §17,
Runtime §11·12.1과 배포 runbook §14·21에 따라 동일한 Next build 정책만 분리한다.

- 두 `next.config.ts`의 standalone·source package transpile·tracing root·build cache·React compiler·
  개발 origin·image·fetch logging·postgres external 정책은 동일하다. `config/next.ts`에서 공유하고
  자동 탐색 entry는 각 앱에 유지한다. tracing root는 전달받은 앱 디렉터리를 기준으로 계산한다.
- Console은 공통 experimental 옵션을 보존하면서 자기 entry에서 `authInterrupts:true`를 조합한다.
  실제 `forbidden()` consumer와 Web 인증 제거 결정을 유지한다. 일반 deep merge wrapper는 만들지 않는다.
- Sentry build 조립과 앱별 `sentry-build.ts` 입력 검증, instrumentation·request adapter는 조사만 한다.
  source map 업로드·release 검증과 runtime 오류 분류는 바꾸지 않으며 Sentry 조립 공통화는 후속 단위다.
- 변경 전후 설치된 Next loader의 설정을 local/ephemeral build 입력과 root/app cwd에서 대조한다.
  config strict 검사에 양쪽 entry를 포함하고 공통 파일 변경이 두 앱의 Turbo task를 무효화하는지 확인한다.
- 승인한 workspace/repo 검사 후 harness/FSD/format과 두 앱 실제 build를 실행한다.
  임시 local 입력을 사용하고 개인 env·DB·운영 자원은 변경하지 않는다. 결과를 추가하고 새 커밋을
  push한 뒤 멈춘다. 원문 38개 ID와 PLAN 매핑은 보존하고 PR·병합·배포는 하지 않는다.

검증 방식 보정: 임시 조사 도구의 Next `loadConfig` 직접 호출은 변경 전 설정에서도 확장자 없는
`sentry-build` import를 찾지 못했다. 실제 CLI build는 성공했다. root/app cwd 12개 조합은 기존
`tsx`로 앱 export를 비교하고, 실제 Next loader 결과는 변경 전후 build가 저장한
`required-server-files.json`의 전체 config와 standalone 경로로 별도 대조한다.

## Next build 두 번째 단위 — Sentry 옵션 조립

기준은 `18cc91ab173ee8ce87f9e3639b33d58fb70cb8a4`다. 헌법 §5·11, Testing §14·17,
Runtime §12.1·14와 배포 runbook §21에 따라 두 앱이 복제한 Sentry build 옵션만 공통화한다.

- `config/sentry-build.ts`는 검증된 authToken·org·project·release를 받아 기존 옵션을 반환한다.
  telemetry·route manifest·경고 억제·업로드 오류 재전파·release 생성/확정·map 삭제 정책을 보존한다.
  공통 함수가 env나 SDK를 직접 읽거나 앱 소스를 import하지 않게 한다.
- 앱별 `getSentryBuildConfig()`와 활성화 분기, `withSentryConfig()` 호출은 각 `next.config.ts`에
  유지한다. Console 인증 옵션과 Next 공통 정책, instrumentation·request adapter·runtime 오류
  분류, env 예제·CI·Docker·dependency/lockfile은 변경하지 않는다.
- 변경 전후 실제 앱 entry가 SDK에 전달하는 전체 Next/Sentry 옵션을 가짜 업로드 입력으로 비교한다.
  SDK 경계만 대체해 외부 전송 없이 비활성 우회·앱별 입력·누락/잘못된 release 거절·오류 재전파를
  검사한다. 실제 SDK의 활성 설정 조립도 build hook 실행 없이 별도로 대조한다.
- 기존 config strict 검사와 Turbo 공통 입력을 사용한다. 새 파일 변경이 두 앱의 검사/build를
  선택하고 hash를 바꾸는 회귀를 추가한다. 새 wrapper framework나 공통 SDK dependency는 만들지 않는다.
- 승인한 workspace/repo 검사, harness/FSD/format과 두 앱 실제 build를 실행하고 최종 설정·standalone
  경로를 비교한다. 실제 build에서는 업로드를 끄고 임시 local 입력을 사용한다. 검증·점검 결과를
  RESULT에 추가한 뒤 같은 브랜치에 새 커밋을 push하고 멈춘다. PR·병합·배포는 하지 않는다.

push 전 보완 범위: 기존 ops의 Sentry 검사는 Web entry의 옵션 문구를 직접 읽는다.
공통 조립 함수의 실제 반환값으로 같은 삭제·manifest·오류 정책을 검사하도록 갱신한다.
workflow·BuildKit secret 검사는 보존하고 두 앱의 실제 연결은 새 harness가 계속 검증한다.

## 2026-10-22 추가 논의 반영 — 재개 순서와 소유권

사용자는 중간 점검, 공유 config 패키지화, 상대경로 대체, 작업 우선순위, UI 후속 추출,
Worker 위치와 루트 tests 조사까지 Notion 및 저장소 체크리스트에 함께 반영하도록 요청했다.
이번 승인은 문서와 체크리스트 갱신 범위다. 아래 구조 변경은 구현 전 검토·대기 항목이며,
기록을 구현·병합·배포 승인이나 완료로 해석하지 않는다. 개인 env와 운영 자원은 변경하지 않는다.

조사 소스는 `feature/monorepo-configuration-cleanup`의
`d1df79a7672e64b8366f58a298fbb50914afea96`이다. 원격 조회 시 `migration_main`은
`4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`였다. 초기 원문 38개와 추가 8개를 구분하며,
추가 항목의 현재 상태와 조사 증거는 [RESULT](MONOREPO-CONFIGURATION-RESULT.md)가 소유한다.
기존 CFG-07의 완료 범위는 운영 스크립트 8개이며, 추가 설정·테스트 누락은 별도 ID로 추적한다.

### 재개 순서

| 순서 | 작업 | 추적 항목과 완료 기준 |
| --- | --- | --- |
| 0 | Sentry 완료 커밋과 통합 기준선 확정 | BASE-01. 승인된 병합 후 최신 migration_main을 반영하고 합쳐진 소스의 검사·두 앱 build를 확인한다. 운영 수신·소스맵 검증은 별도 추적한다. |
| 1 | 앱별 환경변수 계약 정상화 | ENV-01~10, OBS-01/02, MAIN-01. Console R2·Sentry 예제, Web의 종료된 기능 입력, APP_ENV 값 계약과 필수 설정 검사를 맞춘다. MAIL-01/02는 현재 호출처가 없는 휴면 코드의 재활성화 조건으로 기록한다. |
| 2 | DB 도구 입력 경로 통일 | DB-01/02. guard와 실제 실행이 같은 입력을 사용하고 공통 DB 도구의 Web env 의존을 정리한다. 미확정 ENV-2 전체 credential 체계 전환은 별도다. |
| 3 | 공유 설정 패키지와 타입 검사 책임 정리 | CFG-08/09/10, TEST-05. 공통 설정의 공개 진입점·의존성을 명시하고 설정 2개·루트 tests TS 28개의 검사 누락을 보완한다. |
| 4 | 개발 Docker 설치·실행 검증 | RUN-01. 새 config 패키지를 포함한 workspace manifest와 lockfile로 깨끗한 설치·실행을 확인한다. 뒤에서 Worker를 추가하면 manifest와 영향 경로를 재점검한다. |
| 5 | 기존 대화의 6번: 수명주기·소유권·안내 정리 | ROOT-01~04, ENV-08/09, UI-01/02, DOC-01, MAIN-02 및 RUN-03, TEST-06. rollback 소비자와 기존 CI·수동 실행 계약을 보존한다. |
| 6 | 정상화 전체 검증 | 원문·추가 정상화 항목을 대조하고 전체 gate·두 앱 standalone smoke를 확인한다. 수동 관리자 E2E는 active Testing 정책을 따른다. |
| 후속 | 공통 UI 조사와 제한적 추출 | UI-03. 위 정상화 및 통합 검증 이후 별도 관심사로 검토한다. 이번 정상화의 완료 조건에 UI 추출을 넣지 않는다. |

### 추가 항목과 구현 전 검토 기준

- **BASE-01 — Sentry와 모노레포 통합 기준선:** Sentry 앱 branch와 Slack Worker branch의
  코드·문서·운영 상태를 구분한다. 겹치는 수정 파일이 없다는 관찰만으로 통합 검증 완료를 선언하지 않는다.
  원격 main 재조회, 승인된 병합 ref, 실제 통합 검사 결과를 남긴다.
- **CFG-08 — 공유 설정의 workspace 패키지화:** 우선 `packages/config` 한 개의 private 패키지를
  검토한다. 도구 의존성·공개 exports·자체 검사 책임을 소유하고 소비자가 workspace 의존성을 선언한다.
  앱별 자동 탐색 entry, 런타임 env 해석과 request/instrumentation adapter는 앱에 유지한다.
  ESLint rule 구현의 root harness 참조와 Vitest mock 경로를 함께 검토하고 새 패키지가 루트 테스트 구현에
  역으로 결합되지 않게 한다. 폴더 위치만 바꾸거나 목적별 패키지를 선생성하지 않는다.
- **CFG-09 — workspace 간 경로 계약:** `@oioi-bwg/config/next` 같은 명시적 package entry를
  사용한다. root tsconfig alias만으로 도구·런타임 해석과 Turbo 의존 관계가 연결됐다고 가정하지 않는다.
  앱 내부 `@/`와 같은 slice 내부 상대경로 규칙은 유지한다. tracing root·mock 등 파일시스템 경로 계산은
  별도 책임이며, TS 직접 export의 Next·ESLint·Vitest·CLI loader 호환성을 확인한다.
- **CFG-10 — 루트 설정 타입 검사:** `drizzle.config.ts`, `vitest.ops.config.ts`를 적절한 타입
  프로그램에 포함하고 기존 repo·CI·hook 진입점의 오류 검출을 확인한다. 설정 위치를 미관상 옮기지 않는다.
- **TEST-05 — 루트 tests TypeScript 검사:** 조사 기준 TS 28개(integration 4, ops 22, mocks 2)의
  검사 소속을 정한다. Web alias가 필요한 foundation과 Node/Worker·CLI 환경을 구분하며 모든 테스트에
  Web alias나 browser 환경을 퍼뜨리지 않는다. 수집·실행 성공과 타입 검사 성공을 별도로 확인한다.
- **RUN-03 — 독립 Worker의 workspace 소유권:** `apps/sentry-slack-relay`와 전용 package.json을
  검토한다. 현재 `workers/` 위치 자체는 결함이 아니다. 이동 시 type-check/test·Wrangler·README·
  root glob/harness·CI/Docker·배포 영향 판정을 함께 점검한다. Worker secret·Cloudflare 배포는 독립적으로
  유지하고 Next image나 OCI 배포에 합치지 않는다. 폴더 이동을 실제 Worker 재배포로 해석하지 않는다.
- **TEST-06 — 루트 tests 소유권:** 저장소 전체 배포/호스트/이미지/두 앱 통합 검증은 루트에 유지한다.
  Worker 단위 테스트는 RUN-03과 함께 앱으로, 서버 repository/service 전용 DB 테스트 두 개는
  `packages/server/tests/integration`으로 옮길 후보로 검토한다. foundation의 Web HTTP 409 검증과
  root CLI operator 검증, 격리 DB runner의 생성·직렬 실행·정리 계약을 보존한다. Web k6는 Web 소유 후보,
  marker mock 두 개는 공통 테스트 설정과 함께 관리할 후보로 둔다. ops의 test/smoke/fixture 역할과
  전체 참조를 먼저 조사하며 경로·CI·수집·중복 실행·Turbo 입력을 함께 검증한다. 단순 폴더 미관상 이동은 하지 않는다.
- **UI-03 — 정상화 이후 공통 UI:** 두 앱의 실제 재사용과 동일한 동작·스타일 계약을 확인한 primitive만
  추출 후보로 둔다. theme/CSS 변수/font/style 생성/provider와 browser 회귀를 확인한다.
  도메인·인증·라우팅에 결합된 UI는 앱에 유지하고, Base UI 전환·디자인 변경은 검증 가능한 별도 단위로 나눈다.
  헌법 §5의 공용 UI package 선생성 금지를 유지하며 필요 시 구현 전에 관련 active 문서를 검토한다.

### 범위와 문서 소유권

현재 config는 package.json 없이 루트 소스로 관리되고 `config/**` 전역 Turbo 입력과 별도 타입 검사에
연결되어 있다. workspace 목록에 config가 없다는 사실 자체는 검사 누락을 뜻하지 않는다.
패키지화의 목적은 공개 계약·의존성·검사 책임을 명시하는 것이며 기능 설정 오류의 해결이나 성능 향상을
자동으로 보장하지 않는다. 실제 기능에 영향을 주는 env·DB 입력을 우선한다.

이 절은 재개 계획, RESULT는 구현 상태와 관찰 증거의 canonical 문서다. Notion은 두 문서를 연결하는
요약 체크리스트로 동기화한다. 원문 조사와 이전 완료 기록은 삭제하거나 현재 코드에 맞춰 소급 변경하지 않는다.
이번 문서 갱신에서는 구현·설정·테스트·manifest·lockfile·개인 env를 바꾸거나 구조 변경을 실행하지 않는다.


## 2026-10-23 선행 정리 — 기존 변경 회수와 Draft PR

사용자는 신규 정상화 구현 전에 기존 변경의 보존·검토·필요한 최소 호환 보정·검증·커밋·push·
`migration_main` 대상 Draft PR 연결을 승인했다. 이 정리 범위에서 이전 PR 생성 보류를 해제한다.
병합·배포·운영 설정 변경·브랜치 삭제와 남은 정상화 구현은 승인 범위 밖이다.

- 미커밋 env 16파일과 B2 증적 문서 2개는 먼저 저장소 밖 patch/snapshot·해시로 고정한다.
  원본의 reset/clean/stash·커밋 재작성·강제 push는 하지 않는다. 다른 작업자의 원본 대신 고정본을 검토한다.
- 기존 Worker·Sentry 앱·모노레포·env 회수·F 준비를 각각 Draft로 연결한다. 이미 처리된 PR은 중복 생성하지 않는다.
  `56c2506`은 Sentry 앱에 포함돼 있으므로 다시 cherry-pick하지 않는다.
- env 원안의 필수 Sentry 프로젝트 분리는 OBS-01의 공용 프로젝트 유지와 충돌해 회수에서 제외한다.
  R2·앱별 env 입력·기존 local launcher/materializer는 원안 범위에서 회수하고 외부 기능 성공은 미검증으로 남긴다.
- B2의 추가 증적이 현행 결과에 이미 포함됐다면 원본을 보존하고 중복 PR·오래된 handoff 덮어쓰기를 하지 않는다.
- F는 production/www 준비 코드를 원격에 보존하는 **전환 보류** Draft다. 운영 적용을 실행하지 않는다.
- 닫힌 #49/#131·옛 AWS/refactor/worker·backup은 별도 분류하며 현재 구현 PR에 합치거나 삭제하지 않는다.

회수 ref·PR·직접/캐시/hook 검증·대체 근거의 canonical 기록은
[RESULT의 회수 기록](MONOREPO-CONFIGURATION-RESULT.md#2026-10-23-기존-작업-회수와-draft-pr-연결)이 소유한다.
Draft 생성은 원문/추가 ID의 완료 조건을 바꾸지 않는다. BASE-01은 승인된 코드 통합과 합쳐진 소스 검증이
남으며, 앱 배포·운영 알림·이미지별 소스맵 확인은 전체 작업 뒤 최종 배포 단계에 유지한다.
정리 종료 후 다음 한 단위는 BASE-01의 검토·통합 기준선 확정이다. env를 새로 중복 구현하지 않는다.

## 2026-10-23 정상화 재개 — ENV-03

이번 승인은 다음 미완료 한 단위의 구현·검증·문서·commit/push·PR/Notion 반영이며 병합·배포는 제외한다.
기준은 `feature/monorepo-configuration-cleanup@80fa15d460e8b39ae3fca1f15577805d7c19b170`,
원격 `migration_main@aa4e814f9fdbfd1c69b8b3af8934e5c99b80277c`다. 기존 재개 기록은 당시 이력으로 보존한다.
BASE-01은 #197/#200 미병합으로 대기하며 독립 구현을 막지 않는다. #198의 R2 예제·launcher·host 입력과
Web 예제는 이미 구현·검증됐으므로 복사하거나 재구현하지 않는다. 해당 ID의 분기별 상태는 RESULT가 소유한다.

- ENV-03만 기존 #200 브랜치에서 완료한다. Console readiness가 업로드와 동일한 R2 필수 입력·HTTPS 검사를
  사용하도록 하고, 입력 오류는 DB/외부 쓰기 전에 거절한다. Web의 공개 조회 readiness는 유지한다.
- 헌법 §5·11, Runtime §8·12.1·14, Testing §4·14·17과 배포 runbook §17을 따른다.
  외부 dependency deep-check가 아닌 설정 검사임을 runbook에 명시하고 secret/raw 오류 비노출을 보존한다.
- unit·기본 gate·두 앱 실제 build와 standalone browser smoke를 실행한다. CI·Promotion·Compose smoke의
  Console fixture에 가짜 R2 입력을 보완한다. harness는 type-check/build와 순차 실행한다.
- ENV-06(APP_ENV)의 앱별 값 계약과 local metadata가 다음 독립 단위다. DB-01/02와 config/Docker,
  휴면 메일·미사용 flag, UI/Worker는 이번에 변경하지 않는다. #198 병합·운영 R2/Vault 검증도 대기다.

## 2026-10-23 리뷰 보완과 통합 승인

사용자 리뷰의 P2를 ENV-03 안에서 보완한다. 빈 `?`·`#`도 거절하고, URL 파싱 결과를 사용해 앞뒤 공백·
호스트·기본 포트·경로를 정규화한다. public base의 끝 `/`를 제거하되 경로의 `%3F`·`%23`은 보존한다.
수정 전 회귀 실패와 수정 후 차단·최종 asset 경로를 검증하고 같은 #200에 추가 커밋한다.

기존 병합 금지는 앞선 사용자 프롬프트의 제한이었다. 후속 사용자 지시와 작업 검토로 #187/#196/#197/
#198/#200의 검증 후 squash 통합을 진행한다. #199의 F production/www 전환 보류와 운영 배포 제외는
유지한다. 이미 병합된 최신 main을 각 작업 브랜치에 반영하고, #200에서는 합쳐진 소스를 검증한다.
G 계획 #187은 문서 충돌과 폐기된 Web 세션 전제를 명시적으로 정정하며 G 구현을 시작하지 않는다.

## 2026-10-23 승인 통합 확정과 다음 재개점

#198 → #196 → #197 → #200 → #187을 검증 후 main에 squash 병합했다.
통합 기준선 BASE-01은 합쳐진 소스의 실제 gate·두 앱 build/smoke·최종 CI 및 병합 tree 일치로 완료했다.
세부 ref·CI·문서 전용 생략·운영 보류의 canonical 근거는 RESULT의 승인 통합 확정 절이 소유한다.
#199 F production/www 전환과 운영 배포는 계속 보류하며 G는 계획만 병합했다.

다음 독립 구현은 **ENV-06 — 앱별 APP_ENV 값 계약과 Web local metadata**다.
최신 원격 migration_main에서 새 feature branch/격리 worktree를 만들고 local/staging/production
consumer·예제·Sentry·site metadata를 대조한다. ENV-07/10의 관련 입력과 범위를 먼저 확인하되
DB-01/02·미확정 ENV-2 credential 전환·개인 env 자동 이관·공통 UI/Base UI를 섞지 않는다.
이번 작업에서는 ENV-06 구현을 시작하지 않는다.

## 2026-10-23 정상화 재개 — ENV-06과 관련 ENV-07 계약

이번 사용자 지시는 범위 내 구현·검증·commit/push·PR과 필수 조건 충족 후 squash 병합까지 승인한다.
과거의 Draft 종료·병합 금지는 당시 이력으로 보존한다. 진입 기준은 fetch한
`origin/migration_main@792a7464007d586a0e19d5c8382fe2c6a50af37b`이며
`feature/monorepo-app-env`를 여기서 분기한다. #187/#196/#197/#198/#200/#201의 병합과 최종 head CI를
원격에서 대조한다. 완료된 BASE-01의 회수·통합·기준선 검증은 반복하지 않는다. #199는 전환 보류다.

- 헌법 §5·11, Runtime §12·12.1, Observability §13과 Testing §4·17을 따른다.
  앱 환경은 `local/staging/production`, Next 실행 모드는 `NODE_ENV`로 구분한다.
  Web site URL의 `development` 분기를 `local`로 맞춰 기본 metadata·Open Graph와 곡/앨범 helper가
  동일한 URL을 사용하게 한다. Sentry와 clientLogger의 기존 활성화 정책은 실제 consumer로 대조한다.
- 완료 조건: `NODE_ENV=development/production` 모두 local metadata는 localhost를 사용하며,
  staging/production의 기존 공개 URL과 Sentry의 DSN 조건을 유지한다. 누락·미지원 값이 local로
  해석되지 않는 회귀를 검증하고 앱별 예제·feature flag 설명과 active Runtime 계약을 맞춘다.
- ENV-07은 같은 값 계약의 설명을 소유한다. local launcher의 명시적 local과 현행 CI/Promotion의
  staging 의미를 기록하며 입력·workflow·운영 환경은 전환하지 않는다. ENV-10의 Console GTM 전달은
  독립 관심사로 남긴다. robots/sitemap의 www 전환은 #199에 유지한다.
- 기본 type-check·lint/FSD·harness·unit·format과 두 앱 build를 실행한다. build는 임시 local 입력·
  빈 DSN·업로드/telemetry OFF·연결 불가능한 loopback DB·가짜 Console/R2 입력으로 수행한다.
  local build의 metadata 산출물을 확인하고 최종 head의 CI·실제 diff·리뷰/보호 조건을 확인한 후 병합한다.
- 다음 후보는 ENV-10의 앱별 GTM 입력 경계이며 이 PR에 선행 의존하지 않는다. DB-01/02는 그 뒤
  별도 단위로 유지한다. ENV-2 credential 전환·개인 env 자동 이관·휴면 메일/flag 제거·UI/Worker는 제외한다.

### 사용자 확정 반영 — local/production 계약

위 ENV-06 최초 구현의 3값 계약과 staging 입력 유지 판단은 2026-10-23 사용자 확정으로 대체한다.
환경은 `local | production`만 사용한다. 비용상 별도 staging 인프라는 두지 않는다. 이 변경은 같은
[PR #202](https://github.com/goldmayo/oioi-bwg/pull/202)에서 기존 커밋을 보존한 후속 커밋으로 반영한다.

- 앱별 `shared/config/app-env.ts`에서 값을 해석하고 Next dev/build 진입점에서 누락·미지원 값을
  거절한다. NODE_ENV에서 앱 환경을 추론하지 않으며 local production build도 명시적 local이다.
  metadata·browser logger·feature flag·Sentry·최종 event sanitizer가 같은 계약을 사용한다.
- 일반 CI 이미지·Docker 기본값·관리자 local smoke는 local, VM용 Promotion candidate는 production을
  사용한다. Sentry는 production+DSN만 허용한다. staging은 활성화·event 허용값에서 제거한다.
  Slack relay는 외부 이벤트의 이전 staging 값을 unknown으로 표시한다. Worker workspace 추출은 제외한다.
- 앱 소스·fixture·Next entry harness·CI 입력 검사·active 문서·기존 Sentry 결과의 후속 안내를 함께
  수정한다. 하나의 환경 전환이라 파일 수 목표를 넘는 결합 이유와 리뷰 순서를 PR에 설명한다.
  변경 코드에 맞춰 기본 gate·두 앱 실제 local build와 metadata HTML·실제 config 거절을 검증한다.
- 앱 환경값의 production 결정은 실제 운영 배포 승인이 아니다. #199의 www/F 전환 보류·운영 배포·
  Worker 배포/외부 알림·staging 이름의 버킷/host/외부 리소스와 접속 대상은 변경하지 않는다.
  새 공개 입력은 차후 승인된 Promotion에서 새 digest로 검증해야 한다.
- 최종 소비자 대조에서 휴면 메일 provider의 NODE_ENV 기반 기본 모드·production 보호 분기를 확인했다.
  MAIL-01의 해당 분기만 같은 APP_ENV 계약으로 맞춘다. 미지원 환경은 OCI client 생성 전에 거절하고
  local의 no-send 기본값과 production의 dev 거절을 SDK mock으로 검증한다. 실제 앱 consumer는 없으며
  회원/메일 기능 재활성화·발송·MAIL-02의 OCI 인증/IMDS 정책 변경은 보류한다.

## 2026-10-23 다음 단위 — ENV-10 Console build 입력

ENV-06 [#202](https://github.com/goldmayo/oioi-bwg/pull/202)의 squash 결과
`e4e61bc2ac0bef35b3fd7987d91f2df185e51ed3`를 fetch한 뒤 여기서 새 feature branch를 만든다.
다른 PR을 미리 쌓지 않는다. 헌법 §5와 Runtime §12·12.1의 앱별 공개 build 입력 책임을 따른다.

- Console candidate에 Web 전용 NEXT_PUBLIC_GTM_ID를 전달하는 build 인자 한 줄만 제거한다.
  Web의 실제 layout consumer와 Web build 인자, 기존 두 앱 단위 buildConfigHash는 보존한다.
  local/production 계약·Sentry 공용 프로젝트·Docker 공통 ARG·운영 설정은 바꾸지 않는다.
- 완료 조건은 Console build 인자에 GTM이 없고 Web 전달과 production candidate 입력이 유지되는 것이다.
  workflow parse/consumer 대조와 관련 ops를 확인한다. 앱/패키지/config/harness 소스가 동일하면 직전의
  타입·unit·lint/FSD·두 앱 build 결과를 재사용하고 필수 push hook·최종 PR CI는 그대로 실행한다.
- 실제 이미지 게시·운영 배포·GTM 외부 요청은 실행하지 않는다. 다음 후보 DB-01/02는 별도 단위이며
  미확정 ENV-2 credential 전환과 개인 env 자동 이관은 포함하지 않는다.

## 2026-10-23 다음 단위 — DB-01/02 도구 입력 통일

ENV-10 #203의 squash 결과 `7e535753ebd1949fc185318ef7361d6a32f5fd0f`를 fetch한 뒤 분기한다.
헌법 §11, Runtime §12~14와 runbook의 local database guard를 따른다. DB schema·SQL·transaction·
권한/역할·Compose credential·개인 env·ENV-2 전체 설정 체계는 바꾸지 않는다.

- process DATABASE_URL 또는 명시적인 `--env-file` 한 파일에서 DB URL만 선택한다. 두 입력이
  다르거나 선택 파일에 값이 없으면 값 비노출 오류로 중단한다. Web env 자동 탐색은 제거한다.
- migrate/pull/studio는 선택·검증한 URL을 같은 child 환경에 전달한다. 연결 대상 override 인자는
  받지 않는다. 기존 local host 세 개와 PostgreSQL protocol을 확인하고 query/fragment는 거절한다.
- 설치된 Drizzle Kit 0.31.9는 root dotenv/config를 내장한다. child는 dotenv 자동 입력을 devNull로
  격리해 검증 후 다른 파일이 URL을 덮어쓰지 못하게 한다. migration generator는 DB 입력 없이 유지한다.
- root Drizzle entry는 그대로 두고 명시적 process URL만 사용한다. 독립 migration CLI와 기존 guard도
  같은 validator를 소비한다. SQL 실행 함수·lock·migration 순서는 바꾸지 않는다.
- package 진입점은 `node --import tsx --`로 실행해 Node가 사용자 `--env-file`을 native 옵션으로
  가로채지 않게 한다. loader만으로는 부족하며 명시적 옵션 구분자가 필요함을 최소 재현으로 확인했다.
  파일 오류·누락도 DB 도구의 동일한 값 비노출 경계에서 처리한다.
- 실제 CLI child의 입력 일치·누락/충돌/원격/override 거절·값 비노출·설정 loader를 검증한다.
  기본 gate와 local Compose의 격리 PostgreSQL runner를 실행하며 개인 DB/볼륨은 보존한다.
  불변 앱 소스의 build 결과는 재사용할 수 있는지 확인하고 최종 hook·CI·리뷰 후 squash 병합한다.

## 2026-10-23 다음 단위 — CFG-10·TEST-05 root 타입 검사

DB-01/02 #204의 squash 결과 `306339bb6898efdeb022e1ed528805f9618f1cc3`를 fetch하고 검증 head와
전체 tree 일치를 확인한 뒤 분기한다. 공유 설정 package/entry 이동(CFG-08/09)과 독립 검증 가능한
검사 누락 보완을 먼저 마친다. 헌법의 검증 경계와 active Testing §14·15·17을 따른다.

- root Drizzle·ops Vitest 설정 두 개를 기존 설정 타입 프로그램에 포함한다. 테스트는 현재 추적 TS
  29개를 Node 28개와 Web adapter foundation 1개로 나누고 기존 repo 검사에 연결한다.
  CI·push hook·verify가 호출하는 repo entry를 재사용하며 별도 필수 gate를 새로 만들지 않는다.
- Web alias는 해당 프로그램만 앱 config에서 상속한다. 기존 PostgreSQL TransactionSql call signature
  보완 선언을 명시적으로 재사용한다. 실행 위치·Vitest 수집·직렬 격리 DB lifecycle은 유지한다.
- 새 검사에서 드러난 fixture·mock·JS 주입 API의 타입 불일치만 보완한다. bigint SQL 인자는 정밀도를
  보존하는 문자열로 전달하고 MFA mock은 실제 query builder의 실행 완료를 보류한다. SQL·잠금·
  권한 단언을 제거하거나 도메인 구현을 타입 검사 편의로 바꾸지 않는다.
- 완료 조건은 두 설정과 모든 root TS tests의 검사 소속·strict/noEmit·Web alias 격리 확인,
  실제 타입 오류 검출과 기존 repo entry 성공이다. 기본 gate·ops·격리 PostgreSQL 회귀를 실행한다.
  앱 runtime/build 입력이 불변이면 검증된 두 앱 build를 재사용하며 최종 head CI·리뷰 후 squash한다.
- 공통 config package 이동·개발 Docker 설치·Worker/test 파일 위치 재편은 다음 독립 단위다.
  운영 배포·production 설정/DB·#199 F 전환·향후 계정·공통 UI 추출은 보류한다.

## 2026-10-23 다음 단위 — CFG-08/09 공유 설정 workspace

CFG-10·TEST-05 #205의 squash 결과 `b386c50585257a46f15bc3e5cfeaa92baa75a102`를 fetch하고
검증 head와 전체 tree 일치를 확인한 뒤 분기한다. 공통 설정 한 개의 private package를 실제
consumer와 함께 도입한다. 앱 자동 탐색 entry·APP_ENV·request/instrumentation adapter는 앱에 둔다.

- `packages/config`가 공통 Next/Sentry build·ESLint/Steiger·Vitest·TS preset과 직접 도구 의존성,
  공개 exports·자체 타입/lint 검사를 소유한다. root와 앱·server/contracts가 workspace 의존성을 선언한다.
  내부 구현을 root alias나 workspace 상대 경로로 우회하지 않는다.
- ESLint rule 구현과 helper를 package가 소유하고 harness가 공개 entry를 소비한다. 공통 Vitest
  marker mock도 package 내부로 옮겨 root tests에 역의존하지 않게 한다. TEST-06의 이 두 mock만
  결합하며 Worker·서버 DB 테스트·k6의 위치 재편은 포함하지 않는다.
- root orchestration 타입 설정은 config/tsconfig.json에 유지하고 package 자체 타입 검사와 구분한다.
  Node lint/project root는 consumer가 명시한다. 브라우저 setup은 package의 자체 경로를 사용하며
  tracing root·app alias·DB test 실행 root는 기존 consumer가 소유한다.
- 분리 가능성을 검토한다. 새 package와 실제 consumer·직접 의존성·core rule/mock 소유권·prod Docker
  manifest·Turbo/harness 경로는 하나의 해석/검사 전환으로 검증한다. 단순 파일 이동이나 미사용 package
  선생성을 하지 않는다. 파일 목표를 넘으면 rename 비중·결합 이유·리뷰 순서를 PR에 설명한다.
- 완료 조건은 package 외부 역참조 부재·공개 entry/명시 의존성·도구의 실제 cwd/loader 호환성·두 앱
  task 선택/hash 보존이다. 기본 gate·두 앱 실제 local build/standalone과 최종 head CI·리뷰 후 병합한다.
  prod Docker에는 새 manifest를 install 전에 포함한다. 기존 개발 Docker의 전체 설치 보완은 RUN-01로
  분리하며 Worker나 계정/UI/배포 확장·#199 F 전환은 보류한다.
- 실제 Node 22.16/Vitest config loader는 외부 TS entry를 실행하지 못했다. 두 Vitest factory는
  ESM JavaScript와 JSDoc @satisfies·package checkJs로 전환한다. 넓은 도구 내부 타입을 공개해
  peer별 nominal type에 결합하지 않고 실제 설정 shape를 유지한다. 전역 loader나 사전 빌드는 추가하지 않는다.
  Next·ESLint·Steiger의 TS loader와 두 앱 실제 build는 별도로 확인한다.

## 2026-10-23 다음 단위 — RUN-01 개발 Docker workspace 설치·실행

CFG-08/09 #206의 squash 결과 `34bcab0d3db53258dfb05834956798ea7a01ebf3`를 fetch하고 검증 head와
전체 tree 일치를 확인한 뒤 분기한다. Dockerfile.dev의 install 전 manifest와 개발 Compose의
workspace node_modules 보존만 수정한다. production 이미지·운영 Compose·DB credential/volume은 유지한다.

- root와 Web뿐 아니라 Console·config·contracts·server manifest를 frozen install 이전에 복사한다.
  root 소스 bind mount가 package의 설치 의존성을 가리지 않게 모든 workspace node_modules를 보존한다.
  기존 named dependency volume은 rebuild만으로 갱신되지 않으므로 host install·lock 검토 후 의존성
  volume만 재생성하는 사용법을 기록한다. DB volume 초기화·임의 seed·개인 env 자동 이관은 하지 않는다.
- 완료 조건은 새 image의 전체 workspace frozen install, 빈 임시 volume과 소스 bind mount 상태의
  package 해석/자체 검사·Web dev 실제 실행이다. 임시 추적 소스 복사본·가짜 local env·loopback의
  연결 불가능한 DB URL·빈 DSN/GTM·telemetry OFF로 검증한다. 기존 Compose postgres를 시작/중단하거나
  기존 volume을 삭제하지 않는다. 테스트 자원은 고유 project/image 이름으로 만들고 명시적으로 정리한다.
- 앱/공통 package/build 입력이 불변이면 #206의 타입/unit/두 앱 build/standalone 결과를 재사용하고
  변경 YAML·Docker 동작을 직접 검증한다. 필수 hook·최종 head CI·리뷰 후 squash한다. 이후 Worker가
  workspace로 추가되면 manifest/volume 영향은 해당 단위에서 재점검한다. 다른 lifecycle/UI/배포는 제외한다.

## 2026-10-23 다음 단위 — UI-01/02 앱별 scaffold 설정

RUN-01 #207의 squash 결과 `78d5d5e0ccd95a2b807c0367229446ff03c29f2a`를 fetch하고 검증 head와
전체 tree 일치를 확인한 뒤 분기한다. Frontend/FSD와 헌법의 앱별 자동 탐색 entry 소유권을 따른다.

- Web의 잘못된 utils/lib/hooks·shared root 생성 alias를 실제 shared/lib·shared/ui로 맞춘다.
  Console에도 동일한 앱 소유 설정을 추가한다. 각 앱의 CSS/cn 경로와 @ alias를 사용한다.
- 기존 Web style·Tailwind v4·RSC/TSX·icon 설정을 유지한다. 컴포넌트 생성/덮어쓰기·primitive 교체·
  Base UI 전환·공통 UI package 추출은 하지 않는다. UI-03은 별도 후속이다.
- 완료 조건은 설치된 shadcn 3.8.5의 두 앱 `info`가 설정을 인식하고 모든 resolved path가 해당 앱에
  속하며 실제 CSS/cn/디렉터리가 존재하는 것이다. 공식 components.json schema/CLI와 대조한다.
  CLI info는 경로 존재를 보장하지 않으므로 별도로 확인한다. 포맷·diff와 불변 runtime 입력을 대조하고
  #207의 기존 앱 검사/build 결과를 재사용하며 필수 hook·최종 CI/리뷰 후 squash한다.

## 2026-10-23 다음 단위 — ENV-08/09 미사용 설정 수명주기

UI-01/02 #208의 squash 결과 `be513f4f3c1f133db775ee9b124a7c71549b33c1`를 fetch하고 검증 head와
전체 tree 일치를 확인한 뒤 분기한다. Runtime의 명시적 앱 설정·Frontend/FSD의 실제 consumer 기준과
사용하지 않는 추상화를 선생성하지 않는 원칙을 따른다. React/Server Action 경계 검토에는 저장소의
vercel-react-best-practices 지침을 참고하며 인증/인가 SSOT를 유지한다.

- Careon flag는 내부 wrapper 두 개만 참조하고 route/action/feature consumer가 없다. 추적 소스의
  import graph·CLI/config·active architecture/Domain Specification·가이드를 대조한다. 가이드는 다른
  프로젝트의 TypeORM/경로 예제이며 현재 예정 기능의 승인 근거가 아니다. 세 휴면 파일을 제거하고
  가이드는 출처·superseded 이유·현재 Runtime/Auth 안내를 붙여 본문을 보존한다.
- Compose NEXT_PUBLIC_ASSETS_URL은 active consumer가 없어 주입을 제거한다. 실제 Console의
  ASSETS_PUBLIC_BASE_URL·R2 설정·기존 assets host와 버킷·개인 env는 유지한다.
- 완료 조건은 외부 참조/예정 consumer 부재 근거·삭제 후 dangling import 부재·현재 환경 계약의
  안내 분리와 기존 Web 동작 유지다. 기본 gate와 Web 실제 local build/browser를 검증한다. Console·
  서버/DB 등 불변 입력의 기존 검증은 재사용하고 필수 hook·최종 head CI/리뷰 후 squash한다.
  계정·메일·feature flag 재활성화·운영/외부 리소스 변경·#199 F 전환은 제외한다.

## 2026-10-23 다음 단위 — ROOT-01 release 도구 수명 종료

ENV-08/09 #209의 squash `0018902f60108606f6ac7ad11cfde1a8f31e8375`를 fetch하고 검증 head와
전체 tree 일치를 확인한 뒤 분기한다. 현재 active 배포 runbook §21은 source SHA·immutable image digest와
별도 Promotion을 사용한다. release-it의 tracked 실행 참조는 root script·설정·직접 의존성과 과거 안내뿐이다.

- release script·release-it·전용 changelog plugin·설정만 제거한다. package 버전·CHANGELOG와 tag 이력은
  보존한다. 과거 DEPLOYMENT 가이드는 원문/anchor·출처를 보존하고 superseded와 현재 runbook을 명시한다.
- lockfile은 전용 하위 의존성만 pruning하며 남은 package/snapshot과 다른 importer의 해석이 불변인지
  구조적으로 비교한다. 기존 peer 경고나 무관한 도구 버전은 정리하지 않는다.
- 완료 조건은 frozen install, 현재 script/CI/CLI 경로에 dangling 참조 부재, 기본 검사 및 변경된 설치
  입력에서 실제 local 양 앱 build 성공이다. 불변 서버/DB 검증은 재사용한다. 최종 head CI·리뷰 후 squash한다.
  release 실행·tag/Release 생성·배포와 Worker/다른 테스트 소유권 변경은 포함하지 않는다.

## 2026-10-23 다음 단위 — RUN-03 독립 relay workspace

ROOT-01 #210의 squash `aeb9336c9e6aa2e39b4c15dd7c17c8506bd80987`를 fetch하고 최종 검증 tree 일치 후
분기한다. 실제 독립 서비스가 소스·타입/lint/unit·도구 실행 위치를 소유하도록 기존 relay를
private apps/sentry-slack-relay로 이관한다. TEST-06 중 이 Worker unit 이관만 함께 완료한다.

- handler·Wrangler 설정과 required secret/Worker 이름·주소는 byte 단위로 보존한다. root ops의 unit을
  앱 tests로 옮기고 root unit/coverage·Turbo의 같은 파일 수집, Node 환경/alias 격리와 `.mts` coverage를
  확인한다. Worker 자체 strict 타입/lint와 root/pre-commit의 runtime import 경계를 연결한다.
- Wrangler는 기존 고정 4.135.0 dlx 수동 계약을 유지한다. Next build task·OCI runtime에 넣지 않는다.
  tracked source만 복사한 임시 디렉터리에서 credential 없이 API loopback·metrics OFF로 dry-run만 한다.
  과거 배포/수신 증거와 현재 소스 이관·미배포는 구분한다. 개인 env/로컬 상태를 자동 이동하지 않는다.
- 새 workspace manifest와 개발 node_modules volume을 함께 연결하고 안내를 갱신한다. 고유 임시
  Compose 프로젝트에서 clean frozen install·7 workspace 해석/native·빈 volume+bind mount·Web dev
  health/metadata/browser를 검증하고 임시 자원만 정리한다. 원래 PG·데이터·cache는 보존한다.
- lock은 새 importer만 추가하고 기존 package/snapshot/importer 해석을 보존한다. 실제 Turbo/Git fixture로
  Worker source의 보수적 양 앱 image 영향 판정을 유지한다. production Docker/CI 구조는 바꾸지 않는다.
- 완료 조건은 위 로컬 검증·기본 gate·최종 head CI/리뷰와 squash다. Next product 소스/공통 DB가 불변이면
  앞선 실제 build/standalone·격리 PG 결과를 재사용한다. server DB/k6 소유권은 후속이며 외부 배포·전송은 제외한다.

## 2026-10-23 다음 단위 — TEST-06 서버 DB 테스트 소유권과 수동 도구 판정

RUN-03 #211의 squash `e6d8126bd8e9284f1bc7ba8a727e5ca73b083ab2`를 fetch하고 최종 검증 tree 일치 후
분기한다. 서버 repository/service만 검증하는 p05a/p05b2 두 파일을 packages/server/tests/integration으로
옮기고 서버 strict 타입 프로그램이 소유하게 한다. fixture/SQL·guard·assertion은 유지하고 otplib 해석의
package-relative 기준만 맞춘다. runtime·migration·DB schema·의존성은 변경하지 않는다.

- root PostgreSQL project는 새 경로를 한 번씩 수집한다. foundation의 Web alias/HTTP 409와 root
  operator CLI 테스트, guarded runner의 PG17·격리 DB/역할 생성·직렬 실행/정리는 유지한다. 일반 서버
  unit에는 integration을 포함하지 않는다. harness로 타입 소속·수집/alias 격리·중복 부재를 확인한다.
- 완료 조건은 기본 검사와 실제 local runner의 동일 4파일/33건·연결/lock·임시 DB/역할 정리다.
  불변 제품/설치 입력의 build/standalone은 #211 최종 CI를 재사용한다. 필수 hook·최종 CI/리뷰 후 squash한다.
- k6 네 파일은 Web URL/song slug를 사용하는 dependency 없는 수동 외부 검증 도구다. app import·unit
  환경·일반 CI가 소비하지 않고 root의 test:load/stress/spike가 실행 진입점을 소유한다. 실행 책임을
  명시하고 root에 보존한다. 폴더 미관만으로 이동하지 않으며 기존 외부 hostname·대상을 바꾸거나 부하
  테스트를 실행하지 않는다. 현재 Runtime은 Next이며 과거 Wrangler/staging 설명은 DOC-01에서 구분한다.
- 공통 marker는 #206, Worker unit은 #211로 소유권 이관을 마쳤다. tests/ops의 배포/호스트/이미지/
  두 앱 smoke·fixture는 root 소유를 유지한다. 개발 안내와 보존 결정의 최종 정리는 다음 문서 단위다.
