---
title: "모노레포 의존성 경계와 검증·빌드 실행 개선 결과"
kind: migration-result
status: in-progress
source_commit: b6c162674a7ec99f894a494c458814f3b6284272
created_at: "2026-10-25"
---

# 모노레포 의존성 경계와 검증·빌드 실행 개선 결과

[PLAN](MONOREPO-BOUNDARIES-AND-EXECUTION-PLAN.md)의 단계별 실제 변경과 실행 증거를 기록한다. 기준선의 진단은 PLAN이 소유하며 여기서는 구현·검증·PR 통합 상태를 구분한다. 운영 배포와 외부 전송 결과를 뜻하지 않는다.

| 단계 | 범위                    | 상태                   |
| ---- | ----------------------- | ---------------------- |
| 1    | DEP-01 의존성 선언      | 로컬 검증 완료·CI 대기 |
| 2    | BND-01 경계 검사        | 미착수                 |
| 3    | TYP-01 테스트 타입 소속 | 미착수                 |
| 4    | OWN-01/02 검증 소유권   | 미착수                 |
| 5    | CAC-01 캐시 영향 범위   | 미착수                 |
| 6    | IMG-01 Docker 입력 축소 | 미착수                 |

## 1단계 — 직접 의존성과 도구 실행 소유권

기준은 계획 PR #224의 squash 결과 `b6c162674a7ec99f894a494c458814f3b6284272`이며 local·origin 통합선의 일치를 확인한 뒤 `feature/monorepo-dependency-ownership`을 분기했다. Node 22.16.0·pnpm 10.15.1·Linux ARM64에서 검증한다.

### 변경 사항

- Web·Console의 직접 Testing Library import를 해당 앱의 개발 의존성에 선언했다. Web의 직접 `jest-dom` import도 포함한다.
- 앱의 `server-only`·`client-only`를 명시했다. Next의 marker 해석과 Vitest alias·mock 구현은 유지한다.
- 실제 lint script를 가진 모든 workspace에 ESLint와 TS config loader인 jiti를 선언했다. config는 이미 ESLint를 직접 소유하므로 jiti만 보완했다.
- 두 Next 앱의 Steiger·tsx 실행과 jsdom 테스트 환경을 각 앱의 개발 의존성으로 명시했다.
- root source·설정·CLI 소비자를 대조한 뒤 직접 consumer가 없는 루트의 `@testing-library/react`·`@testing-library/jest-dom` 선언 두 개만 제거했다. config의 공통 browser setup이 소비하는 jest-dom 선언은 유지했다.
- lockfile은 importer만 변경했다. YAML로 기준선과 대조해 `packages`와 `snapshots`가 동일함을 확인했다. 버전 업그레이드·새 runtime 구현·검사 정책 변경은 없다.

### 실행한 검증

| 명령·방법                                                 | 실제 결과                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm install --lockfile-only --offline --ignore-scripts` | 성공. 기존 Vite/esbuild peer 경고는 남으며 버전·snapshot은 유지 |
| `pnpm install --frozen-lockfile --offline`                | 현재 checkout에서 성공                                          |
| `pnpm exec turbo boundaries`                              | 425파일·6패키지, 위반 0건                                       |
| `pnpm type-check`                                         | 6 workspace와 root 설정·scripts·tests 검사 성공                 |
| `pnpm lint` / `pnpm lint:fsd`                             | 성공. 양 앱 FSD 포함                                            |
| `pnpm test:harness`                                       | 40/40 성공                                                      |
| `pnpm test:unit:run`                                      | 99파일·700건 성공, 5개 실제 test task 모두 cache miss           |
| `pnpm format:check`                                       | 성공                                                            |

### clean checkout 검증

별도 임시 clone에 manifest·lockfile 변경을 적용하고 개인 `.env*` 없이 검사했다. `HUSKY=0 pnpm install --frozen-lockfile --offline`가 새 node_modules에 1,349개 package를 설치했으며 다운로드는 0개다. 저장소의 기존 dependency build-script 정책을 유지했다.

`pnpm --filter @oioi-bwg/web --filter @oioi-bwg/console`로 각각 type-check·lint·test를 실행해 모두 통과했다. Web unit은 31파일·180건, Console은 49파일·373건이다. 이 결과는 clean 전체 workspace 설치 증거이며 앱만 격리한 설치나 prune의 증거로 확대하지 않는다.

### 최종 로컬 검증과 통합 전 상태

검증한 코드 커밋은 `64f40db75994a5c5d09586cc34d099629013f9e7`이다. clean fixture의 manifest·lockfile을 이 커밋과 대조해 동일함을 확인했다. 이후 변경은 이 실행 기록과 PLAN의 실행 개시 이력뿐이다.

- `pnpm test:ops`: 21파일·283건 성공. 기본 PATH에 jq가 없어 공식 배포물의 체크섬을 검증한 jq 1.7.1 ARM64를 임시 PATH로 제공했다. 저장소 의존성이나 시스템 설치는 변경하지 않았다.
- clean fixture에서 `env -i`로 공개 local 환경·빈 DSN·Sentry source map 비활성·telemetry 비활성 입력만 주고 `pnpm build --concurrency=1`을 실행했다. 양 앱의 실제 Next build·타입 검사·standalone 복사가 모두 성공했으며 두 task 모두 cache miss다.
- `git diff --check`와 변경 문서의 명시적 Prettier 검사를 실행한다. 최종 push hook·PR/CI·squash 통합 증거는 PR과 다음 단계의 이력에서 연결한다.

단계 2~6의 경계·타입·실행 정책 변경과 Docker prune는 아직 포함하지 않았다. 실제 PostgreSQL·컨테이너·브라우저 smoke는 이번 로컬 검증에 포함하지 않았으며 코드 PR의 CI 결과와 구분한다.
