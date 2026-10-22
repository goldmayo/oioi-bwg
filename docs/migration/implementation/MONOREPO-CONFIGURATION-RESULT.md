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

## 원문 항목 체크리스트

| 점검 | ID | 결과와 근거 |
| --- | --- | --- |
| [ ] | ENV-01 | 대기 |
| [ ] | ENV-02 | 대기 |
| [ ] | ENV-03 | 대기 |
| [ ] | ENV-04 | 대기 |
| [ ] | ENV-05 | 대기 |
| [ ] | ENV-06 | 대기 |
| [ ] | ENV-07 | 대기 |
| [ ] | ENV-08 | 대기 |
| [ ] | ENV-09 | 대기 |
| [ ] | ENV-10 | 대기 |
| [ ] | MAIL-01 | 대기 |
| [ ] | MAIL-02 | 대기 |
| [ ] | OBS-01 | 대기 |
| [ ] | OBS-02 | 대기 |
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
| [ ] | MAIN-01 | 대기 |
| [ ] | MAIN-02 | 대기 |

## 2026-10-22 추가 논의 체크리스트

원문 38개는 **처리 12개·대기 26개**로 유지한다. 여기에 정상화 추가 항목 7개와 후속 UI 검토 1개를
별도로 등록한다. 총 추적 ID는 46개이며 추가 8개는 모두 미구현·검토/대기다.
대기에는 결함뿐 아니라 기준선 확정·구조 제안·보존 판단이 포함되므로 미해결 runtime 결함 수로 읽지 않는다.
이번 문서 반영은 아래 작업의 구현 승인이나 완료 표시가 아니다.

| 점검 | ID | 범위 | 현재 상태와 후속 기준 |
| --- | --- | --- | --- |
| [ ] | BASE-01 | Sentry 통합 기준선 | 앱 코드·로컬 검증 완료 문서를 확인했다. main 미병합이며 합쳐진 소스의 검사는 대기다. Slack Worker의 별도 배포·실수신 완료와 앱 이미지의 운영 검증을 구분한다. |
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
