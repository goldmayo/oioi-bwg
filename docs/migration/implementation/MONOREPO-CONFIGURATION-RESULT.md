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
| [ ] | TEST-01 | 대기 |
| [ ] | TEST-02 | 대기 |
| [ ] | TEST-03 | 대기 |
| [ ] | TEST-04 | 대기 |
| [ ] | RUN-01 | 대기 |
| [ ] | RUN-02 | 대기 |
| [ ] | UI-01 | 대기 |
| [ ] | UI-02 | 대기 |
| [ ] | DOC-01 | 대기 |
| [ ] | ROOT-01 | 대기 |
| [ ] | ROOT-02 | 대기 |
| [ ] | ROOT-03 | 대기 |
| [ ] | ROOT-04 | 대기 |
| [ ] | MAIN-01 | 대기 |
| [ ] | MAIN-02 | 대기 |

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
