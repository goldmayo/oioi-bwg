---
title: "P02 공용 설정과 검증 기반 분리 결과"
kind: "result"
status: "active"
verified_source:
  repository: "goldmayo/oioi-bwg"
  branch: "feature/p02-shared-config-turbo"
  commit: "97a6aec1337857efcdc55ada0ff3aa12f674cf17"
verified_at: "2026-10-06"
---

# P02 공용 설정과 검증 기반 분리 결과

승인된 [ROADMAP의 P02](ROADMAP.md)를 구현했다. 기준 `migration_main`은
`9fd9661e1dafae94a92e600b2c4b57679a9965f8`이며 P01의 `apps/web` 이동은 다시 변경하지 않았다.

## 변경 범위

- pnpm workspace 위에 Turborepo를 추가하고 `type-check`, `lint`, `test`, `build` task interface를
  workspace가 소유하도록 했다.
- `config/typescript/{base,next,node}.json`과 `config/eslint/{base,next,node}.mjs`를 추가했다.
- `apps/web/tsconfig.json`은 Next/app-local include·alias·Vitest type만 소유하는 consumer 설정으로
  줄였고, root `tsconfig.json`은 repository-level `*.mts` 검사를 유지한다.
- root `eslint.config.mts`는 자동 탐색 진입점으로 유지하고, Web의 FSD/route/dependency 정책은
  `apps/web/eslint`가 소유하게 이동했다.
- 기존 custom architecture rule에서 경로 해석 primitive만 `harness/architecture`로 분리했다.
  repo-level 공통 정책은 app workspace끼리 직접 package dependency를 만들지 않는 검사만 추가했다.
- Steiger는 계속 `steiger apps/web/src`를 독립 FSD root로 검사한다. Steiger 규칙을 harness에서
  재구현하지 않았다.
- Husky는 root 하나를 유지한다. pre-commit은 기존 `lint-staged`를 유지하고, pre-push는
  `origin/migration_main` 기준 Turbo `--affected` 검증 뒤 repo-level harness/ops/format 검사를 수행한다.

## Turbo task / cache

`pnpm verify`의 P02 기준은 다음과 같다.

```text
turbo run type-check lint test
→ root type-check / root lint
→ architecture harness
→ ops test
→ format check
→ turbo run build
```

PostgreSQL integration, Docker standalone build/smoke, deployment처럼 환경·외부 상태에 의존하거나
결정적 local cache 대상으로 보기 어려운 검사는 Turbo cache에 넣지 않았다. 기존 CI job은 유지한다.

Remote Cache는 사용하지 않는다. 공유 `config/**`, architecture harness, root ESLint/Steiger/Vitest
설정은 Turbo global dependency로 hash에 포함한다. Web-local policy/source는 workspace 기본 입력으로
hash에 포함된다. Next build output은 `.next/**`를 대상으로 하되 `.next/cache/**`는 제외한다.

Turbo가 workspace에 만드는 `.turbo/turbo-*.log`가 다음 실행의 input hash를 바꾸는 것을 검증 중
확인해 `.turbo/**`를 task input 및 git 관리 대상에서 제외했다. 동일 source에서
`type-check/lint/test`를 연속 실행한 결과 두 번째 실행은 **3/3 local cache hit**를 확인했다.

## 실행한 검증

GitHub Actions의 임시 P02 검증 runner에서 Node 22.16.0 / pnpm 10.15.1로 다음을 확인했다.
임시 workflow는 검증 완료 후 최종 diff에서 제거했다.

| 검사 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 성공 |
| Turbo `type-check lint test` 2회 연속 실행 | 두 번째 실행 3/3 cache hit |
| `pnpm verify` | 성공 |
| Web unit | 57개 파일 / 240개 테스트 성공 |
| architecture harness | 11개 성공 |
| ops | 4개 파일 / 51개 테스트 성공 |
| Web ESLint / Steiger | 성공 |
| root type-check / root lint | 성공 |
| `pnpm format:check` | 성공 |
| `turbo run build` | Next production build 성공 |
| `TURBO_SCM_BASE=origin/migration_main turbo run type-check lint test --affected --dry=json` | 성공 |

검증 run: https://github.com/goldmayo/oioi-bwg/actions/runs/37386630281

PostgreSQL 17 integration과 Docker standalone/container Playwright smoke는 기존 정식 PR CI가 계속 소유한다.
P02에서 해당 gate를 삭제하거나 약화하지 않았고 `.github/workflows/verify.yml`의 배포/Promotion 구조도
변경하지 않았다.

## P03 이후로 미룬 항목

이번 P02에는 다음을 만들지 않았다.

- `apps/console`
- `packages/contracts`
- `packages/server`
- Web/Console 코드 이관
- DB/API/Auth/MFA/CheerGuide/Waveform 변경
- Promotion/OCI Development 배포 구조 변경

실제 공통 계약·server 코드를 workspace package로 추출하는 작업은 ROADMAP P03에서 진행한다.

## PR #110 검토 후 수정 (2026-10-06)

검토 기준 `a68b159e50d15385df2478c693f5dd29cb00671d`에서 발견한 설정 누락을 보완했다.

- build의 `passThroughEnv`에 `SENTRY_AUTH_TOKEN`을 추가해 strict mode에서도 업로드 토큰을 전달한다.
- build input에 앱의 `.env*`를 포함해 Next가 읽는 로컬 환경 파일 변경을 hash에 반영한다.
- test input에 `$TURBO_ROOT$/tests/mocks/**`를 포함해 workspace 밖의 실제 Vitest mock 변경을 반영한다.
- Web ESLint의 parser/resolver, Next root, boundaries root를 설정 파일 기준 절대 경로로 고정했다.
  repository root와 `apps/web` 양쪽에서 type-aware rule과 alias dependency 경계가 유지되는
  실제 CLI 회귀 검사를 기존 architecture test에 추가했다.

수정 후 Node 24.19.0 / pnpm 10.15.1 환경에서 다음을 확인했다.

- `pnpm verify`의 Web type-check, ESLint/Steiger, unit 57개 파일 / 240개 테스트,
  root type-check/lint, architecture harness 12개, ops 4개 파일 / 51개 테스트,
  format check가 통과했다.
- 같은 입력에서 `.env.local` 변경 시 build hash, `tests/mocks/server-only.ts` 변경 시 test hash가
  바뀌었고 원복 후 기존 hash가 복원됐다.
- 이어서 같은 source/env의 Turbo `type-check lint test`를 재실행해 **3/3 local cache hit**를 확인했다.
- 실제 수정한 Turbo 설정을 복사한 격리 workspace의 build task에서 더미 토큰이 strict mode로
  전달되는 것을 확인했다. 외부 Sentry 호출이나 실제 credential은 사용하지 않았다.

로컬 `pnpm verify` 전체 결과는 실패다. 마지막 production build가 Google Fonts의 Geist/Geist Mono
연결 실패로 중단됐다. 수정된 source의 production build, PostgreSQL integration과 Docker smoke는
갱신된 정식 PR CI에서 확인한다. 실제 소스맵 업로드는 Promotion 검증 범위로 남긴다.

## 공용 mock의 affected 검사 누락 보완 (2026-10-06)

검토 기준 `baf545a99606aadeb241a2f2b934d3aa01a8d326`에서 root `tests/mocks/**`만 변경하면
test hash는 바뀌지만 pre-push의 `--affected`가 Web test task를 선택하지 않는 것을 확인했다.
P02 병합 후 mock만 수정하는 후속 변경에서 로컬 검사가 생략되는 문제다.

[수정 커밋](https://github.com/goldmayo/oioi-bwg/commit/4153bea5e724a551c61ff2e0e8e58dcd8b917bf9)에서
`tests/mocks/**`를 test 전용 input에서 `globalDependencies`로 옮겼다. mock 변경이 캐시 무효화와
affected 선택에 모두 반영된다. 이 보수적인 설정은 mock 변경 시 다른 workspace task도 재검사한다.
task 이름, Husky 흐름, CI gate는 유지했다.

`harness/architecture/app-dependencies.test.js`에 실제 Turbo CLI 회귀 검사를 추가했다.
현재 manifest·lockfile·Turbo 설정을 격리된 임시 Git 저장소에 복사하고 기준 커밋을 만든 뒤,
다른 변경 없이 mock만 수정한다. 변경 전 affected task가 없고, 변경 후 Web test가 선택되며
test hash가 바뀌는지 검증한다. 수정 전에는 해당 검사만 실행해 실패를 확인했고 수정 후에는 통과했다.

pre-push에서는 Git hook의 저장소 환경변수가 fixture 명령에 상속되는 문제도 발견했다.
[검사 격리 보완](https://github.com/goldmayo/oioi-bwg/commit/97a6aec1337857efcdc55ada0ff3aa12f674cf17)에서
fixture의 Git/Turbo subprocess에 전달하는 환경에서 `GIT_*`를 제거해 임시 저장소만 사용하도록 했다.
실제 저장소를 가리키는 `GIT_DIR`·`GIT_WORK_TREE`·`GIT_INDEX_FILE`을 주입한 별도 실행에서도
회귀 검사 통과 후 원래 저장소의 HEAD와 index가 보존되는 것을 확인했다.

Node 22.16.0 / pnpm 10.15.1에서 실행한 검증:

- `node --test --test-name-pattern='mock-only' harness/architecture/app-dependencies.test.js`: 통과.
- `pnpm verify`: Web/root type-check·ESLint, Steiger, unit 57개 파일 / 240개 테스트,
  architecture harness 13개, ops 4개 파일 / 51개 테스트, format check와 Next production build 모두 통과.
- `pnpm exec turbo run type-check lint test` 재실행: 3/3 local cache hit.
- `git diff --check`: 통과.

위 `pnpm verify` 전체 검증과 3/3 cache hit는 Git 환경 격리 보완 후에도 다시 통과했다.

PostgreSQL integration, Docker standalone/container smoke와 실제 Sentry 업로드는 이번 로컬 검증에서
실행하지 않았다. 해당 CI 및 Promotion 검증 범위는 유지한다.
