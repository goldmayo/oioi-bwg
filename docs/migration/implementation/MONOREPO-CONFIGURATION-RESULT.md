---
title: "모노레포 설정 공통화와 구조 개선 실행 결과"
kind: migration-result
status: in-progress
source_commit: 4d5e42dac37aeb13b3279b47a7907fbb7bc91be2
created_at: "2026-10-22"
---

# 모노레포 구조 개선 실행 기록

[계획과 원문 매핑](MONOREPO-CONFIGURATION-PLAN.md)을 따른다.
아래 체크는 구현뿐 아니라 적용 제외·보존 판단까지 근거를 점검했다는 의미다.
운영 상태나 외부 전송 성공을 뜻하지 않는다.
현재 구현·통합 상태는 아래 체크리스트와 날짜별 최신 실행 절을 따른다.
과거 미병합 표시와 검증 수치는 해당 ref·시점의 이력으로 보존한다.

## 원문 항목 체크리스트

| 점검 | ID | 결과와 근거 |
| --- | --- | --- |
| [x] | ENV-01 | #198의 Console R2 예제·launcher 필수 입력 검사가 ef0e122에 병합됐다. 실제 업로드는 미검증이다. |
| [x] | ENV-02 | #198의 host 공개 입력·Vault 매핑 예제와 누락 거절 fixture가 ef0e122에 병합됐다. 운영 주입은 미검증이다. |
| [x] | ENV-03 | #200이 4b08beb에 병합됐다. readiness/업로드의 필수 입력·빈 URL 구분자 거절·정규화·503/no-store·값 비노출을 검증했다. 실제 R2 업로드는 미검증이다. |
| [x] | ENV-04 | #198에서 Web DATABASE_URL 예제를 추가했다. 개인 env 변경 없이 회수 코드·검증 증거를 재판정했다. |
| [x] | ENV-05 | 개인 비추적 env의 값 유무는 브랜치 결함에서 제외한다. 두 앱 추적 예제는 local을 명시하며 개인 파일을 수정하지 않았다. |
| [x] | ENV-06 | 사용자 확정 local/production만 허용하며 Next dev/build에서 누락·미지원 값을 거절한다. metadata·logger·Sentry·최종 event/relay와 예제·CI 입력을 맞췄다. 아래 확정 계약 실행 절 참조. |
| [x] | ENV-07 | 로컬 production build·일반 CI는 local, VM용 Promotion은 production이다. Docker 기본값도 local이며 staging 앱 환경을 폐기했다. 실제 운영 배포·#199 www/F 전환은 보류다. |
| [ ] | ENV-08 | 대기 |
| [ ] | ENV-09 | 대기 |
| [ ] | ENV-10 | 대기 |
| [x] | MAIL-01 | 휴면 provider의 NODE_ENV 모드 추론을 같은 local/production 계약으로 수정했다. local 기본 no-send·production dev 거절·미지원 값의 OCI 이전 거절을 SDK mock 12건으로 검증했다. 재활성화/실제 발송은 보류다. |
| [ ] | MAIL-02 | 대기 |
| [x] | OBS-01 | #198의 Runtime §12.1·앱 예제·배포 안내가 공용 Sentry 프로젝트 유지와 앱별 입력 책임을 명시한다. 프로젝트 분리·외부 변경 없음. |
| [x] | OBS-02 | #198의 Console NEXT_PUBLIC_SENTRY_DSN 예제와 local 전송 비활성 안내가 ef0e122에 병합됐다. |
| [ ] | DB-01 | 대기 |
| [ ] | DB-02 | 대기 |
| [x] | CFG-01 | 공통 app policy에서 규칙 11개를 한 번 정의하고 두 앱이 같은 factory를 사용한다. |
| [x] | CFG-02 | 앱별 ESLint 진입점과 실행 cwd를 분리했다. root는 앱 policy 파일 대신 공통 factory만 조합한다. |
| [x] | CFG-03 | Node 기본 규칙은 typescript-eslint 8.56.1을 직접 소비하고 Next preset은 앱에만 적용한다. |
| [x] | CFG-04 | entities/*/api 공개 entry를 허용한다. alias·상대 경로의 내부 파일 우회와 같은 레이어의 다른 slice 참조는 회귀 검사로 차단한다. |
| [x] | CFG-05 | 네 Album/Song root에서 browser Query/Mutation을 분리하고 양쪽 HTTP transport에 client-only를 적용했다. RSC 거절 검사·정상 build·standalone browser smoke로 검증했다. |
| [x] | CFG-06 | root/pre-commit/package가 동일한 server/contracts 경계 규칙을 적용한다. 실제 lintText 회귀로 확인했다. |
| [x] | CFG-07 | 누락된 운영 .ts 8개를 strict 타입 검사에 포함했다. 기존 .mts NodeNext 검사는 유지하고 repo/CI/push 경로의 실제 오류 검출과 소스별 검사 소속을 검증했다. |
| [x] | TEST-01 | 두 앱이 각자의 Vitest root·alias·include를 소유한다. 공통 browser preset/setup과 root의 프로젝트 선택 책임을 분리하고 수집 파일·환경 보존을 검증했다. |
| [x] | TEST-02 | root unit·coverage의 실행 대상을 네 workspace로 맞췄다. Turbo와 같은 81파일·410건을 실행하며 환경·제외·alias를 보존한다. coverage 측정 경로는 TEST-03에서 수정한다. |
| [x] | TEST-03 | 없는 Web 경로를 실제 네 workspace src 경로로 교체했다. coverage 276개 소스를 추적 목록과 대조했고 미실행 소스의 0회 기록과 테스트·선언 제외를 확인했다. |
| [x] | TEST-04 | Web adapter를 쓰는 foundation만 Web 소유 project로 한정했다. 서버 세 파일에는 Web alias가 없으며 실제 PostgreSQL 4파일·33건과 직렬 Node 실행·DB 정리를 검증했다. |
| [ ] | RUN-01 | 대기 |
| [x] | RUN-02 | Web 관리 route·forbidden consumer 제거로 적용 제외한다. Console의 실제 admin layout consumer와 authInterrupts 옵션은 유지했고 공통 experimental 옵션의 보존도 검증했다. |
| [ ] | UI-01 | 대기 |
| [ ] | UI-02 | 대기 |
| [ ] | DOC-01 | 대기 |
| [ ] | ROOT-01 | 대기 |
| [ ] | ROOT-02 | 대기 |
| [ ] | ROOT-03 | 대기 |
| [ ] | ROOT-04 | 대기 |
| [x] | MAIN-01 | #198에서 Web 예제의 종료된 인증·메일·업로드 입력을 제거했다. host rollback 매핑과 개인 env는 보존한다. |
| [ ] | MAIN-02 | 대기 |

## 2026-10-22 추가 논의 체크리스트

현재 원문 38개는 **처리 23개·대기 15개**다. 기존 처리 20개에 ENV-06·관련 ENV-07·MAIL-01을 더했다.
아래 과거 단계의 개수는 당시 이력이다. 정상화 추가 항목 7개와 후속 UI 검토 1개를
별도로 등록한다. 총 추적 ID는 46개다. 추가 8개 중 BASE-01은 처리됐으며 나머지 7개는 검토/대기다.
대기에는 결함뿐 아니라 기준선 확정·구조 제안·보존 판단이 포함되므로 미해결 runtime 결함 수로 읽지 않는다.
등록 당시 조사와 아래 현재 완료 근거를 구분하며, 다른 대기 항목의 구현 완료로 확대하지 않는다.

| 점검 | ID | 범위 | 현재 상태와 후속 기준 |
| --- | --- | --- | --- |
| [x] | BASE-01 | Sentry 통합 기준선 | #196/#197/#198을 반영한 #200의 4443d64에서 전체 gate·두 앱 build/browser smoke, 최종 head 68d7756의 전체 CI가 성공했다. 4b08beb squash 결과와 검증 tree 일치를 확인했다. 운영 수신/소스맵은 별도다. |
| [ ] | CFG-08 | 공통 config workspace 패키지 | packages/config 한 개로 시작하는 구조 제안이다. manifest·exports·소비자 의존성·도구 소유권·실행 호환성 검토와 구현은 대기다. |
| [ ] | CFG-09 | workspace 간 import 계약 | 명시적 package entry로 상대경로를 대체하는 제안이다. 앱 내부 alias·slice 내부 상대경로·파일시스템 경로 계산은 구분하며 변경은 대기다. |
| [ ] | CFG-10 | 루트 설정 TS 검사 | drizzle.config.ts와 vitest.ops.config.ts가 현재 타입 프로그램에 없음을 확인했다. CFG-07의 운영 스크립트 8개 완료와 별도로 보완한다. |
| [ ] | TEST-05 | 루트 tests TS 검사 | tests 아래 추적 TS 28개 모두 현재 type-check 프로그램에 없다. integration 4·ops 22·mocks 2의 환경별 검사 소속 보완은 대기다. |
| [ ] | RUN-03 | Worker workspace 소유권 | 독립 배포 서비스의 apps/sentry-slack-relay 이동·패키지 등록 제안이다. 기존 workers 위치도 유효하며 경로·검사·배포 경계 정리는 대기다. |
| [ ] | TEST-06 | tests 위치·책임 정리 | 총 52개 파일의 검증 대상을 분류했다. root 통합 검증은 유지하고 Worker·server 전용 테스트·Web 성능 테스트·공통 mock의 소유권 분리는 검토 대기다. |
| [ ] | UI-03 | 정상화 이후 공통 UI | 정상화와 최종 통합 검증 뒤 별도로 실제 재사용을 조사한다. 패키지 선생성·일괄 이관을 승인하거나 완료한 상태가 아니다. |

재개 순서와 각 ID의 완료 조건은 [PLAN의 추가 논의](MONOREPO-CONFIGURATION-PLAN.md#2026-10-22-추가-논의-반영--재개-순서와-소유권),
조사 기준과 근거는 이 문서 끝의 중간 점검 기록을 따른다. 기존 단계별 이력의 수치와 당시 미배포 표시는
그 시점의 사실로 보존한다.

## 단계별 로컬 검증과 리팩토링 점검

구현·검증·커밋이 끝난 순서대로 실제 결과만 추가한다.


### 1단계 — 공통 검사 기반

- 최초 체크리스트 commit: `f1f8e57`. 원문 38개 ID를 누락 없이 등록했다.
- `pnpm install --frozen-lockfile` 성공. Next/eslint-config-next를 lockfile의 16.4.1로 맞췄다.
- 최초 기준 검사에서 Web `.next/types/validator.ts`가 제거된 관리 route를 참조해 실패했다.
  `SENTRY_SOURCE_MAPS_ENABLED=false pnpm --filter @oioi-bwg/web exec next typegen`으로
  생성 타입만 재생성한 뒤 `pnpm exec turbo run type-check lint test`, `pnpm type-check:repo`,
  `pnpm test:harness` 기준 검사가 성공했다. 개인 env·로컬 생성 파일은 삭제하지 않았다.
- ESLint 공통 규칙과 앱별 경로를 분리하고 Node 기반의 Next 의존을 제거했다.
  server/contracts 경계도 공통 config가 소유하며 root hook과 package lint가 동일하게 소비한다.
- Steiger 규칙은 `config/steiger.mjs`, 자동 탐색 entry는 각 앱 및 root에 둔다.
  공유 `.mts`를 현재 Steiger loader가 읽지 못해 실패한 뒤 Node가 직접 읽는 `.mjs`로 수정했다.
- 로컬 검증: `pnpm type-check`, `pnpm lint`(양쪽 FSD 포함), `pnpm test:harness` 19건,
  `pnpm type-check:repo`, `git diff --check` 성공.
- 실효 설정 비교: 두 앱 모두 공통화 전후 rules 차이 0개, root/app rules도 동일하다.
  공통 config 변경이 두 앱 type-check/lint/test/build task를 선택·무효화하는 회귀 검사를 추가했다.
- 리팩토링 점검: 앱 간 import와 앱 policy 로딩 결합을 제거했고 공통 factory 입력은 실제 root 경로뿐이다.
  앱별 예외·인가 정책·runtime business code는 바꾸지 않았다. 테스트의 임시 파일은 종료 후 제거됐다.
- 다음 단계: CFG-04/05의 browser API 공개 경계. 전체 runtime/build 검증과 최종 PR은 아직 미실행이다.

### 1단계 push 검증

- 구현 commit: `bb9a0c99cb0d9d71154530ffcd7c18ffb638af95`. 체크리스트의 38개 ID가
  모두 고유함을 검사했고 CFG-01/02/03/06의 4개를 완료 처리했다. 나머지 34개는 대기다.
- root Steiger entry로도 Web/Console 각각 `pnpm exec steiger <앱 src> --config steiger.config.ts` 성공.
- `git push -u origin feature/monorepo-configuration-cleanup` 성공.
  pre-push hook이 실행한 workspace type-check/lint/test 12개 task, repo 타입/lint,
  harness 19건, ops 262건, format:check 모두 성공했다. workspace unit은
  contracts 3 + server 88 + Web 93 + Console 226 = 410건이다.
- 기존 로컬 jq 경로 `.local/p06-c/bin`을 push 프로세스 PATH에 추가했다.
  hook을 생략하지 않았고 실제 실행 결과를 별도 계획 검증으로 바꾸어 기록하지 않는다.
- 최종 커밋 범위 diff 검사에서 계획 문서 끝의 불필요한 빈 줄을 발견해 제거했다.
  이는 실행 증적 기록과 함께 후속 문서 commit으로 보정하며 구현 commit은 합치지 않는다.
- 현재 단계에서는 build·standalone smoke·운영 연결을 실행하지 않았다.
  전체 작업 완료 후 하나의 PR로 제출하는 계획을 유지한다.

### 1단계 후속 — 공유 설정 TS 통일

사용자의 추가 지시에 따라 `88920c7509fe4d779cc5914e64d463c17716a834` 다음 변경에서
공유 설정과 관련 entry/검사 구현을 TypeScript로 통일했다. 앞 절의 `.mjs` 로딩 방식은 당시 이력이며
현행 구현은 아래 `.ts` 및 명시적 loader를 따른다. 원문 38개 ID와 완료 4개/대기 34개의 판정은 보존한다.

- [x] 공통 ESLint 6개·Steiger 1개, ESLint entry 5개와 Steiger entry 3개,
  공통 architecture rule/path 2개와 Web 재수출 entry 1개: 총 18개를 `.ts`로 검사한다.
- [x] `config/tsconfig.json`이 strict와 `allowJs: false`로 위 소스를 포함한다.
  `pnpm type-check:config`를 `type-check:repo`에 연결해 기존 CI와 push hook도 검사한다.
  CFG-07의 운영 스크립트 전체 검사 범위는 이 설정 전환과 구분해 대기로 유지한다.
- [x] ESLint는 기존 jiti 2.6.1로 TS entry를 읽는다. Steiger 명령은 기존 `NODE_OPTIONS`를
  보존하며 `--import tsx`를 추가한다. Node harness도 `node --import tsx --test`로 연결한다.
  별도 JS 산출물·호환 wrapper·새 dependency·Node 버전 변경은 없다.
- [x] ESLint TS entry로 바꾸면서 parser의 root 자동 추론 충돌을 회귀 검사에서 발견했다.
  root/app/package별 `tsconfigRootDir`을 명시해 parsing error 없이 기존 금지 규칙이 적용되도록 했다.
  architecture rule의 directive 판정은 명시적 타입 가드로 표현하고 기존 동작을 보존했다.
- [x] Turbo의 root ESLint 입력과 공통 config 변경 회귀 fixture를 TS 경로로 갱신했다.
  19개 harness에서 root/app/package 판정과 양쪽 앱의 task 선택·hash 변경을 검증했다.

실행한 로컬 검증:

- `pnpm type-check:config`, `pnpm type-check`, `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:harness` 19건, `pnpm test:unit:run` 410건, `pnpm format:check`, `git diff --check`: 성공.
- root Steiger도 `NODE_OPTIONS="--import tsx" pnpm exec steiger <앱 src> --config steiger.config.ts`로
  두 앱 모두 성공했다. 직접 실행 시에도 TS loader를 명시한다.
- 실효 설정 비교: Web/Console/server/contracts 대표 파일의 전후 rules/settings 차이 0개.
- TypeScript 프로그램 소속을 조회해 18개 설정/구현 파일이 모두 포함되고 자체 JS source가 0개임을 확인했다.
  메모리 안에서 rule severity를 잘못된 값으로 바꿨을 때 실제 TS2322가 발생했다. 디스크 소스는 변경하지 않았다.
- 리팩토링 점검: 공통 설정 디렉터리의 JS 잔존 0개, 오래된 import/캐시 입력 연결 없음,
  `any`·`as unknown`·타입 검사 억제 지시 없이 통과했다. 기존 JS 테스트/ops 도구는 범위 밖이며 유지한다.
- 이번 변경은 검사 도구의 설정/타입/loader에 한정된다. build·standalone smoke·운영 연결은 미실행이다.

### 2단계 — CFG-04/05 브라우저 API 공개 경계

- 진입 기준: `9f8ade404b9b53df63015fefab55819e846e6d18`. fetch 후 로컬 HEAD와
  `origin/feature/monorepo-configuration-cleanup`이 같고 작업 트리가 깨끗함을 확인했다.
  `origin/migration_main`은 원문 재판정 기준인 `4d5e42d`를 유지했다.
- Notion 원문의 최신 편집 시각과 현행 재판정 기준이 기존 계획과 같음을 확인했다.
  원문 38개 ID를 유지하며 CFG-04/05를 추가 완료했다. 누적 완료 6개, 대기 32개다.
- 공통 architecture rule은 `entities/*/api`만 두 번째 공개 entry로 허용한다.
  `api/queries`, `api/mutations`, `api/index`, model 내부 우회는 alias와 상대 경로 모두 거절한다.
  같은 레이어의 다른 slice 참조와 feature/widget의 내부 segment 참조 금지는 유지했다.
  import·named/star export·dynamic import를 두 앱의 경로로 회귀 검사했다.
- Web/Console의 Album/Song root에서 browser Query/Mutation 재수출을 제거했다.
  model/UI와 server-safe query key는 root에 유지하고 Console consumer 3곳은 `api` 공개 entry로
  연결했다. 기존 query key·hydration·invalidation identity와 DTO 계약은 바꾸지 않았다.
- 양쪽 HTTP transport에 `import "client-only"`를 적용하고 이를 생략했던 과거 주석을 수정했다.
  네 API 회귀 테스트도 root의 query key와 API entry의 query options를 실제로 비교하도록 갱신했다.
- 새 import graph harness는 tree shaking 없이 두 앱의 root export 전체를 따라가 browser acquisition이
  포함되지 않음을 확인한다. API entry에서 HTTP transport와 `client-only` marker에 도달함도 검사한다.
  Vitest의 marker mock과 구분한 정적 검사이며 실제 Next compiler 검증은 아래처럼 별도로 수행했다.

실행한 로컬 검증:

- `pnpm type-check`(repo/config 포함), `pnpm lint`, `pnpm lint:fsd`: 성공.
  최종 API 테스트 import와 정상 build가 재생성한 Next 타입을 포함해 타입/lint를 재검사했다.
- `pnpm test:harness`: 24건 성공. `pnpm test:unit:run`: contracts 3 + server 88 + Web 93 +
  Console 226 = 410건 성공. 기존 consumer의 HTTP 오류·mutation 후 invalidation 회귀도 포함된다.
- 두 앱에 각각 임시 RSC route를 만들고 `pnpm --filter @oioi-bwg/<앱> exec next build`를 실행했다.
  RSC → HTTP transport 참조가 두 앱 모두 `client-only` compiler error로 거절됐다.
  직접 만든 임시 route만 제거한 뒤 `pnpm build`로 두 앱이 모두 성공했다(캐시 사용 0개).
- 정상 standalone 산출물을 임시 loopback 포트에 띄워 기존 `web-standalone-smoke.mjs`와
  `console-standalone-smoke.mjs`를 실행했다. Web 공개 URL·인증/관리 종료·정적 asset,
  Console 전용 cookie·로그인 redirect·hydration 및 브라우저 runtime 오류 검사가 성공했다.
- build/smoke 프로세스는 local 환경, Sentry 업로드 비활성화, 접속 불가능한 loopback DB 주소와
  임시 인증 입력을 사용했다. DB 연동 관리자 전체 E2E·운영 서비스 연결 검증은 실행하지 않았다.
- `pnpm format:check`, `git diff --check`: 성공. 검증 로그와 임시 검증 runner는
  `.local/monorepo-config/browser-api/`에 보존한다.

리팩토링 점검:

- 기존 경로 resolver를 재사용해 alias·상대 경로를 같은 조건으로 판정한다.
  새 wrapper·설정 계층·의존성 없이 공개 entry 예외만 추가했다.
- 네 root export의 browser acquisition 유입, consumer의 내부 파일 우회, 같은 레이어 참조를 확인했다.
  서버 key와 browser options를 이중 정의하지 않고 기존 key를 공유한다.
- API 테스트는 공개 entry의 query identity와 기존 HTTP/DTO 계약을 검사하며,
  import graph와 Next 음성 검증이 서로 다른 경계 실패를 검출한다.
- Next/Vitest/DB 설정, 개인 env·볼륨·MFA 키, 운영 DB·VM·Vault·secret은 변경하지 않았다.
  다음 단계는 CFG-07 및 TEST-01~04의 검사 범위와 테스트 책임 정리다. 최종 PR은 전체 작업 후 생성한다.

### 3단계 — CFG-07 운영 TypeScript 검사

- 진입 기준: `4e012b9fb611a730ff420b81a5c8b97391722db5`. fetch 후 로컬과 같은 이름의
  원격 작업 브랜치가 같고 작업 트리가 깨끗함을 확인했다. 이전 계획·검증 이력은 보존했다.
  원문 38개 항목 중 CFG-07을 추가 완료해 누적 완료 7개, 대기 31개다.
- 기존 root 타입 프로그램은 `scripts/dev-console-local.mts`와 Sentry relay worker `.mts`만
  포함했다. NodeNext 검사와 기존 공통 설정 18개의 strict 검사는 그대로 유지한다.
- `scripts/tsconfig.json`은 기존 Node preset을 상속하고 ESNext/Bundler·`allowJs: false`를 적용한다.
  `tsx` 실행과 esbuild bundle이 사용하는 확장자 없는 import를 검사하며 JS 도구를 포함하지 않는다.
  `type-check:scripts`를 `type-check:repo`에 연결해 기존 type-check·verify·CI·push hook에서 실행한다.
- 새 프로그램은 운영 `.ts` 8개와 타입 보완 선언 1개를 포함한다. 기존 `.mts` 2개와 합쳐 tracked
  운영 TypeScript 소스 10개에 누락이 없는지 harness가 실제 compiler root 목록과 대조한다.
- 최초 검사에서 migration·runtime role 스크립트의 TS2349/TS2345를 발견했다.
  설치된 postgres 3.4.8의 `Omit<Sql, ...>`이 transaction 호출 서명을 잃는
  [공식 이슈 #1143](https://github.com/porsager/postgres/issues/1143)와 일치한다.
  스크립트 프로그램의 `scripts/types/postgres.d.ts`에 사용 중인 tagged query·문자열 식별자 호출만
  보완했다. 연결 전용 `begin`/`end`는 추가하지 않으며 upstream 수정 버전 적용 시 제거한다.
- 두 스크립트의 transaction 내부 helper 인자를 `Sql`에서 실제 `TransactionSql`로 수정했다.
  SQL·권한·lock·migration 순서·드라이버 버전·dependency/lockfile은 변경하지 않았다.

실행한 로컬 검증:

- `pnpm type-check:scripts`, `pnpm type-check`(기존 repo/config 및 새 scripts 검사 포함),
  `pnpm lint`, `pnpm lint:fsd`: 성공. 최초 lint에서 외부 선언의 기본 제네릭 `{}` 중복 표기를
  지적해 보완 선언에서는 원본 default를 상속하도록 정리한 뒤 다시 통과했다.
- `pnpm test:harness`: 26건 성공. 신규 2건은 운영 소스 누락과 transaction 타입 계약을 보호한다.
  잘못된 값·행 필드 타입, 직렬화 불가능한 SQL 입력, transaction의 연결 API 참조가 거절되고
  정상 식별자 조립은 허용되는지 메모리 안의 compiler fixture로 확인했다.
- 임시 운영 `.ts`에 잘못된 값을 넣고 실제 `pnpm type-check:repo`를 실행해 TS2322로 실패함을
  확인했다. 직접 만든 임시 파일은 종료 시 제거했다. 운영 스크립트 본문은 실행하지 않았다.
- `pnpm test:unit:run`: contracts 3 + server 88 + Web 93 + Console 226 = 410건 성공.
- 두 스크립트의 변경 전 기준과 변경 후 소스를 esbuild로 변환해 생성 JavaScript가 각각 동일함을
  확인했다. 타입 선언과 검사 연결만 바뀌었으므로 이번 단계의 앱 build·standalone smoke는 미실행이다.
  앞 단계의 build/smoke 성공을 이번 변경의 실행 결과로 재사용하지 않는다.
- `pnpm format:check`, `git diff --check`: 성공. 최초 실패·최종 성공·음성 검사·출력 비교 로그는
  `.local/monorepo-config/script-types/`에 보존한다.

리팩토링 점검:

- root의 NodeNext와 scripts의 실행 방식을 섞지 않고 기존 Node preset을 재사용했다.
  별도 runner·설정 framework·runtime wrapper·새 dependency는 추가하지 않았다.
- 타입 보완은 스크립트 프로그램에 한정하며 호출 서명을 한 곳에서 소유한다. `any`, 강제 cast,
  타입 검사 억제로 오류를 숨기지 않고 transaction 전용 계약을 회귀 검사로 유지한다.
- 두 helper 파일의 생성 JavaScript가 동일하므로 DB 실행·인가·환경 로딩 동작은 유지된다.
  DB·MFA 운영 명령, 개인 env·볼륨·키, VM·Vault·secret은 변경하거나 실행하지 않았다.
- TEST-01~04의 Vitest entry·unit/coverage 범위·PostgreSQL alias 정리는 대기다.
  다음 작업은 TEST-01~03을 작은 단위로 나눠 진행하고 TEST-04의 실제 Web adapter consumer를 보존한다.

### 4단계 첫 단위 — TEST-01 앱별 Vitest 소유권

- 진입 기준: `d8713c59d44cb9ff5a9603f4693638546849169c`. fetch 후 로컬과 같은 이름의 원격
  작업 브랜치가 같고 작업 트리가 깨끗함을 확인했다. `origin/migration_main`은 `4d5e42d`다.
  로컬 `migration_main`의 오래된 `5135f6e`를 재판정 기준으로 사용하지 않았다.
- [4단계 계획](MONOREPO-CONFIGURATION-PLAN.md#4단계-첫-단위--test-01-앱별-vitest-소유권)에
  따라 TEST-01만 완료했다. 원문 38개 ID를 유지하며 누적 완료 8개, 대기 30개다.
  구현과 이 기록은 같은 커밋에 포함한다. 이전 계획·결과 이력은 보존했다.
- Web에 앱 전용 `vitest.config.ts`를 추가하고 package test가 앱 cwd에서 실행되도록 했다.
  두 앱은 각자 명시적 root·`@`/marker mock alias·include를 소유하며 다른 앱을 import하지 않는다.
  root Vitest는 Web 프로젝트 선택과 기존 coverage 정책만 유지한다. root unit/coverage의 전체
  workspace 확대는 TEST-02, 없는 coverage 경로 수정은 TEST-03으로 남겼다.
- 실제로 중복된 globals/jsdom/css/setup을 `config/vitest/browser.ts`로 분리했다.
  공통 setup은 옆의 `browser.setup.ts`로 이동했고 comment 외 동작은 동일하다.
  절대 setup 경로와 앱 config의 root 지정으로 실행 cwd에 따른 경로 변화를 없앴다.
  Node 설정은 globals·timeout·직렬 실행 책임이 달라 이번 단위에서는 합치지 않았다.
- preset/setup·root/앱 Vitest entry를 기존 config strict 타입 검사에 포함했다.
  Turbo는 기존 `config/**` 입력을 사용하며 없어진 root setup 입력만 제거했다.
  preset과 setup 각각의 변경이 두 앱의 검사 task 선택·hash를 바꾸는 회귀를 추가했다.

실행한 로컬 검증:

- 설치된 Vitest 4.1.2의 `createVitest`/`globTestSpecifications`와
  [공식 v4 설정 문서](https://v4.vitest.dev/config/),
  [coverage 문서](https://v4.vitest.dev/config/coverage)를 확인했다.
  변경 전후 파일 전체 목록·exclude·alias·setup·환경·timeout·worker 옵션을 비교했다.
  Web 24·Console 39·server 17·contracts 1·ops 21·PostgreSQL 4개 파일이 각각 동일하다.
  앱들은 jsdom, 나머지는 Node이며 소스에 별도 환경 override 지시는 없다.
- root가 `projects`를 사용하면서 Vitest가 자동 생성하는 coverage exclude 표현은 달라졌다.
  명시적 include/provider/reporter/출력 위치 정책은 보존했고 실제 측정 파일 목록도 전후 동일했다.
  변경 전 `pnpm exec vitest run --coverage`, 변경 후 `pnpm test:coverage`에 JSON reporter와
  별도 로컬 출력 경로를 지정해 실행했다. 각각 Web 24파일·93건 통과, 측정 파일은 모두 0개다.
  이를 coverage가 충분하다는 근거로 사용하지 않으며 TEST-03의 실제 수정 대상으로 남긴다.
- `pnpm test:unit --run`: Web 24파일·93건 성공. `pnpm test:unit:run`: 81파일·410건 성공
  (contracts 3 + server 88 + Web 93 + Console 226, Turbo 캐시 사용 0개).
  루트 명령의 현행 Web 범위와 workspace 전체 실행의 차이는 TEST-02에서 처리한다.
- `pnpm type-check:config`, `pnpm type-check`(repo/config/scripts 포함), `pnpm lint`,
  `pnpm lint:fsd`, `pnpm test:harness` 28건: 성공. 새 harness 2건은 루트 cwd에서 앱 config를
  해석해 실제 수집 목록과 앱 root·alias·browser 환경·setup·기본 제외 경계를 검사한다.
  최초 strict 검사에서 preset의 잘못된 타입 export 이름을 발견해 설치된 v4의 `TestUserConfig`로
  수정했다. 강제 cast·타입 검사 억제·새 dependency는 추가하지 않았다.
- `pnpm format:check`, `git diff --check`: 성공. 수집 비교·실행 로그는
  `.local/monorepo-config/vitest-ownership/`에 보존한다.

리팩토링 점검:

- 공통화는 실제 중복인 browser 정책과 setup에 한정했다. factory·wrapper·새 테스트 framework 없이
  Vitest의 `defineConfig`/`projects`/`test` 어휘를 유지한다. 앱 root·alias·include를 preset에 넣지 않았다.
- 앱 테스트 수뿐 아니라 수집 파일 전체와 제외/환경/경로를 비교했다. Node에 browser setup을
  적용하지 않았고 TEST-04의 PostgreSQL Web HTTP adapter alias와 실제 consumer는 유지했다.
- 앱 runtime·Next/Sentry/DB/env 설정, dependency/lockfile, 기존 JS 도구의 언어는 바꾸지 않았다.
  이번 단위의 앱 build·standalone smoke·실제 PostgreSQL 실행·운영 연결은 미실행이다.
  개인 env·DB 볼륨·MFA 키와 운영 DB·VM·Vault·secret은 변경하지 않았다.
- 다음 단위는 TEST-02의 root unit/coverage workspace 범위 정리다. TEST-03/04는 별도 단위로
  유지하며 전체 작업 완료 전 PR 생성·병합·배포는 하지 않는다.

### TEST-01 후속 — 두 앱 build 추가 검증

- 사용자의 추가 요청에 따라 `5c793771d19571fcd33d0cbf018375ccef1fc907`에서
  `pnpm build --force`를 실행했다. Web·Console의 Next 16.4.1 컴파일·타입 검사·정적 페이지 생성과
  standalone 산출물 구성이 성공했다. Turbo 결과는 2개 task 성공, 캐시 사용 0개다.
- Sentry source map 업로드·telemetry를 끄고 공개 앱 환경은 local로 지정했다.
  DB 주소는 접속 불가능한 loopback으로, Console 인증 입력은 임시 로컬 값으로 지정했다.
  개인 env 파일과 운영 자원은 변경하지 않았다. 실제 DB 실행·standalone smoke는 추가하지 않았다.
- 앞 절의 build 미실행은 당시 기록으로 보존한다. 이번 build 로그는
  `.local/monorepo-config/vitest-ownership/build.log`에 보존하며 TEST-02~04의 완료 판정은 바꾸지 않는다.

### 4단계 두 번째 단위 — TEST-02 루트 실행 범위

- 진입 기준: `99d4428816be36878b084c03c17606b3a7251858`. fetch 후 로컬과 같은 이름의 원격
  작업 브랜치가 같고 작업 트리가 깨끗함을 확인했다. `origin/migration_main`은 `4d5e42d`다.
  [두 번째 단위 계획](MONOREPO-CONFIGURATION-PLAN.md#4단계-두-번째-단위--test-02-루트-실행-범위)에
  따라 TEST-02의 실행 범위를 정리했다. 원문 38개 중 완료 9개, 대기 29개다.
  구현과 이 기록은 같은 커밋에 포함하며 이전 이력과 PLAN 원문 매핑은 보존했다.
- root Vitest의 `projects`는 두 앱과 두 package의 실제 `vitest.config.ts`를 선택한다.
  `test:unit`과 `test:coverage`는 기존 명령 그대로 같은 프로젝트 구성을 사용하고,
  `test:unit:run`·CI·verify·push hook의 Turbo workspace 실행은 유지했다.
  repo ops·PostgreSQL integration·관리자 E2E는 기존 별도 명령에서만 실행한다.
- contracts/server config에 자기 root를 명시하고 두 파일을 config strict 검사에 포함했다.
  앱별 alias/include는 앱에, package별 include/globals/marker mock은 해당 package에 유지한다.
  Node package 둘의 globals 차이와 기존 browser preset은 바꾸지 않았다.
- [공식 v4 projects 문서](https://v4.vitest.dev/guide/projects)와 설치된 Vitest 4.1.2의
  설정 해석·수집 API를 확인했다. root 실행 범위 조정과 coverage 측정 경로 조정은 구분한다.
  기존 coverage include는 그대로이며 측정 파일 0개 문제는 TEST-03에 남아 있다.

실행한 로컬 검증:

- 변경 전후 Web 24·Console 39·contracts 1·server 17개 파일의 실제 목록·exclude·alias·setup·
  globals·jsdom/Node·pool·isolation·timeout·worker 옵션을 비교했다. 각 workspace의 설정과
  파일 목록은 동일하며 root는 이 81개 파일의 중복 없는 합집합을 수집한다.
  ops 21개와 PostgreSQL integration 4개 파일의 별도 수집/환경도 동일하다.
- `pnpm test:unit --run`, `pnpm test:coverage`: 각각 81파일·410건 성공.
  JSON reporter와 별도 출력 경로로 실제 실행 파일·이름별 테스트 결과까지 대조해 일치함을 확인했다.
  coverage에는 JSON 측정 reporter도 지정했다. 실제 측정 파일은 0개이며 전체 테스트 실행 성공을
  측정 범위가 충분하다는 근거로 사용하지 않는다.
- `pnpm test:unit:run`: contracts 3 + server 88 + Web 93 + Console 226 = 410건 성공.
  81개 파일을 실행했고 Turbo 캐시 사용은 0개다. 루트 두 명령의 실제 실행 결과와 대조했다.
- `pnpm type-check`(repo/config/scripts 포함), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:harness` 29건: 성공. 신규 회귀는 실제 Turbo dry-run의 test task 명령·cwd를 기준으로
  workspace별 수집 결과를 구하고, 루트 unit·coverage 명령을 Vitest `parseCLI`로 해석해
  프로젝트별 파일·alias·실행 환경·제외 규칙이 같은지 검사한다. 고정 테스트 수만 비교하지 않는다.
- `pnpm build --force`: 두 앱의 컴파일·타입 검사·정적 페이지 생성·standalone 구성 성공,
  Turbo 2개 task 성공·캐시 사용 0개. Sentry 업로드·telemetry를 끄고 local 앱 환경과
  접속 불가능한 loopback DB·임시 Console 인증 입력을 사용했다. 실제 DB·standalone smoke는 미실행이다.
- `pnpm format:check`, `git diff --check`: 성공. 실효 설정·수집 목록·JSON 결과·명령 로그는
  `.local/monorepo-config/workspace-unit/`에 보존한다.

리팩토링 점검:

- 별도 runner·새 preset·의존성·설정 복제 없이 Vitest의 기존 `projects`로 실행 대상을 조합했다.
  glob은 실제 workspace 진입점만 선택하며 root에 앱 alias/include/environment를 다시 정의하지 않았다.
- 수집 회귀는 기존 Turbo 명령을 기준으로 하므로 한쪽 명령만 특정 workspace를 빠뜨리거나
  browser setup을 Node에 적용하면 실패한다. 기존 앱별 root/alias 회귀도 유지한다.
- Next/Sentry/DB/env 코드·dependency/lockfile·개인 env·DB 볼륨·MFA 키·운영 자원은 변경하지 않았다.
  TEST-04의 Web HTTP adapter alias와 consumer도 유지했다.
- 다음 단위는 TEST-03의 실제 coverage 측정 경로다. TEST-04는 별도로 유지하고 이번 단위에서
  PR 생성·병합·배포는 하지 않는다.

### 4단계 세 번째 단위 — TEST-03 coverage 측정 경로

- 진입 기준: `6a6e90d760086a3d215c6464bf77b0aec3912772`. fetch 후 로컬과 같은 이름의 원격
  작업 브랜치가 같고 작업 트리가 깨끗함을 확인했다. `origin/migration_main`은 `4d5e42d`다.
  [세 번째 단위 계획](MONOREPO-CONFIGURATION-PLAN.md#4단계-세-번째-단위--test-03-coverage-측정-경로)에
  따라 TEST-03을 완료했다. 원문 38개 중 완료 10개, 대기 28개다. 구현과 이 기록은 같은 커밋에
  포함하며 과거의 coverage 0개 관찰과 PLAN 원문 매핑은 보존했다.
- 기존의 없는 Web 경로 대신 `apps/*/src/**/*.{ts,tsx}`·`packages/*/src/**/*.{ts,tsx}`를 측정한다.
  단위 테스트가 보호하는 앱 HTTP adapter·hook·API 및 공통 contract/service를 포함하며
  미실행 소스도 숨기지 않는다. 기존 test/선언 제외·V8 provider·text/html reporter는 유지했다.
  프로젝트별 test include·alias·환경·globals·setup·timeout은 바꾸지 않았다.
- [공식 v4 coverage 문서](https://v4.vitest.dev/guide/coverage#including-and-excluding-files-from-coverage-report)의
  include 동작과 설치된 Vitest 4.1.2의 실제 출력으로 측정 범위를 확인했다.

실행한 로컬 검증:

- 변경 전후 `pnpm test:coverage`에 테스트 JSON reporter·coverage JSON reporter·별도 출력 경로를
  지정해 실제 실행했다. 양쪽 모두 81파일·410건 성공이며 파일·이름별 테스트 결과도 동일하다.
  수집 목록과 실행 환경도 동일하다. 자동 병합 coverage exclude는 순서가 달라 집합으로 대조했고
  내용이 같았다. 명시적 제외 규칙은 변경하지 않았다.
- 실제 측정 소스는 0개에서 276개로 바뀌었다. Web 111 + Console 133 + contracts 6 + server 26개로
  추적 중인 src TypeScript 목록에서 test/선언을 제외한 집합과 정확히 일치한다. 누락·예상 밖 파일은
  모두 0개다. 테스트되지 않은 앨범 상세 RSC 페이지도 statement 실행 0회로 보고됨을 확인했다.
- 승인한 병렬 방식인 `pnpm exec turbo run type-check lint test --concurrency=4`를 실제 적용했다.
  workspace 12개 task 성공·캐시 사용 0개, unit은 contracts 3 + server 88 + Web 93 + Console 226 =
  410건이다. `pnpm type-check:repo`(root/config/scripts)와 `pnpm lint:repo`도 병행해 통과했다.
  기존 verify/CI/hook의 task 의존 관계와 검사 범위를 바꾸거나 새 runner를 추가하지 않았다.
- workspace 검사 후 `pnpm lint:fsd`·`pnpm test:harness` 29건 성공.
  harness의 임시 소스가 coverage나 타입 검사에 섞이지 않도록 별도 순서로 실행했다.
- `pnpm build --force`와 `pnpm build --force --env-mode=loose`에서 모두 두 앱의 컴파일·타입 검사·
  정적 페이지 생성·standalone 구성이 성공했다. 각각 Turbo 2개 task 성공·캐시 사용 0개다.
  후자는 임시 입력이 Turbo 자식 프로세스에도 전달되도록 실행 모드를 명시해 추가 확인했다.
  Sentry 업로드·telemetry를 끄고 local 앱 환경·접속 불가능한 loopback DB·임시 Console 인증 입력을
  사용했다. env 파일과 runtime 설정은 변경하지 않았다. 실제 DB·standalone smoke는 미실행이다.
- 수집/설정 비교, 변경 전후 coverage JSON, 측정 소스 목록, 검사·build 로그는
  `.local/monorepo-config/coverage-scope/`에 보존한다.
- `pnpm format:check`, `git diff --check`: 성공.

리팩토링 점검:

- 실제 workspace src를 가리키는 두 glob으로 정리했다. test 수집 정책·앱 alias를 root에 복제하지
  않았고 provider·dependency/lockfile·기존 JS 도구를 바꾸지 않았다. 측정 비율 목표를 추가하거나
  비율을 높이려고 미실행 파일을 제외하지 않았다. JSON 측정 목록 자체를 검증했다.
- Next/Sentry/DB/env 코드·개인 env·DB 볼륨·MFA 키·운영 자원은 변경하지 않았다.
  TEST-04의 PostgreSQL Web adapter alias와 consumer도 유지했다.
- 다음 단위는 TEST-04의 PostgreSQL integration 의존 책임이다. 이번 단위에서는 PR 생성·병합·배포를
  하지 않는다.

### 4단계 네 번째 단위 — TEST-04 PostgreSQL 의존 책임

- 진입 기준: `1a6f4b2f6be2c5895c8840ffa6f907495f17c334`. fetch 후 같은 이름의 원격 작업
  브랜치와 HEAD가 같고 작업 트리가 깨끗함을 확인했다. `origin/migration_main`은 `4d5e42d`다.
  [네 번째 단위 계획](MONOREPO-CONFIGURATION-PLAN.md#4단계-네-번째-단위--test-04-postgresql-의존-책임)에
  따라 TEST-04를 완료했다. 원문 38개 중 완료 11개, 대기 27개다. 구현과 이 기록은 같은 커밋에
  포함하며 PLAN 원문 매핑과 이전 결과는 보존했다.
- root `vitest.postgres.config.ts`는 전체 project 선택과 `fileParallelism:false`·`maxWorkers:1`을
  소유한다. server project는 공통 서버 검사 세 파일을 수집하고 foundation은 제외한다.
  `apps/web/vitest.postgres.config.ts`는 실제 Web HTTP adapter를 소비하는 foundation 한 파일과
  Web `@` alias를 소유한다. 실제 DB 충돌의 HTTP 409 변환과 모든 테스트 본문은 그대로 유지했다.
- 두 project가 공유하는 Node 환경·30초 timeout·파일 내부 직렬 실행·server-only mock은
  `config/vitest/postgres.ts`에 한 번 정의한다. 공통 설정에는 앱 alias를 넣지 않았다.
  두 project 모두 repo root를 기준으로 기존 `drizzle/` 파일 읽기와 수집 경로를 보존한다.
  PostgreSQL root/app entry도 config strict 타입 검사에 포함했다.
- [Vitest v4 projects 문서](https://v4.vitest.dev/guide/projects)의 project별 설정·상속과
  [직렬 실행 문서](https://v4.vitest.dev/config/fileparallelism)를 설치된 4.1.2 동작과 대조했다.

실행한 로컬 검증:

- 변경 전후 `pnpm exec tsx scripts/run-postgres-integration-tests.ts --local`: 각각 4파일·33건 성공.
  공통 서버 3파일·22건과 Web foundation 1파일·11건으로 수집됐으며 파일·이름별 결과가 동일하다.
  Node·globals false·setup 없음·forks·isolation·timeout·기본 제외·직렬 설정도 대조했다.
- 기존 Compose PostgreSQL 17 컨테이너가 healthy임을 먼저 확인했다. runner가 각각 별도 임시 DB와
  역할을 만들고 추적 migration 및 실제 constraint·transaction·MFA·CLI 검증을 수행했다.
  두 실행 모두 연결 0개·advisory lock 0개·임시 DB 삭제 로그와 임시 역할 정리 성공으로 종료했다.
  개인 앱 DB·볼륨·MFA 키는 변경하지 않았다.
- 실제 Vite resolver가 Web project에서 Web `api-response.ts`를 찾고 server project에서는
  해석하지 못함을 확인했다. 전체 수집 합집합·중복 없음·환경·직렬 실행·resolver 경계를 보호하는
  harness를 추가했다. 기존 root unit/coverage의 workspace 수집 회귀도 함께 통과했다.
- `pnpm exec turbo run type-check lint test --concurrency=4`: 12개 task 성공·캐시 사용 0개.
  unit은 contracts 3 + server 88 + Web 93 + Console 226 = 410건이다.
  병행한 `pnpm type-check:repo`(root/config/scripts)·`pnpm lint:repo`도 성공했다.
- workspace 검사와 build가 끝난 뒤 `pnpm test:harness` 30건·`pnpm lint:fsd` 성공.
- `pnpm build --force --env-mode=loose`: 두 앱의 컴파일·타입 검사·정적 페이지 생성·standalone 구성
  성공. Turbo 2개 task 성공·캐시 사용 0개다. Sentry 업로드·telemetry를 끄고 local 환경·접속 불가능한
  loopback DB·임시 Console 인증 입력으로 실행했다. 개인 env는 수정하지 않았다.
  standalone browser smoke·실제 앱 DB 조회/CRUD·전체 관리자 E2E는 이번 단위에서 실행하지 않았다.
- 설정 snapshot·파일/이름별 대조 결과·변경 전후 DB 실행과 검사·build 로그는
  `.local/monorepo-config/postgres-boundary/`에 보존한다.
- `pnpm format:check`·`git diff --check`: 성공.

리팩토링 점검:

- 공통화는 실제 두 PostgreSQL project의 중복에 한정했다. browser 정책을 상속하거나 범용 Node
  factory를 만들지 않았고 root 전역 Web alias도 제거했다. foundation의 공통 서버 검증과 HTTP 검증을
  억지로 재작성하지 않고 실제 consumer가 있는 파일만 Web project로 명시했다.
- 단위 테스트·coverage·ops 설정과 DB runner·SQL·migration·role 정책·CI·dependency/lockfile은
  변경하지 않았다. Next/Sentry/env 정리와 운영 자원 변경도 포함하지 않았다.
- TEST-01~04 정리가 끝났으며 다음 단위는 계획의 Next build 공통 정책 조사다.
  이번 단위에서는 PR 생성·병합·배포를 하지 않는다.

### Next build 첫 단위 — 공통 정책과 RUN-02 판정

- 진입 기준: `6b65d7cabb0e84b54b8ac0cf0562d44c884cf4a8`. HEAD·같은 이름의 원격 추적 ref·
  `git ls-remote`가 일치하고 작업 트리가 깨끗함을 확인했다. `origin/migration_main`과 실제 원격
  기준은 `4d5e42d`다. Notion 원문의 최종 편집 시각도 `2026-10-21T17:17:49.914Z`로 동일하다.
  [첫 단위 계획](MONOREPO-CONFIGURATION-PLAN.md#next-build-첫-단위--공통-정책과-앱별-옵션)에
  따라 공통 정책을 분리하고 RUN-02의 적용 제외·보존 판단을 완료했다. 원문 38개 ID는 유지하며
  누적 완료 12개, 대기 26개다. 구현과 이 기록은 같은 커밋에 포함한다.
- `config/next.ts`는 실제로 같았던 standalone·두 source package transpile·tracing root·
  ephemeral build cache·React compiler·개발 origin·image·fetch logging·postgres external 정책을
  반환한다. 각 앱은 자기 디렉터리를 전달하며 자동 탐색 `next.config.ts`를 소유한다.
  Console만 공통 experimental 값을 펼친 뒤 `authInterrupts:true`를 조합한다.
- RUN-02는 현재 Web에 관리 route와 `forbidden()` consumer가 없으므로 설정을 추가하지 않는다.
  헌법 §5·Auth §4.0의 공개 조회 범위를 따른다. Console admin layout의 실제 `forbidden()` 호출과
  해당 옵션은 유지했다. 인증 runtime·request context·인가 규칙은 변경하지 않았다.
- 공통 함수는 Next runtime을 import하지 않는다. 각 앱의 기존 `NextConfig` 타입으로 조합 결과를
  검사하고 두 entry를 config strict 프로그램에 포함했다. root에 새 Next dependency를 추가하거나
  한 앱의 타입·설정을 다른 앱에 연결하지 않았다. 두 literal의 `as const`는 문자열 값의 타입만 좁힌다.
- [Next 설정 문서](https://nextjs.org/docs/app/api-reference/config/next-config-js)와
  [standalone/tracing 문서](https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
  설치된 Next 16.4.1 loader·실제 package build 명령을 대조했다.

실행한 로컬 검증:

- 변경 전후 `tsx`로 실제 두 entry를 별도 프로세스에서 읽었다. root/app cwd와 cache 입력
  빈 값·false·true의 12개 조합에서 전체 export가 일치했다. 새 harness는 실행 위치에 따른
  tracing root, 두 앱의 공통 정책, Console 전용 인증 옵션, cache 전환을 보호한다.
- 임시 도구에서 Next `loadConfig`를 직접 호출한 비교는 변경 전에도 `sentry-build` import를
  찾지 못해 실패했다. 앱 코드나 loader를 고치지 않고 계획에 검증 방식 보정을 추가했다.
  실제 Next loader 검증은 아래 CLI build 산출물로 수행했으며 `tsx` 비교와 구분한다.
- `pnpm exec turbo run type-check lint test --concurrency=4`: 12개 task 성공·캐시 사용 0개.
  unit은 81파일·410건(contracts 3 + server 88 + Web 93 + Console 226)이다.
  병행한 `pnpm type-check:repo`(root/config/scripts)·`pnpm lint:repo`도 성공했다.
- workspace 검사 후 `pnpm test:harness` 31건·`pnpm lint:fsd`·`pnpm format:check` 성공.
  기존 Turbo 회귀에 `config/next.ts`를 추가해 해당 변경이 두 앱의 type-check/lint/test/build를
  모두 선택하고 hash를 무효화함을 확인했다. harness와 workspace/build는 겹쳐 실행하지 않았다.
- 변경 전과 변경 후 일반 입력, 변경 후 `OIOI_EPHEMERAL_BUILD=true`에서 각각
  `pnpm build --force --env-mode=loose` 성공. 세 실행 모두 두 앱 컴파일·타입 검사·정적 페이지
  생성·standalone 구성 성공이며 Turbo 2개 task 성공·캐시 사용 0개다.
  `required-server-files.json`의 전체 config가 전후 일치하고 ephemeral 모드는 filesystem cache 값만
  false로 달랐다. 두 앱의 standalone `apps/<앱>/server.js`와 static 경로도 확인했다.
- build는 Sentry 업로드·runtime 수집·telemetry를 끈 local 입력, 접속 불가능한 loopback DB,
  임시 Console 인증 값으로 실행했다. 개인 env를 수정하지 않았다. 이번 단위의 실제 DB 조회/CRUD·
  browser smoke·전체 관리자 E2E·Sentry 외부 업로드는 미실행이다.
- 설정 snapshot·최종 build config 대조·검사/build 로그는 `.local/monorepo-config/next-policy/`에
  보존한다. `git diff --check`도 성공했다.

리팩토링 점검:

- 앱 디렉터리 한 개를 받는 함수와 명시적 object spread만 사용한다. 범용 deep merge·설정 framework·
  새 runner·dependency/lockfile 변경은 없다. 반환 object를 매번 생성해 앱별 옵션이 서로 섞이지 않는다.
- 기존 `config/**` Turbo 입력과 Docker의 전체 source 복사에 새 파일이 포함된다. Promotion의 공통 경로
  변경 판정도 두 앱 build를 유지한다. CI·hook·Docker·배포 도구의 코드는 수정하지 않았으며,
  CI 실행·컨테이너 build·배포는 수행하지 않았다.
- Sentry build 옵션과 업로드 실패 처리·release·map 삭제 조립은 기존 entry에 그대로 남겼다.
  앱별 env parser·instrumentation·request adapter·runtime 오류 분류는 변경하지 않았다.
  공통 build 조립은 후속 단위이며 OBS-01/02·env·Docker 정리는 대기다.
- 개인 env·DB 볼륨·MFA 키와 운영 DB·VM·Vault·secret은 변경하지 않았다.
  이번 단위의 커밋·push 후 멈추며 PR 생성·병합·배포는 하지 않는다.

### Next build 두 번째 단위 — Sentry 옵션 조립

- 진입 기준: `18cc91ab173ee8ce87f9e3639b33d58fb70cb8a4`. HEAD·같은 이름의 원격 추적 ref·
  실제 원격 작업 브랜치가 일치하고 작업 트리가 깨끗함을 확인했다. 원격 `migration_main` 기준은
  `4d5e42d`다. [두 번째 단위 계획](MONOREPO-CONFIGURATION-PLAN.md#next-build-두-번째-단위--sentry-옵션-조립)에
  따라 공통 옵션 조립만 분리했다. 원문 38개 ID와 완료 12개·대기 26개는 그대로다.
  DSN·프로젝트 공유 판단과 예제 정리인 OBS-01/02를 이 보조 단위의 완료로 합산하지 않는다.
  구현과 이 결과 기록은 같은 커밋에 포함한다.
- `config/sentry-build.ts`는 검증된 네 문자열을 받아 기존 Sentry build 옵션을 반환한다.
  두 앱은 `getSentryBuildConfig()`·활성화 분기·`withSentryConfig()`를 자기 entry에 유지한다.
  telemetry false, route manifest 비활성화, 경고 억제, 업로드 오류 재전파, release 생성/확정,
  `.next/**/*.map` 삭제 패턴을 보존했다. 삭제 경로를 공통 파일 위치로 재해석하지 않는다.
- 공통 함수는 env·앱 소스·SDK를 import하지 않는다. 기존 config strict 프로그램이 새 `.ts`와 두 앱
  entry의 SDK 호출 호환성을 검사한다. root SDK dependency·새 타입 경로 연결·lockfile 변경은 없다.
  `routeManifestInjection`의 `as const`는 SDK가 허용하는 literal false로 타입만 좁힌다.
- 설치된 `@sentry/nextjs` 10.42.0의 구현·타입과
  [같은 버전의 공식 옵션 정의](https://github.com/getsentry/sentry-javascript/blob/10.42.0/packages/nextjs/src/config/types.ts)를
  대조했다. 실제 SDK는 옵션 object를 수정할 수 있으므로 호출마다 새 object와 nested 값을 생성한다.

실행한 로컬 검증:

- 변경 전후 신규 경계 회귀 3건이 모두 성공했다. 기존 esbuild로 실제 앱 entry·공통 정책·앱 env parser를
  메모리에서 조합하고 SDK 호출 경계만 대체했다. 업로드 스위치 미설정/false/대문자 TRUE의 우회,
  앱별 입력과 trim, Console 인증 옵션, release 생성/확정, 삭제 패턴, 누락 입력·잘못된 release 거절을
  확인했다. 가짜 업로드 오류가 같은 object로 다시 throw되는지도 검사했다. 외부 SDK 업로드는 없다.
- 별도 snapshot에서 SDK에 전달하는 전체 Next/Sentry 옵션과 실제 SDK 활성 조립 결과를 두 앱에서
  각각 비교했다. 총 4개 설정이 전후 일치했다. 실제 SDK 검사는 가짜 입력과 Turbopack 모드로
  compile hook이 생성되는 것까지만 확인했으며 hook을 호출하지 않았다. 직렬화한 설정에 가짜 build
  token이 포함되지 않고 release가 유지됨도 확인했다. 실제 업로드·빌드 산출물의 secret 검증과 구분한다.
- `pnpm exec turbo run type-check lint test --concurrency=4`: 12개 task 성공·캐시 사용 0개.
  unit은 81파일·410건(contracts 3 + server 88 + Web 93 + Console 226)이다.
  병행한 `pnpm type-check:repo`(root/config/scripts)·`pnpm lint:repo`도 성공했다.
- workspace 검사 후 `pnpm test:harness` 34건·`pnpm lint:fsd`·`pnpm format:check` 성공.
  기존 Turbo 회귀에 새 공통 파일을 추가해 변경 시 두 앱의 type-check/lint/test/build가 모두 선택되고
  hash가 바뀜을 확인했다. harness와 workspace/build는 겹쳐 실행하지 않았다.
- 변경 전후 `pnpm build --force --env-mode=loose`: 각각 두 앱 컴파일·타입 검사·정적 페이지 생성·
  standalone 구성 성공, Turbo 2개 task 성공·캐시 사용 0개다. `required-server-files.json`의 전체
  Next config와 두 앱의 standalone `apps/<앱>/server.js`·static 경로를 대조해 일치함을 확인했다.
  Sentry 업로드·runtime 수집·telemetry를 끄고 local 환경, 접속 불가능한 loopback DB, 임시 Console
  인증 입력을 사용했다. 이번 단위의 실제 DB 조회/CRUD·browser smoke·전체 관리자 E2E와 Sentry
  외부 업로드·실제 token 권한·업로드 후 map 삭제 동작은 미검증이다.
- snapshot·SDK 경계/활성 조립·검사/build 로그는 `.local/monorepo-config/sentry-build/`에 보존한다.
  `git diff --check`도 성공했다.

리팩토링 점검:

- 공통화는 실제로 복제된 옵션에 한정했다. SDK 호출과 앱별 활성화 판단을 숨기는 wrapper나
  범용 merge·새 runner를 만들지 않았다. 공통 파일에 process env cache나 고정 org/project를 넣지 않았다.
- 두 앱 env parser·server Sentry 초기화·서버/클라이언트 instrumentation은 기준 소스와 byte가 같다.
  request adapter·runtime 오류 분류와 Next 공통 정책·Console 인증 옵션도 변경하지 않았다.
  기존 `config/**` Turbo 입력과 Docker source 복사를 유지하며 CI·hook·배포 도구의 코드는 그대로다.
- 원문 매핑과 과거 기록을 보존했고 env·DB 도구·Docker·관측 입력 정리는 후속 단위로 남겼다.
  개인 env·DB 볼륨·MFA 키와 운영 DB·VM·Vault·secret은 변경하지 않았다.
  이번 단위의 커밋·push 후 멈추며 PR 생성·병합·배포는 하지 않는다.

#### Sentry 옵션 조립 push 보완

- 첫 구현 커밋은 `5be01cd9bebc5ef15595b0e6aaab63411765168c`다. commit hook은 성공했지만
  첫 push hook의 ops 262건 중 1건이 실패해 원격은 `18cc91a`를 유지했다. 기존
  `tests/ops/deploy-via-run-command.test.ts`가 Web entry 안의 옵션 문구를 직접 찾는 consumer를
  첫 변경에서 놓쳤다. 앞 절의 로컬 검증 성공과 이번 push 실패는 구분하며 로그를 보존한다.
- 해당 검사는 공통 조립 함수를 호출해 같은 map 삭제·route manifest·업로드 오류 정책을 검사하도록
  보완했다. workflow·source SHA·BuildKit secret 검사는 그대로다. 두 앱의 실제 SDK 연결은 앞 절의
  harness가 검증한다. 애플리케이션과 공통 설정은 첫 구현 커밋 이후 추가로 변경하지 않았다.
- 해당 ops 파일 6건 성공 후 전체 ops를 별도로 실행할 때 기존 jq PATH를 빠뜨려 Run Command
  mock 검사 16건이 실패했다. 저장소 코드를 바꾸지 않고 안내된 `.local/p06-c/bin`을 PATH에 넣어
  `pnpm test:ops`를 다시 실행했으며 21파일·262건이 모두 성공했다.
- 보완 후 승인한 workspace 명령은 12개 task 성공·12개 cache 사용이었다. repo 타입/lint와
  harness 34건·FSD·format도 다시 성공했다. `pnpm build --force --env-mode=loose`를 같은 안전한
  local 입력으로 재실행해 두 앱 컴파일·타입 검사·정적 페이지 생성·standalone 구성이 성공했다.
  Turbo 2개 task 성공·cache 사용 0개이며 기준 Next config·standalone 경로와도 일치했다.
- 첫 push 실패는 `push.log`, jq PATH 누락 실행은 `ops.log`, 올바른 PATH 실행은 `ops-with-jq.log`,
  보완 검증은 같은 로그 폴더의 `followup-*`에 보존한다. 최초 커밋을 합치거나 amend하지 않고
  테스트와 계획·결과 보완을 별도 커밋으로 추가한 뒤 hook을 거쳐 다시 push한다.

### 2026-10-22 중간 점검과 추가 논의 기록

- 조사 기준은 `feature/monorepo-configuration-cleanup`의
  `d1df79a7672e64b8366f58a298fbb50914afea96`이다. 이 문서 수정 전 작업 트리는 clean이었다.
  원격 조회로 같은 이름의 작업 branch가 일치하고 `migration_main`이
  `4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`임을 확인했다. 이 추가 기록은 구현 결과가 아닌
  해당 소스에 대한 점검 결과와 사용자 요청에 따른 체크리스트 갱신이다.
- Sentry 앱 branch 최신 ref는 `7ed3246b37548997178afe2c42e9ecdd468bd8ea`다.
  [해당 결과 §8](https://github.com/goldmayo/oioi-bwg/blob/7ed3246b37548997178afe2c42e9ecdd468bd8ea/docs/migration/implementation/OBSERVABILITY-ERROR-TRACKING-RESULT.md#8-2026-10-22-slack-알림-배포-완료와-남은-운영-검증)은
  코드·로컬 검증 완료와 앱 변경 미병합·미배포를 구분한다. 앱 변경의 운영 수신·운영 알림 규칙 보완·
  이미지별 실제 Debug ID/소스맵 복원은 대기다. 실제 Next hook에서 원래 Error 클래스가 소실돼 unknown으로
  수집된 한계도 보존한다. 문서 기록을 이번 점검의 runtime 재실행으로 세지 않는다.
- Slack Worker branch는 `07489153f246e4ead36c89f9e5f07a0297e6e7b6`이다.
  [해당 결과 §11](https://github.com/goldmayo/oioi-bwg/blob/07489153f246e4ead36c89f9e5f07a0297e6e7b6/docs/migration/implementation/SENTRY-SLACK-RELAY-RESULT.md#11-2026-10-22-새-알림-형식-배포와-실제-수신-완료)에
  사용자 승인 후 Worker 배포와 새 Slack 알림의 실제 수신 완료가 기록됐다. 앞선 대화의 미배포 설명은
  이 최신 증거로 정정한다. 이 점검에서는 외부 조회·배포·알림 전송을 하지 않았다.
- 최초 중간 점검 시 모노레포·Sentry 앱·Worker branch 사이의 수정 경로 교집합은 없었다.
  최신 두 branch의 추가 문서 커밋도 모노레포 수정 파일과 겹치지 않는다. 통합 tree build나 병합은 하지 않았다.

루트 tests 조사:

| 위치 | 파일 수 | 확인한 책임과 분류 |
| --- | --- | --- |
| tests/ops | 42 | Vitest 테스트 21개 외에 smoke·fixture·shell/Python 도구가 함께 있다. host·배포·이미지·두 앱 통합 검증은 root 소유가 적절하다. |
| tests/integration | 4 | foundation은 Web adapter와 서버·DB를 함께 검증한다. p05a/p05b2는 server repository/service 전용 이관 후보이고 p05b3는 root CLI까지 실행한다. |
| tests/k6 | 4 | 현재 Web URL·song slug를 사용하는 수동 성능 검증이다. Web 소유 후보이며 부하 테스트는 실행하지 않았다. |
| tests/mocks | 2 | client-only/server-only marker의 공통 빈 mock이다. 두 앱·server·PostgreSQL 설정에서 소비하므로 공통 테스트 설정과 함께 관리할 후보다. |

- `tests/ops/sentry-slack-relay.test.ts`는 Worker 소스를 직접 import하는 단위 테스트다.
  RUN-03에서 Worker를 패키지로 정리할 때 함께 이관할 후보이며 현재 root ops 실행과 연결돼 있다.
- foundation의 실제 HTTP 409 검증과 Web 전용 alias 제한은 TEST-04의 완료 범위다. 파일 소유권을
  추가 검토한다는 이유로 완료 판정을 되돌리거나 HTTP 검증을 삭제하지 않는다. 전체 DB 생성·역할·직렬
  실행·정리, CI image smoke·수동 관리자 E2E와 실제 path 참조를 보존한다.
- TypeScript compiler API로 root/config/scripts/Web/Console/server/contracts의 7개 프로그램과
  `git ls-files tests`의 추적 TS 소스를 대조했다. tests TS 28개(integration 4·ops 22·mocks 2)의 소속이
  모두 없고, root 설정 `drizzle.config.ts`·`vitest.ops.config.ts`도 없었다. 소속 분석이며 새 타입 검사
  프로그램을 만들거나 해당 파일의 타입 검사 통과를 확인한 것은 아니다. CFG-10·TEST-05에 등록한다.

중간 점검에서 직접 실행한 검증과 한계:

- 모노레포 `pnpm test:harness` 34건, `pnpm type-check:repo`,
  `pnpm exec vitest run --config vitest.ops.config.ts tests/ops/deploy-via-run-command.test.ts --reporter=dot`
  6건이 성공했다. Sentry 코드 점검 기준은 문서 커밋 전 `c2645e9badcd9860dd20c921f6a4be9672501a5e`다.
  해당 worktree의 Console 관련 11파일·96건, Web 관련 9파일·95건이 성공했다.
- 최초 Web 검사는 앱 cwd에서 이전 root config를 직접 실행해 테스트 0건으로 종료했다.
  root cwd와 기존 root config로 실행 경로를 바로잡은 뒤 위 95건이 성공했다. 저장소 코드를 고치지 않았다.
- 이번 체크리스트 반영은 PLAN/RESULT 문서와 기존 Notion 요약의 갱신이다. 기존 38개 이력과 추가
  8개 ID의 상태를 대조한다. 문서 갱신을 위해 전체 lint/type-check/test/build·DB·외부 서비스 검사를
  별도로 재실행하지 않는다. commit/push hook이 실행한 검사는 별도 hook 실행 결과로 보고한다.
- 사용자 요청 범위에서 application/설정/테스트/manifest/lockfile·개인 env·운영 자원은 변경하지 않는다.
  신규 PR 생성·branch 병합·배포는 하지 않으며 구조 제안의 구현도 대기다.


## 2026-10-23 기존 작업 회수와 Draft PR 연결

이번 사용자 승인은 기존 변경 보존·검토·최소 호환 보정·검증·커밋·push·Draft 연결이다.
신규 정상화·실제 병합·배포·운영 설정 변경·브랜치 삭제를 하지 않았다.
조사/검증 기준은 모노레포 `103b89466926d86628d6a80b4abce03333e3844f`,
원격 통합 `aa4e814f9fdbfd1c69b8b3af8934e5c99b80277c`다. main의 #195는 계획 문서만 포함한다.
모든 대상 head의 기존 PR을 원격 재조회한 뒤 아래 Draft를 연결했다.

### 원본 보존과 회수

공통 영속 보존 위치는 저장소 밖 `/home/hsj95/.codex/recovery/monorepo-20261023-0b6s5a9k/`다.
A-env/B-evidence 각각 full-index patch·변경 파일 snapshot·manifest와 SHA-256을 보존했다.
권한을 제한하고 개인 env 파일을 제외했으며 알려진 private secret 값과 token/key 패턴을 검사했다.
snapshot 전후 원본 파일 해시가 같았다. 원본 reset/clean/stash·amend·강제 push는 하지 않았다.

| 작업 | 원본 ref/상태 | 회수·검토 위치 | 커밋·Draft 또는 보류 근거 |
| --- | --- | --- | --- |
| A env | `feature/p06-console-env-boundary@4d5e42d` 미커밋 16파일 | 원본 `/home/hsj95/.codex/worktrees/p06-web-public-only/cheer-rock-crab` 보존. `A-env/`, `.local/worktrees/recovery-console-env` | `feature/recover-console-env-boundary`, `e67d737` → `e1f7a1e`, [#198](https://github.com/goldmayo/oioi-bwg/pull/198) |
| B 증적 | `feature/p06b2-acceptance@7fb8590` 문서 2개 미커밋 | 원본 `.local/worktrees/p06b2-acceptance` 보존, `B-evidence/` | RESULT 추가 블록 121줄이 현행 결과에 연속된 동일 본문으로 이미 존재. 고유 미반영 증적 0개로 중복 PR 없음 |
| Slack Worker | `feature/sentry-slack-message-layout@0748915` | `.local/worktrees/review-slack-worker` detached 고정본 | 원본/원격 같은 ref, [#196](https://github.com/goldmayo/oioi-bwg/pull/196) |
| Sentry 앱 | `feature/observability-console-rsc-auth@7ed3246` | `.local/worktrees/review-sentry-app` detached 고정본 | 원본/원격 같은 ref, [#197](https://github.com/goldmayo/oioi-bwg/pull/197). `56c2506` 포함, 중복 회수 없음 |
| 모노레포 | `feature/monorepo-configuration-cleanup@103b894` | 기본 checkout, 기존 구현 그대로·회수 기록만 추가 | [#200](https://github.com/goldmayo/oioi-bwg/pull/200), 기존 구현은 보존하고 이번 회수 기록을 후속 문서 커밋으로 추가 |
| F 준비 | 로컬 `feature/p06-f-cutover@a595cca` | `.local/worktrees/recovery-f-cutover` | 원본 커밋 보존·`80af73d` 보류 기록 추가·원격 push, [#199](https://github.com/goldmayo/oioi-bwg/pull/199). F 전환 보류 |

B의 고정 snapshot은 402줄 RESULT·revision 33 HANDOFF이고, 현행은 445줄 RESULT·revision 66 HANDOFF다.
[현행 B2 결과의 B 완료 절](console-guide-editor/P06-B2-3-RESULT.md#2026-10-18-b-운영-실증-완료와-최종-상태)은
재부팅 최종 검증·자원 관찰·preview 원복까지 기록한다. 오래된 `verify-reboot/finish 대기` handoff로
덮어쓰지 않았다. 당시 대기 기록과 원본 ref는 snapshot에 보존하고 최신 완료 증거를 우선한다.

A에서 회수한 것은 Console R2 예제/필수 입력 검사·앱별 env·기존 local launcher와 host materializer다.
원안의 필수 Sentry 프로젝트 분리는 PLAN OBS-01의 공용 프로젝트 유지와 충돌해 제외했다.
제외한 CI/promotion hash/두 테스트 파일을 새로 구현하지 않았다. 상세 회수/보정/검증은
[env 회수 결과 고정본](https://github.com/goldmayo/oioi-bwg/blob/e1f7a1e74319d458bf3f0db7e5e8214a3d293f46/docs/migration/implementation/ENVIRONMENT-CONFIGURATION-RECOVERY-RESULT.md)이 소유한다.
실제 R2 업로드·운영 주입, readiness 검사·APP_ENV/DB 입력·새 config/Worker/UI 구조는 완료하지 않았다.

### 이번 직접 실행과 기존/캐시/hook 구분

각 별도 검토 worktree는 `pnpm install --offline --frozen-lockfile --ignore-scripts` 성공 후 검사했다.
최초 pnpm PATH 누락 실행은 성공으로 계산하지 않았고 기존 Node/pnpm 경로를 명시해 재실행했다.
workspace/repo 타입/lint → harness → FSD/ops/format → 두 앱 build 순서를 지켰다.
`pnpm exec turbo run type-check lint test --concurrency=2`와 별도 repo 명령을 실행했다.

| 대상 | workspace 직접 실행 | 별도 직접 검사 | 실제 두 앱 build |
| --- | --- | --- | --- |
| env 회수 코드 | 12 task, 캐시 0, unit 81파일·410건 | repo 타입/lint·harness 18·FSD·ops 21파일/269건·format 성공 | 2 task 성공, 캐시 0 |
| Sentry 앱 `7ed3246` | 12 task, 캐시 0, unit 92파일·569건 | repo 타입/lint·harness 18·FSD·ops 21파일/262건·format 성공 | 2 task 성공, 캐시 0 |
| F 코드 `a595cca` | 12 task, 캐시 0, unit 81파일·410건 | repo 타입/lint·harness 18·FSD·ops 21파일/262건·format 성공 | 2 task 성공, 캐시 0 |
| 모노레포 `103b894` | 12 task, 캐시 6, unit 81파일·410건 | repo 타입(root/config/scripts)/lint·harness 34·FSD·ops 21파일/262건·format 성공 | 2 task 성공, 캐시 0 |
| Worker `0748915` | Next workspace 전체 재검사 대신 관련 검사 | repo 타입·Worker unit 29건·변경 파일 lint/format 성공 | Next 앱 build 대상 아님 |

build 명령은 `pnpm build --force --env-mode=loose --concurrency=1`이다. 임시 local 입력·빈 DSN·
Sentry 업로드/telemetry OFF·접속 불가능한 loopback DB·임시 Console 키를 사용했다.
F의 로컬 robots 산출물에 www sitemap URL을 확인했지만 production/www 운영 적용 성공은 아니다.
검증 명령·종료 코드·로그는 `/tmp/oioi-monorepo-recovery-20261023-0b6s5a9k/validation-*/`에 보존한다.
과거 결과의 DB/runtime/외부 수신을 이번 재실행으로 합산하지 않는다. 이번 DB integration·관리자 전체 E2E·
collector·실제 외부 업로드/전송·운영 수신/소스맵 검증은 실행하지 않았다.

현재 host는 `core.hooksPath` 미설정 상태였다. 최초 env 회수 커밋 `e67d737`에는 자동 hook이 없었으며
별도 TS lint/format은 성공했으나 commitlint의 본문 줄길이 검사는 실패했다. 재작성 금지에 따라 기록·보존했다.
후속 commit/push는 기존 `.husky/_`를 명령별 `-c core.hooksPath=.husky/_`로 지정한다.
공용 Git 설정·원본 worktree를 변경하지 않았다. 문서 후속 commit은 lint-staged 대상 없음·commitlint 성공이다.
env push hook은 영향 앱 6 task/캐시 6·repo 타입/lint·harness 18·ops 269·format 성공,
F push hook은 영향 Web 3 task/캐시 3·repo 타입/lint·harness 18·ops 262·format 성공이다.
모노레포 최종 push hook 결과는 PR 본문에서 별도로 추적한다.

### 중복·의존 관계와 통합 대기

원안 A는 모노레포의 `tests/ops/deploy-via-run-command.test.ts`, F의 `.github/workflows/verify.yml`과 겹쳤다.
필수 Sentry 프로젝트 분리를 제외한 최종 5개 작업은 10개 모든 쌍에서 수정 경로 교집합이 0개이고,
`git merge-tree --write-tree` 개별 모의 병합도 10개 모두 exit 0이다. 실제 브랜치 병합은 하지 않았다.
이 결과는 함께 실행한 통합 검사/build의 성공을 뜻하지 않는다.

- Worker #196은 독립 서비스이며 재배포·알림 전송 없이 Git 통합만 검토한다.
- Sentry #197은 기존 `56c2506`을 포함한다. 운영 적용·알림 규칙·Debug ID/소스맵 확인은 마지막 배포 단계다.
- 모노레포는 기존 설정/검사 기반만 회수한다. 원문 12개 처리·26개 대기와 추가 8개 대기를 유지한다.
- env #198은 기존 코드의 회수다. 공통 Sentry build 정책은 유지하며 앱별 env를 config 패키지로 옮기지 않는다.
- F #199는 production build 입력과 www 기준 URL의 준비 코드다. 전환 보류이며 다른 회수 PR의 필수 선행 조건이 아니다.

BASE-01은 승인된 변경 통합과 합쳐진 소스의 전체 검사·두 앱 build가 남는다. Draft 생성은 BASE-01이나
ENV/OBS/DB/CFG/TEST/UI ID의 완료 표시가 아니다. 정리 뒤 다음 한 단위는 BASE-01의 검토·통합 기준선 확정이며,
그 후 env #198의 회수 범위를 대조해 미반영 부분만 판단한다. 신규 구현과 실제 병합은 이번 종료 조건 밖이다.

### 잔존 브랜치 별도 분류

squash ancestry나 `git cherry`의 단독 결과로 미반영을 단정하지 않았다. PR 상태·파일 내용·현행 문서와
후속 구현을 대조했으며 아래 브랜치를 현재 회수 PR에 섞거나 삭제하지 않았다.

| 대상 | 분류 | 근거와 판단 |
| --- | --- | --- |
| `feature/p02-shared-config-turbo@de0850a` | 이미 병합되거나 다른 작업에 포함됨 | [#110](https://github.com/goldmayo/oioi-bwg/pull/110) merged 확인. 이후 config TS 공통화가 해당 기반을 확장함 |
| 닫힌 #131, `feature/p06-preparation-guide@b8848dc` | 이미 병합되거나 다른 작업에 포함됨 | #131 자체는 미병합 closed. [#130](https://github.com/goldmayo/oioi-bwg/pull/130) merged의 `382049d`가 같은 문서를 보강·재구성했고 현행 PLAN/ROADMAP이 연결함. 옛 본문을 다시 덮어쓰지 않음 |
| 닫힌 #49, `migration_m6-base-ui-label-separator@8e8d36a` | 대체된 과거 작업 | #49 미병합 closed. M6-BASE-UI-PREFLIGHT가 전환 폐기를 명시. 마지막 곡 툴바 분리 개념은 현행 Console의 별도 SongManagerToolbar consumer로 존재함. 옛 패치를 일괄 회수하지 않음 |
| `backup/m6-base-ui-pr49@7faa795` | 고유한 변경이 남아 판단 필요 | Base UI 전체 전환·Radix 제거·Select 계약의 큰 구현이 현행과 다름. 폐기된 단계의 고유 코드를 보존하되 UI-03/별도 foundation 검토 없이 재도입하지 않음 |
| `feature/aws-lambda-migration@d7c2b65` | 대체된 과거 작업 | SST/Lambda·파괴용 workflow 기반. 현행 Next standalone/OCI Promotion 계약과 다르며 관련 명령을 실행하지 않음 |
| `refactor/arch@e2e711d` | 고유한 변경이 남아 판단 필요 | 옛 ViewModel/Repository·인가·UI 46파일 변경. 책임은 현행 contracts/server/FSD로 재구성됐으나 개별 UI 동작까지 모두 포함됐다고 단정하지 않음. 별도 요구 없이 회수하지 않음 |
| `worker@69b0794` | 대체된 과거 작업 | legacy Worker/Vinext 배포 문서 6파일 변경이며 Sentry relay가 아님. 현행 헌법의 Next 단일 스택과 배포 문서가 대체함 |
| `backup/pr73-before-m9-reconstruction-20260910@9e04ce2` | 대체된 과거 작업 | [#73](https://github.com/goldmayo/oioi-bwg/pull/73) merged의 재구성된 M9·후속 Run Command/paired 배포가 대체함. 초기 직접 배포 기반을 재적용하지 않음 |

## 2026-10-23 정상화 재개 — ENV-03

### 기준과 선정

- fetch 후 원격 `migration_main`은 `aa4e814f9fdbfd1c69b8b3af8934e5c99b80277c`, 로컬 main은
  `5135f6e`였다. 새 분기를 만들지 않고 clean 상태의 기존 모노레포 branch/#200을 이어 사용했다.
  진입 HEAD와 #200 원격 head는 `80fa15d460e8b39ae3fca1f15577805d7c19b170`으로 일치했다.
- 원격 재조회한 #196 `0748915`, #197 `7ed3246`, #198 `e1f7a1e`, #199 `80af73d`,
  #200 `80fa15d`는 모두 open Draft·미병합이었다. main #195는 오류 추적 계획이며 구현 통합이 아니다.
  #200의 진입 head CI는 run `39809865502` 성공을 확인했다. 이번 변경 CI와 구분한다.
- #198의 R2 예제·launcher·host mapping·Web/Sentry 예제와 회수 결과를 실제 diff로 대조했다.
  ENV-01/02/04, OBS-01/02, MAIN-01은 해당 ref에서 구현·검증 완료·미병합으로 재판정했고,
  ENV-05는 개인 설정 관찰의 적용 제외로 점검했다. 해당 코드를 복사하거나 다시 구현하지 않았다.
  #198의 검증 수치·실행은 [회수 결과 고정본](https://github.com/goldmayo/oioi-bwg/blob/e1f7a1e74319d458bf3f0db7e5e8214a3d293f46/docs/migration/implementation/ENVIRONMENT-CONFIGURATION-RECOVERY-RESULT.md)을 따른다.
- 최초 남은 기능은 ENV-03이었다. Console `/readyz`가 인증/MFA와 DB만 검사해 R2 누락을 탐지하지
  못했다. #198은 readiness를 구현하지 않았으며 이 단위는 그 PR의 병합 없이 검증할 수 있다.
  BASE-01의 실제 통합은 미병합 대기로 남기고 독립 구현을 진행했다.

### 변경과 의존 관계

- 구현 커밋: `fd6616132d2d0f45b2ac451066bd8105680fe70a`, [기존 Draft #200](https://github.com/goldmayo/oioi-bwg/pull/200).
  `getPublicAssetConfig()`가 기존 storage 공개 entry에서 필수 다섯 입력과 HTTPS URL을 검증한다.
  Console readiness와 업로드가 같은 함수를 호출하며 invalid public base URL도 외부 쓰기 전에 거절한다.
  readiness는 S3 client 생성·R2 요청 없이 검사하며 Web은 R2 설정을 요구하지 않는다.
- 인증/MFA·기존 503/no-store 응답·원인/값 비노출은 유지했다. 설정 검사는 lazy하게 호출되며
  build 단계나 공용 package import만으로 실행하지 않는다. 범용 env framework·새 dependency는 없다.
- CI container·Promotion pair·Compose recovery smoke의 Console에 `.test` URL과 가짜 R2 문자열을
  추가했다. Web·운영 env 파일·Vault/secret·MFA key/volume는 변경하지 않았다.
  active 배포 runbook §17을 v1.19로 개정해 설정 검사와 외부 권한 검증의 차이를 명시했다.
  active 문서 인덱스의 해당 버전도 1.19로 맞췄다. 다른 영역의 문서 버전/상태는 변경하지 않았다.
- #198 병합 후에는 launcher/materializer 검사와 이 runtime 검사가 함께 적용된다. 실제 host 입력 준비와
  R2 권한 검증은 별도 승인된 배포 절차다. Sentry #197의 runtime 분류와 합친 검증은 BASE-01에 남는다.
  #199와 workflow 파일이 겹치지만 수정 구간은 별개다. 그 PR의 production/www 전환 보류는 유지한다.

### 이번 직접 실행과 한계

- `pnpm type-check` 성공: 최종 workspace 4 task 중 캐시 2개, repo/config/scripts 검사 성공.
  최초 실행은 신규 회귀 테이블의 tuple 추론 TS2345로 실패했다. tuple 타입을 명시한 뒤 재검증했다.
  테스트를 실행한 성공과 타입 검사 성공을 구분한다.
- `pnpm lint` 4 task·캐시 0개, `pnpm lint:fsd`, `pnpm test:unit:run` 4 task·캐시 0개 성공.
  unit은 81파일·441건(contracts 3/server 94/Web 93/Console 251)이다.
  관련 readiness 32건·storage 7건도 별도로 실행해 성공했다.
- 위 workspace 검사 종료 후 `pnpm test:harness` 34건, 기존 jq PATH를 사용한 `pnpm test:ops`
  21파일·262건, `pnpm format:check`, 변경 shell 두 개의 `bash -n`, `git diff --check` 성공.
  harness의 임시 파일을 type-check/build와 겹쳐 실행하지 않았다.
- `pnpm build --force --env-mode=loose --concurrency=1`로 두 앱 실제 build 2 task·캐시 0개 성공.
  임시 local 입력·빈 DSN·Sentry 업로드/telemetry OFF·접속 불가능한 loopback DB와 가짜 R2/Console
  입력을 사용했다. 개인 env를 덮어쓰지 않았다.
- 두 standalone에서 기존 Web/Console browser smoke 성공. 추가 실제 HTTP 검사에서 두 앱의
  503/no-store·정제된 응답을 확인했다. 임시 TCP listener로 Console은 R2 누락 시 DB 연결 0회,
  Web은 R2 없이 DB 연결을 시도함을 확인했다. TCP listener는 PostgreSQL 성공 검증이 아니다.
- 로그·안전 입력 runner·standalone 경계 검사는 `.local/monorepo-config/readiness/`에 보존한다.
  실제 PostgreSQL integration·정상 DB의 로컬 readiness 200·관리자 전체 E2E·R2 업로드·Vault 주입·
  외부 Sentry 전송·운영 배포/권한/소스맵은 이번 로컬 실행에서 미검증이다.
- 구현 commit hook은 lint-staged의 ESLint/Prettier와 commitlint 성공이다. push hook과 최신 CI는
  PR 본문·Notion에 별도 기록하며 위 직접 실행 결과에 합산하지 않는다. 과거 결과도 재실행으로 세지 않는다.

### 다음 한 단위

**ENV-06 — 앱별 APP_ENV 값 계약과 Web local metadata**가 다음 독립 구현이다. local/staging/production
consumer와 예제·Sentry·site metadata를 대조해 `development` 비교 불일치를 정리한다. ENV-10의 Console
GTM 전달은 여전히 남아 있으며 회수 #198이 CI 변경을 제외했으므로 완료로 표시하지 않는다.
DB-01/02는 환경 계약 다음 순서이며 미확정 ENV-2 전체 credential 전환·개인 env 자동 이관은 포함하지 않는다.
BASE-01·#198 병합·운영 검증은 별도 대기다. 이번에는 ENV-03 한 단위만 구현하고 멈춘다.

## 2026-10-23 리뷰 P2 — 공개 URL 경계 보완

- 사용자는 기존 병합 제한의 출처가 자신의 이전 조사/Draft·재개 프롬프트였음을 정정하고,
  ENV-03 검토 뒤 빈 query/fragment 구분자와 정규화 보완을 요청했다. 기존 기록은 당시 상태로 보존한다.
- 구현 `3e56a62c9ec99239041f888e5c84ae7f5f2a1835`: `URL.search/hash` 대신 정규화한 `href`의
  `?`·`#` 구분자 존재를 확인한다. 파싱 결과를 반환하고 public base의 끝 `/`를 모두 제거한 뒤
  object key를 연결한다. 앞뒤 공백·호스트/기본 포트·경로를 정규화하며 `%3F`·`%23`은 유지한다.
  배포 runbook v1.20과 인덱스에 정책을 반영했다.
- 신규 회귀의 수정 전 실행은 readiness 6건·storage 8건 실패로 문제를 재현했다. 수정 후 readiness
  38건·storage 16건, 전체 unit 81파일·456건(4 task·캐시 0개)이 성공했다.
- `pnpm type-check`(4 task·캐시 0개 및 repo/config/scripts), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:harness` 34건, 기존 jq PATH의 `pnpm test:ops` 262건, `pnpm format:check`, diff 검사 성공.
  harness는 타입/build와 순차 실행했다. unit 이후 필요한 두 앱 build와 기존 browser smoke도 재실행했다.
- `pnpm build --force --env-mode=loose --concurrency=1`: 두 앱 실제 build 2 task·캐시 0개 성공.
  두 standalone browser smoke와 HTTP/DB 접근 경계도 성공했다. 이전 로그는 보존하고 P2 gate 로그는
  `.local/monorepo-config/readiness/p2-*.log`, build/smoke 로그는 `readiness/p2/`에 분리했다.
  임시 local·가짜 R2/Console·빈 DSN·Sentry 업로드/telemetry OFF 입력을 사용했다. 외부 전송은 없다.
- #198은 사용자 후속 승인으로 `ef0e1224fa7f289bfde0cba60dfbbab9e58cf42f`에 squash 병합됐다.
  #196 최신 main 반영 head는 `3351b5b313d0465e11b0a1c687b2af6a654e03a6`이며 CI 재검증 중이다.
  #197/#200의 실제 통합과 BASE-01 완료, #187 문서 통합은 후속 검증·병합 결과로 별도 기록한다.
  #199 F 전환·운영 배포·실제 R2/Vault/Sentry 검증과 관리자 전체 E2E는 보류다.

## 2026-10-23 승인 통합 — #200 합쳐진 소스 검증

- 사용자 후속 병합 승인으로 #198 `ef0e122`, #196 `b0000a0`, #197
  `95e05a43d4cb7c97633256975e2d0523f1219c60`을 순서대로 main에 squash 병합했다.
  #196 최신 head `3351b5b`의 CI run `39817458568`, #197 `ff26200`의 run `39818880353`은
  필수 verify·전체 gate·격리 PostgreSQL·두 앱 컨테이너/브라우저·Compose 복구 성공이다.
  각 Promotion은 skipped이며 배포·운영 설정 변경·외부 업로드/전송을 실행하지 않았다.
- #200에서 위 main을 반영한 실제 검증 소스는 `4443d644460d9f71d0d76d4d87b6c137307ad876`이다.
  충돌은 active 인덱스 한 파일뿐이었다. API 1.5·Observability 1.4·Runtime 1.9·runbook 1.20을
  각 소유 문서와 대조해 모두 보존하고 인덱스를 1.30으로 갱신했다. 공통 runtime 구현 충돌은 없었다.
- 이번 직접 실행: `pnpm type-check` 4 task·캐시 2 및 repo/config/scripts 성공,
  `pnpm lint`·`pnpm lint:fsd`, `pnpm test:unit:run` 92파일·615건(4 task·캐시 2) 성공.
  unit은 contracts 3/server 103/Web 153/Console 356건이다. 이어서 harness 34건·ops 287건·
  format·diff 검사가 성공했다. harness와 타입/build를 겹쳐 실행하지 않았다.
- `pnpm build --force --env-mode=loose --concurrency=1`: 두 앱 실제 build 2 task·캐시 0개 성공.
  기존 두 standalone browser smoke와 503/no-store·R2 누락 시 Console DB 연결 0회·Web 독립 DB
  접근도 성공했다. 임시 local·가짜 R2/Console·빈 DSN·Sentry 업로드/telemetry OFF만 사용했다.
  이번 실행은 `.local/monorepo-config/integration/`에 이전/P2 기록과 분리해 보존한다.
- 이 통합 소스의 로컬 DB integration·정상 DB readiness 200·관리자 전체 E2E·운영 검증은 미실행이다.
  실제 PostgreSQL/컨테이너 성공은 위 개별 PR 및 새 #200 CI와 구분한다. #200은 최종 CI·병합
  확인이 남아 있어 BASE-01을 아직 완료로 표시하지 않는다. 병합 후 PR/Notion과 후속 기록으로 확정한다.

## 2026-10-23 승인 통합 확정 — BASE-01 완료

문서 기록 기준은 원격 main `84b9030af78e2c54d8e29841f6bfef0e256138b3`이다.
기존 회수·미병합·개별 검증 기록은 당시 ref의 이력으로 보존하고, 현재 상태를 아래처럼 확정한다.

| PR | 실제 상태 | main squash commit / 근거 |
| --- | --- | --- |
| [#198](https://github.com/goldmayo/oioi-bwg/pull/198) | env 계약 병합 완료 | `ef0e1224fa7f289bfde0cba60dfbbab9e58cf42f` |
| [#196](https://github.com/goldmayo/oioi-bwg/pull/196) | Worker 변경 병합 완료 | `b0000a025ebc9be38a775a7cde1405476837f5ce` |
| [#197](https://github.com/goldmayo/oioi-bwg/pull/197) | 앱 Sentry 변경 병합 완료 | `95e05a43d4cb7c97633256975e2d0523f1219c60` |
| [#200](https://github.com/goldmayo/oioi-bwg/pull/200) | 모노레포·ENV-03·리뷰 P2 병합 완료 | `4b08beb959596ca47d3ec6025bf7210d7f14fe31` |
| [#187](https://github.com/goldmayo/oioi-bwg/pull/187) | G 계획 문서 병합 완료 | `84b9030af78e2c54d8e29841f6bfef0e256138b3`, G 구현은 미착수 |
| [#199](https://github.com/goldmayo/oioi-bwg/pull/199) | F 전환 보류 Draft 유지 | head `80af73d`, production/www 입력 전환·배포 미승인/미실행 |

- #200의 최종 검증 head `68d7756744799b1b00000e5681c0d0b1e4cf9732`의
  [CI run 39820633051](https://github.com/goldmayo/oioi-bwg/actions/runs/39820633051)이 성공했다.
  필수 verify·품질·unit/ops·격리 PostgreSQL·두 앱 이미지/readiness/browser·Compose 보존/실패 복구가
  통과했다. Promotion/candidate는 skipped다. 위 로컬 직접 검증·캐시·hook과 별도 자동 CI 결과다.
- fetch 후 #200 squash 결과와 해당 head의 전체 tree가 같음을 `git diff --quiet`로 확인했다.
  이후 #187은 G 계획·P06 계획·ROADMAP의 일반 Markdown 세 파일만 바꿨다.
  따라서 BASE-01의 실제 통합·합쳐진 소스 검증을 완료 처리하며 운영 성공으로 확대하지 않는다.
- #187은 최신 main 반영 뒤 상대 링크 46개·G 계획의 명시적 Prettier·diff 검사·docs_only=true 확인을
  마쳤다. [CI run 39822855803](https://github.com/goldmayo/oioi-bwg/actions/runs/39822855803)의
  scope·필수 verify 성공, heavy job skipped를 확인했다. push hook도 Markdown-only skip이었다.
  문서 충돌 해소와 Web 인증 종료 전제 정정이며 계정·MFA·메일 기능을 구현하거나 실행하지 않았다.
- 원문은 처리 20/대기 18을 유지한다. 추가 8개는 BASE-01 처리 1/대기 7이다. 정상화 전체 완료는 아니다.
  다음은 PLAN에 명시한 ENV-06 한 단위다. 운영 R2/Vault/Sentry 수신·소스맵·배포와 관리자 전체 E2E는
  이번 로컬 작업에서 미검증/미실행이며 #199 F 전환·UI/Worker 후속도 보류한다.
- 이번 확정은 PLAN/RESULT 두 Markdown 파일만 갱신한다. 내용·ID 고유성·상대 링크·diff·문서 전용
  scope를 점검하고 앱 gate/build를 별도로 재실행하지 않는다. 후속 PR의 hook/CI는 별도 기록한다.

## 2026-10-23 정상화 재개 — ENV-06·관련 ENV-07

이 절은 `fb6b91e`까지의 최초 3값 구현 이력이다. 아래 사용자 확정 계약이 환경 값·Sentry·CI 입력의
현재 판단을 대체한다. 이전 실행 결과를 새 local/production 소스의 검증으로 재사용하지 않는다.

### 기준과 변경

- 진입 기준은 fetch한 `origin/migration_main@792a7464007d586a0e19d5c8382fe2c6a50af37b`다.
  로컬 main은 `5135f6e`였으므로 분기 기준으로 사용하지 않았다. 깨끗한 작업 트리에서
  `feature/monorepo-app-env`를 원격 기준으로 분기했다. #187/#196/#197/#198/#200/#201의 merged 상태와
  각 최종 head의 CI success를 원격에서 대조했다. 열린 PR은 보류 대상 #199뿐이었다.
  기존 회수·통합과 완료된 BASE-01의 검증을 다시 실행하지 않았다.
- [ENV-06 계획](MONOREPO-CONFIGURATION-PLAN.md#2026-10-23-정상화-재개--env-06과-관련-env-07-계약)에
  따라 Web의 site URL을 정확한 `local`일 때 localhost로 선택한다. 기본 metadata·Open Graph와
  기존 곡/앨범 `constructMetadata()`가 같은 URL을 소비한다. staging/production의 기존 apex URL과
  robots/sitemap은 유지한다. `development`를 앱 환경으로 해석하던 분기를 제거했다.
- Runtime §12를 v1.10, 문서 인덱스를 v1.31로 갱신했다. 앱별 예제와 feature flag 주석도 같은 값
  계약을 설명한다. Sentry·clientLogger는 이미 일치해 구현을 바꾸지 않았다. 누락·미지원 값의
  전송/브라우저 로그 비활성화와 공개 metadata URL fallback을 유지한다.
- ENV-07은 같은 계약의 local launcher·CI/Promotion staging 의미를 문서화한 것으로 처리한다.
  입력이나 workflow는 전환하지 않았다. 원문 38개는 처리 22/대기 16, 추가 8개는 처리 1/대기 7이다.
  ENV-10의 Console GTM 전달은 독립된 다음 후보이며 이번 diff에 포함하지 않았다.

### 직접 실행과 검증 한계

- 신규 metadata 회귀는 URL 객체/문자열을 정규화한 뒤 수정 전 3건 실패·5건 성공으로 결함을 재현했다.
  최초 테스트 작성 중 trailing slash 표현 차이를 수정했으며 그 오류를 제품 결함으로 세지 않았다.
  수정 후 Web metadata·Sentry·clientLogger 관련 3파일·20건이 성공했다.
- `pnpm type-check`: workspace 4 task 중 캐시 2개와 repo/config/scripts 성공.
  `pnpm lint`: workspace 4 task 중 캐시 2개, 양쪽 FSD와 repo ESLint 성공.
- `pnpm test:unit:run`: 93파일·623건(contracts 3/server 103/Web 161/Console 356),
  4 task 중 캐시 2개 성공. 새 metadata 8건을 포함하며 Sentry의 local OFF·DSN 조건·NODE_ENV 독립도
  기존 실제 소비자 검사로 확인했다. `pnpm test:harness` 34건은 workspace 검사 종료 후 성공했다.
- 기존 jq PATH에서 `pnpm test:ops` 21파일·287건 성공. `pnpm format:check` 성공.
  최초 수정 site의 Prettier 줄바꿈을 보완했고 최종 형식을 확인했다. `git diff --check` 성공.
- `pnpm build --force --env-mode=loose --concurrency=1`: 두 앱 실제 build 성공·캐시 0개.
  임시 local 입력·빈 DSN/GTM·Sentry 업로드/telemetry OFF·연결 불가능한 loopback DB·가짜 Console/R2
  입력을 사용했다. Web standalone의 `/more/policy` 200 HTML에서 Open Graph URL·이미지와 Twitter
  이미지의 localhost URL을 확인했다. DB 없는 정적 경로의 실제 Next 렌더링 검증이다.
- 로그와 임시 runner는 `.local/monorepo-config/app-env/`에 보존한다. 검증 소스는 위 기준 SHA와
  이 RESULT가 포함된 커밋의 ENV-06 diff다. 이후 hook 실행·최종 head CI·리뷰·squash 결과는 PR 본문에
  기록한다. CI 링크만 추가하려는 문서 커밋으로 전체 CI를 다시 유발하지 않는다.
- 개인 env·DB 볼륨·MFA 키·운영 설정을 변경하지 않았다. 로컬 DB integration·관리자 전체 E2E·
  외부 Sentry/R2/Slack 전송·운영 배포는 미실행이다. #199 F 전환·향후 계정 기능·UI 추출은 보류다.

### 사용자 확정 계약 — local/production 전환

- 사용자는 ENV-06 중간에 앱 환경을 local/production 두 값으로 확정했다. 비용상 별도 staging 환경은
  없으며 VM용 build는 production, 로컬 개발·production build·검증은 local이다. NODE_ENV로 배포 환경을
  추론하지 않는다. 이 결정은 실제 운영 배포 승인이 아니다. 이전 3값 설명을 현재 계약으로 사용하지 않는다.
- [확정 계획](MONOREPO-CONFIGURATION-PLAN.md#사용자-확정-반영--localproduction-계약)에 따라 같은
  [PR #202](https://github.com/goldmayo/oioi-bwg/pull/202)의 후속 커밋으로 구현한다. 기준은
  `fb6b91e40397dd4e3c57c3f159db3e4726b7859a`와 이 RESULT를 포함한 local/production 전환 diff다.
  기존 커밋은 보존하며 앞 head의 CI 성공은 새 계약의 병합 근거로 사용하지 않는다.
- 두 앱의 `shared/config/app-env.ts`가 값 해석을 소유한다. Next dev/build 진입점은 누락·빈 값·staging·
  development·미지원 값을 고정 오류로 거절하며 입력 값을 노출하지 않는다. runtime getter는 미지원 값을
  undefined로 반환해 Sentry/browser logging을 끈다. metadata·feature flag도 같은 getter를 사용한다.
- Sentry는 production+DSN만 활성화한다. browser/server의 최종 event sanitizer는 local/production 외
  environment를 제거한다. 독립 relay의 입력 표시는 local/production만 허용하고 staging은 unknown으로
  정규화한다. 이는 환경 표시 계약이며 Worker 위치 이동·workspace 추출·배포는 아니다.
- Docker 기본값과 일반 CI 이미지 build 세 곳·관리자 local smoke는 local, VM용 Promotion job과 양쪽
  candidate build는 production으로 맞췄다. 기존 공개 build hash는 APP_ENV를 이미 포함하므로 새 값은
  새 candidate 검증이 필요하다. #199의 www URL 변경·F 전환·운영 배포는 실행하지 않았다.
- Runtime v1.10·Observability v1.5와 인덱스 v1.31, 앱 예제·환경 PLAN·기존 client Sentry 결과의 후속
  안내·relay README를 맞췄다. 과거 staging 실행/수신 증거와 pinned 조사 표는 그대로 보존한다.
  staging 이름의 외부 버킷·기존 host URL·수동 k6 대상·개인 env·운영 리소스와 접속 대상은 변경하지 않았다.

확정 소스에서 직접 실행한 검증:

- `pnpm type-check`: 4 task 성공·캐시 1개, repo/config/scripts 성공.
  `pnpm lint`: 4 task 성공·캐시 2개, 양쪽 FSD와 repo ESLint 성공.
  신규 sanitizer fixture의 필수 type 누락과 import 정렬을 보완했다. format·lint가 겹친 실행의
  max-lines-per-function 도구 예외는 format 종료 후 개별 파일·전체 lint에서 재현되지 않았다.
  검사 규칙이나 hook을 비활성화하지 않았다.
- `pnpm test:unit:run`: 95파일·653건(contracts 3/server 103/Web 176/Console 371),
  최종 4 task 성공·캐시 2개다. 앞선 확정 계약 unit 실행은 4 task·캐시 0개 성공이었다.
- `pnpm test:harness`: 35건 성공. 실제 두 Next entry에서 local/production을 허용하고 누락·staging·
  development·미지원 값을 거절하는 검사를 포함한다. `NODE_ENV=production`이 local을 바꾸지 않는다.
- 기존 jq PATH의 `pnpm test:ops`: 21파일·291건 성공. 일반 CI local/VM candidate production 입력,
  relay의 direct/tag local/production 허용·staging unknown과 기존 서명·전송 경계를 mock으로 검증했다.
- `pnpm format:check`, `git diff --check`: 성공.
- `pnpm build --force --env-mode=loose --concurrency=1`: 두 앱 실제 local production build 성공·캐시 0개.
  NODE_ENV=production과 NEXT_PUBLIC_APP_ENV=local, 빈 DSN/GTM·업로드/telemetry OFF·불가 loopback DB·
  가짜 Console/R2 입력을 사용했다. 최신 Web standalone `/more/policy`의 200 HTML에서 localhost
  Open Graph URL·이미지와 Twitter 이미지를 확인했다. 운영 production build/수신 검증은 아니다.
- 로그는 `.local/monorepo-config/app-env/local-production/`에 이전 계약의 로그와 분리했다.
  최종 push hook·head CI·리뷰·squash 결과는 PR 본문에서 확인한다. 코드·fixture·문서를 한 환경 전환으로
  묶는 크기 목표 초과 이유와 리뷰 순서도 PR에 기록한다. ENV-10 GTM·DB-01/02·UI/계정 기능은 별도다.

#### 최종 소비자 대조 — 휴면 메일의 NODE_ENV 추론 제거

- `998c289788edbb367637b2cc145a672e2f2f2a21` 이후 추적 앱/공유 서버의 NODE_ENV 사용을 전수 대조해
  휴면 `oci-email-delivery.ts`의 기본 모드와 dev 거절 조건이 Next 실행 모드를 배포 환경으로 취급함을
  확인했다. 앱 consumer는 없지만 사용자 확정 계약과 충돌하므로 MAIL-01의 해당 분기만 같은 PR에서
  보완했다. 회원/메일 기능·앱 consumer를 추가하거나 OCI 인증·IMDS 차단을 바꾸지 않았다.
- provider는 명시적 local/production을 검증한 뒤 local 기본 no-send dev, production 기본 OCI를
  선택한다. production의 dev 모드 거절을 유지하며 누락·staging 등은 OCI client 획득 전에 실패한다.
  NODE_ENV 값과 무관하다. 테스트의 OCI 제출은 전부 SDK mock이며 실제 메일 발송이 아니다.
- `pnpm --filter @oioi-bwg/server exec vitest run src/email/oci-email-delivery.test.ts`: 12건 성공.
  local production 모드의 no-send와 production dev 거절, 기본 OCI/명시적 OCI 결과 mapping,
  미지원 값의 전송 이전 실패를 확인했다. 타입 억제나 기능 재활성화는 없다.
- 보완 후 `pnpm type-check`·`pnpm lint`·`pnpm test:unit:run`은 각각 4 task·캐시 0개 성공했다.
  repo/config/scripts 타입과 repo lint·양쪽 FSD도 성공, unit은 95파일·662건
  (contracts 3/server 112/Web 176/Console 371)이다. harness 35·ops 291·format은 해당 소스/설정이
  같아 앞선 직접 결과를 재사용하고 최종 push hook/CI를 별도로 확인한다.
- 원문 처리 23/대기 15로 갱신한다. MAIL-02의 재활성화 인증 설계·실제 발송·기능 확장은 보류다.
- 보완 후 `pnpm build --force --env-mode=loose --concurrency=1`도 두 앱 성공·캐시 0개다.
  앞과 같은 명시적 local 입력·전송 OFF·가짜 값으로 실행했다. 최종 head CI/리뷰·병합 결과는 PR에 기록한다.
