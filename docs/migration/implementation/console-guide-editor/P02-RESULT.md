---
title: "P02 공용 설정과 검증 기반 분리 결과"
kind: "result"
status: "active"
verified_source:
  repository: "goldmayo/oioi-bwg"
  branch: "feature/p02-shared-config-turbo"
  commit: "a76d800ccaba50a29094dc2e5b3992c1a7fbcb5e"
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
