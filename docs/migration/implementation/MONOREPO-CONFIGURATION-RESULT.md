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
| [ ] | CFG-04 | 대기 |
| [ ] | CFG-05 | 대기 |
| [x] | CFG-06 | root/pre-commit/package가 동일한 server/contracts 경계 규칙을 적용한다. 실제 lintText 회귀로 확인했다. |
| [ ] | CFG-07 | 대기 |
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
