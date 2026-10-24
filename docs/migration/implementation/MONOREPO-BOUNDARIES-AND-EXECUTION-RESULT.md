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
| 1    | DEP-01 의존성 선언      | 병합 완료 — PR #225 |
| 2    | BND-01 경계 검사        | 분석기 검증 중                 |
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

### 1단계 통합 증거

[PR #225](https://github.com/goldmayo/oioi-bwg/pull/225)의 [Verify #524](https://github.com/goldmayo/oioi-bwg/actions/runs/40109845064)가 실제 PG·이미지·브라우저·paired smoke를 포함해 성공했다. 미해결 리뷰 없이 squash 결과 `2a1603048f9e3df23458e5720f815a3e995d7493`로 통합했으며 검증 head `90ddfbfcbf8e9c86b741d6fe7752b503739c98ed`와 통합 tree가 동일하다. push hook의 type/lint/unit·root type/lint·harness 40건·ops 283건·format도 성공했다.

## 2단계 A — resolved dependency 분석기

기준 `2a1603048f9e3df23458e5720f815a3e995d7493`에서 분기했다. 분석기와 필수 실행 연결을 독립 검증 가능한 두 PR로 나눈다. A는 `pnpm lint:deps` 명령과 정책을 제공하며 B에서 회귀 fixture·기존 lint/verify/hook 연결·Testing SSOT 개정을 적용한다.

- root의 tsx runner가 workspace별 TS 설정으로 source·config·test를 해석한다. `@/*`, `exports`, type-only·문자열 dynamic import도 분석한다. 정책 factory는 `@oioi-bwg/config/dependencies`가 소유한다.
- 패키지의 앱 역참조, 앱 간 참조, 상대 경로로 workspace 경계를 우회한 참조, 미선언 내부 의존성·`workspace:` 누락, client의 server core 참조, contracts의 플랫폼 의존성, runtime 순환을 오류로 처리한다.
- ESLint/Steiger FSD 검사는 유지한다. Turbo boundaries를 함께 실행해 선언된 의존성과 실제 사용을 대조한다. 문자열을 계산하는 dynamic import 등 정적 해석 불가능한 참조까지 증명하는 도구는 아니다.
- Node 22.16을 지원하는 dependency-cruiser 18.7.0을 고정했다. 새 tool과 필요한 전이 의존성만 추가했으며 기존 lockfile importer·package·snapshot 값이 보존됨을 YAML 구조로 대조했다.
- Console auth의 type import가 포함된 순환은 경고로 남긴다. 실제 runtime edge만으로 닫히는 순환은 실패한다. 도메인 auth 리팩터링은 이 범위에 섞지 않는다.
- 외부 k6 runtime의 스크립트와 소비 경로가 없는 legacy `drizzle/relations.ts`는 초기 진입점에서 제외한다. Drizzle 파일을 삭제하거나 reachable dependency 검사에서 제외하지 않는다.

실행한 검증: frozen offline 설치·전체 `pnpm type-check`·`pnpm lint:deps` 성공. 정상 저장소는 6 workspace·root·Web integration graph 오류 0건, Turbo 426파일·6패키지 위반 0건이다. 임시 contracts 테스트에서 Web source를 상대 경로로 참조하자 `packages-to-apps` 위반과 종료 코드 1을 확인했고 fixture를 제거했다. 추가로 `pnpm lint`, `pnpm lint:fsd`, `pnpm test:harness` 40/40, `pnpm test:unit:run` 99파일·700건(5개 task 모두 cache miss), `pnpm format:check`가 성공했다. CI 결과는 PR에 기록한다.
