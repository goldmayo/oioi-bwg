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
