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
| 2    | BND-01 경계 검사        | 병합 완료 — PR #226·#227                 |
| 3    | TYP-01 테스트 타입 소속 | 병합 완료 — PR #228                 |
| 4    | OWN-01/02 검증 소유권   | 병합 완료 — PR #229                 |
| 5    | CAC-01 캐시 영향 범위   | 병합 완료 — PR #230~#238                 |
| 6    | IMG-01 Docker 입력 축소 | pruned 입력 전환 중                 |

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


### 2단계 A 통합 증거

[PR #226](https://github.com/goldmayo/oioi-bwg/pull/226), [Verify #525](https://github.com/goldmayo/oioi-bwg/actions/runs/40111543023)가 전체 성공했다. 검증 head `4cf2e646e9f659b4ad90f0abf95db644d699989f`와 squash 통합 `bbd4c63b945024ffd6ce60d44bc6bc095fe77c1e`의 tree 일치를 확인했다. push hook의 전체 gate도 성공했다.

## 2단계 B — 경계 회귀와 필수 실행 연결

기준은 A의 통합 head다. `lint:deps`를 root lint/verify와 push hook에 연결하므로 CI quality의 기존 lint entry에서도 실행한다. source/config/test의 해석 정책은 동일하다.

별도 임시 workspace fixture로 공개 export·앱 alias·자체 테스트·허용한 root HTTP adapter의 정상 동작과 역참조·config 교차 참조·상대 경로 우회·private export·미선언 의존성·type-only·dynamic import·runtime 순환 차단을 검증한다. root 테스트의 앱 참조 예외는 foundation 테스트에서 Web response adapter로 향하는 edge 한 곳으로 제한했다. Testing §17과 index를 같은 변경 단위에서 개정한다. 로컬 `pnpm type-check`, `pnpm lint`(새 gate 포함), `pnpm lint:fsd`, `pnpm test:harness` 41/41, `pnpm test:unit:run` 99파일·700건, `pnpm format:check`가 성공했다. 새 graph fixture는 19가지 사례와 manifest 규칙을 검사했다. CI 결과는 PR에 기록한다.


### 2단계 B 통합 증거

[PR #227](https://github.com/goldmayo/oioi-bwg/pull/227)의 [Verify #526](https://github.com/goldmayo/oioi-bwg/actions/runs/40112319687)과 push hook 전체 gate가 성공했다. 검증 head `b465c4d8e635f7b00d8af2dd836bef33e2dcc7f9`와 squash `7b3efa121f42c54aa51bd4ee2c7a541eee56cb3d`의 tree가 동일하다.

## 3단계 — 테스트의 주 타입 검사 소속

기준은 `7b3efa121f42c54aa51bd4ee2c7a541eee56cb3d`다. 추적된 TS 테스트 124개 중 Contracts의 `contract.test.ts` 한 개만 소속이 없었다. 수정 전 실제 파일에 `string = 42`를 임시 추가해도 package type-check가 종료 코드 0으로 통과하는 것을 재현하고 원복했다.

Contracts의 테스트 exclude를 제거하고 기존 명시적 Vitest import·runtime 수집 범위는 유지한다. 환경 분리가 필요하지 않아 별도 테스트 TS 설정을 만들지 않는다. harness는 11개 repo/workspace/test 프로그램의 초기 fileNames로 모든 추적 TS 테스트의 주 소속이 정확히 하나인지 검사한다. import에 따른 중복 방문을 소속 중복으로 취급하지 않는다. 실제 Contracts 테스트 source의 메모리 fixture에서도 TS2322를 검출해 exclude 재도입을 방지한다. 수정 후 동일 임시 타입 오류를 실제 package 명령이 TS2322·종료 코드 2로 거절했고 fixture를 원복했다. 정상 package type-check와 관련 harness 5건은 성공했다. 전체 `pnpm type-check`, `pnpm lint`(경계 gate 포함), `pnpm lint:fsd`, `pnpm test:harness` 43/43, `pnpm test:unit:run` 99파일·700건, `pnpm format:check`가 성공했다. 주 소속 누락·중복은 모두 0개다.


### 3단계 통합 증거

[PR #228](https://github.com/goldmayo/oioi-bwg/pull/228)의 [Verify #527](https://github.com/goldmayo/oioi-bwg/actions/runs/40113135379)과 push hook 전체 gate가 성공했다. 검증 head `5290938bad53c9fea9aabddabe29573a61f9c30c`와 squash `e1fd1387c1077d5c63530282343f0c8fab313e76`의 tree가 동일하다.

## 4단계 — workspace 검증의 완결성과 root 중복 제거

기준은 `e1fd1387c1077d5c63530282343f0c8fab313e76`다. 수정 전 Web·Console next.config.ts와 server·contracts vitest.config.ts에 각각 임시 타입 오류를 넣었지만 네 workspace의 단독 type-check가 모두 종료 코드 0으로 통과했다. 각 파일은 원복했다.

네 workspace에 Node 설정 타입 프로그램을 만들고 자체 type-check가 소스와 설정을 함께 검사하도록 연결했다. 소유권을 이관한 뒤 root 설정 include에서 workspace 항목을 제거했다. dependency runner도 source와 Node 설정의 TS 해석을 구분한다. runtime Sentry 진입점은 자체 앱 alias가 필요하므로 앱 소스 프로그램에 명시적으로 포함했다. 환경값이나 instrumentation 구현은 변경하지 않는다.

root lint:repo는 apps와 packages를 제외하며 기존 root ESLint 조합은 staged 검사를 위해 유지한다. Web 경로에서 양 앱을 검사하던 테스트를 root fsd-policy harness로 이관했다. 소비자가 해당 테스트 하나뿐임을 import·config·CLI 검색으로 확인한 architecture.ts 재수출 wrapper도 제거했다. workspace 설정의 주 소속·strict/noEmit·Node alias 격리를 harness로 보호한다. Sentry runtime의 tooling 참조도 graph gate와 fixture로 거절하도록 보완했다.

동일한 네 설정 오류를 각 workspace의 실제 명령이 모두 TS2322·종료 코드 2로 거절했다. fixture를 원복한 뒤 전체 type-check·lint·FSD·harness 44/44·unit 99파일 700건·format가 성공했다. Sentry guard 추가 후 config 자체 타입·lint 검사와 graph 20가지 사례도 별도 성공했다. root ESLint JSON reporter는 77파일·오류 0건·workspace 파일 0개를 확인했으며 최종 lint:deps도 source/config 전체 오류 0건과 Turbo 424파일·6패키지 위반 0건으로 성공했다. 최종 push/CI 결과는 PR에 기록한다.

이 checkpoint는 4개 설정 프로그램·실행 manifest·2개 runtime include·root 검사 축소·해석 runner·이관 회귀·SSOT를 함께 맞추므로 21파일이다. 설정의 소유권 이전과 root 제거, runtime 분류와 경계 검증을 따로 병합해 검사 사각지대가 생기지 않도록 묶었다. 리뷰 순서는 workspace 설정/명령 → root 범위/runner → harness 이동/경계 → SSOT/결과다.


### 4단계 통합 증거

[PR #229](https://github.com/goldmayo/oioi-bwg/pull/229)의 [Verify #528](https://github.com/goldmayo/oioi-bwg/actions/runs/40114116656)과 최종 push hook 전체 gate가 성공했다. 검증 head `c2c2cf604797fb13b8ea86e0dc63946e48befb29`와 squash `5136d61b81dd042eca26d6bfa64b4f94deb09b52`의 tree가 동일하다.

## 5단계 A — 캐시 기준선과 root 소유권 보완

4단계 head에서 개인 env 없이 임시 Git fixture를 생성하고 18개 입력을 각각 변경·원복하며 type-check/lint/test/build의 dry JSON과 affected 선택을 대조했다. config/Next/Sentry/browser/ESLint/Steiger/TS preset, server/contracts source, root harness/설정 모두 실행 명령이 있는 task 19개 전부의 hash와 선택을 바꿨다. 해당 source SHA와 squash tree 일치를 확인했으므로 5단계 기준선으로 사용한다. 실제 task 실행 시간의 개선 증거는 아니다.

server source만 바꿔 globalCacheInputs를 대조하자 외부 의존성 hash는 같고 내부 의존성 hash가 `d3ec59b15666256c`에서 `5a026d4a4bdc1610`으로 바뀌었다. root manifest의 config/server/contracts 직접 의존이 전역 source closure를 만들고 있다. 단순 inputs 조정으로 해결할 수 없음을 공식 root workspace dependency 계약과 대조했다.

[PLAN의 2026-10-25 5단계 보완](MONOREPO-BOUNDARIES-AND-EXECUTION-PLAN.md#2026-10-25-5단계-보완--root-내부-의존성의-전역-hash-해소)에 도구 workspace로 실제 consumer를 이관하는 실행안을 추가했다. 헌법 2.19·Testing 1.12는 이 전환의 책임과 root adapter 한계를 먼저 정의한다. 이 기록은 도구 코드 이관·cache 개선 완료를 뜻하지 않는다. 진단 뒤 코드/타입/테스트/build는 추가 실행하지 않은 문서 전용 checkpoint다.

문서 링크 검사에서 4단계 이관으로 없어진 AS-IS 코드 경로를 발견했다. PLAN의 과거 코드 근거는 원래 source_commit의 GitHub blob 링크로 고정해 현재 구조와 혼동하지 않게 했다. 로컬 문서 링크와 해당 기준 커밋의 대상 존재를 다시 확인한다.


### 5단계 A 통합 증거

[PR #230](https://github.com/goldmayo/oioi-bwg/pull/230)의 [Verify #529](https://github.com/goldmayo/oioi-bwg/actions/runs/40115304369)는 문서 전용 scope/verify 성공과 무거운 job 생략을 확인했다. 두 push hook도 Markdown-only로 검증을 생략했다. 검증 head `820d1ac04639ae2adc2cb262ffa22e24641b62d8`와 squash `ec9776055267f7eb6dedfd464639a18b5cf9439b`의 tree가 동일하다.

## 5단계 B1 — 저장소 설정 조합의 실제 소유 workspace

기준은 `ec9776055267f7eb6dedfd464639a18b5cf9439b`다. private repository-tools workspace와 기존 공통 Node preset을 사용하는 공개 repository preset을 추가했다. Root ESLint/Steiger는 Tool의 공개 설정 파일을 재수출하는 자동 탐색 entry이며 기존 실제 설정 조합과 앱 root는 유지한다. Root/scripting/운영 테스트의 TS 설정도 Tool의 공개 preset 파일을 extends한다.

Tool은 config·TypeScript·Node types·ESLint·jiti를 직접 소유한다. 새 workspace를 dependency 분석과 타입 소속 검사에 포함하고 root repo lint는 Tool을 중복 검사하지 않는다. 제품 runtime의 tooling import 금지를 Tool까지 확장했다. root의 JS/TS adapter는 source별로 대응하는 Tool 공개 export 파일만 참조할 수 있으며 TS preset도 공개 export와의 대응을 검사한다.

pnpm의 새 importer 해석이 일부 검사 도구 patch를 재선택해, 기존 root 잠금 버전으로 새 importer를 고정했다. 기존 importer/package/snapshot은 모두 보존하고 Tool importer만 추가했으며 frozen offline 설치가 성공했다. 새 설정을 추가한 직후 tracked-config harness는 아직 Git에 등록되지 않은 Tool 파일 때문에 실패했으며, 파일을 추적한 뒤 harness 44/44가 성공했다. 이 단계는 Root 내부 의존성 제거 전 준비 작업이며 cache 개선 완료로 보고하지 않는다.


최종 로컬 검증은 type-check 7 workspace+root·lint(새 graph 포함)·FSD·harness 44건·unit 99파일 700건·format 모두 성공했다. Tool 파일의 추적 등록 후 관련 소속 harness 6건도 성공했다. 임시 미등록 root adapter, 등록 adapter의 비공개 파일 참조, 제품 runtime의 Tool 참조를 각각 넣자 lint:deps가 종료 코드 1과 해당 정책 오류로 거절했고 모두 원복했다. 최종 push/CI 결과는 PR에 기록한다.


### 5단계 B1 통합 증거

[PR #231](https://github.com/goldmayo/oioi-bwg/pull/231)의 [Verify #530](https://github.com/goldmayo/oioi-bwg/actions/runs/40116351548)과 최종 push hook 전체 gate가 성공했다. 검증 head `480df33fdf649406126e175f16349f5012913ec3`와 squash `686bf65a7419fef6bc086c9feade2b8e5d623c31`의 tree가 동일하다.

## 5단계 B2-a — architecture harness의 실제 소비자 이관

기준은 `686bf65a7419fef6bc086c9feade2b8e5d623c31`다. 검사 이관을 harness와 분석기/호환 CLI의 두 PR로 나눠 20파일·400줄 검토 목표를 유지한다. 이 PR은 architecture harness 9개와 직접 사용하는 도구 의존성을 이관한다. Root test:harness는 Tool 자체 명령을 위임한다. Root 기준 경로는 명시적인 repository 위치로 계산하고, server 조건부 export의 Node eval 검증은 실제 소비자인 Tool cwd에서 실행한다.

Tool이 dependency-cruiser·esbuild·tsx·Vitest·server를 직접 선언했다. 기존 root의 잠금 해석을 그대로 소비하며 다른 importer/package/snapshot은 유지한다. 보수적인 기존 hash 동작은 harness glob의 새 위치로 유지한다. Root 공개 adapter·비공개/bare entry·미등록 consumer·선언된 제품 tooling 참조·Tool의 앱 역참조를 포함한 graph 26가지 사례를 검사한다.

Tool cwd로 실제 실행하자 Linter의 암묵적 cwd로 FSD 12사례가 설정을 적용하지 못하는 실패가 드러났다. Linter에도 repository cwd를 명시해 기존 messageId 기대를 보존했고 Tool harness 44/44가 성공했다. 전체 type-check(7 workspace+root), lint·FSD, unit 99파일 700건, format도 성공했다. 분석기 분리 뒤 Root lint:deps가 graph 오류 0건·Turbo 435파일 7패키지 위반 0건으로 성공했고, Root test:harness의 Tool 위임도 44/44 성공했다. 최종 push/CI는 PR에 기록한다. 실제 cache 전환은 후속 C가 소유한다.


### 5단계 B2-a 통합 증거

[PR #232](https://github.com/goldmayo/oioi-bwg/pull/232)의 [Verify #531](https://github.com/goldmayo/oioi-bwg/actions/runs/40117998246)과 최종 push hook 전체 gate가 성공했다. 검증 head `5c5578597cfaed2299a114bbaec42955567b6bfa`와 squash `cbc35bc499785cdd830dfc393ad63d366c42f42e`의 tree가 동일하다.

## 5단계 B2-b — dependency runner와 기존 CLI 호환 진입점

기준은 `cbc35bc499785cdd830dfc393ad63d366c42f42e`다. 분석기 구현을 Tool의 src로 옮기고 repository root 계산을 실제 파일 위치에 맞췄다. 정책과 분석 범위는 유지한다. Tool의 lint:deps 명령과 공개 CLI export를 추가하고 Root 명령은 Tool 위임 뒤 기존 Turbo boundaries를 실행한다. 기존 scripts 파일은 등록된 Tool 공개 entry만 import한다. Tool의 기존 직접 의존성으로 실행하므로 lockfile 변경은 없다. 전체 type-check(7 workspace+root)·lint(새 Tool 위임 포함)·FSD·harness 44/44·unit 99파일 700건·format가 성공했다. 기존 Root CLI와 Tool cwd의 직접 CLI를 각각 Node+tsx로 실행해 stdout/stderr와 종료 코드 0이 동일함도 확인했다. 최종 push/CI는 PR에 기록한다.


### 5단계 B2-b 통합 증거

[PR #233](https://github.com/goldmayo/oioi-bwg/pull/233)의 [Verify #532](https://github.com/goldmayo/oioi-bwg/actions/runs/40119049822)와 push hook 전체 gate가 성공했다. 검증 head `f5947ddd8af7accd2b14d849625c4b97bf9bae8a`와 squash `54e4c1c462fe17bf0cc4a2d7d8fd82d920e716c0`의 tree가 동일하다.

## 5단계 B3-a — operator 구현의 실제 소비자 이관

기준은 `54e4c1c462fe17bf0cc4a2d7d8fd82d920e716c0`다. 실행·정책 구현을 Tool src/operators로 옮기고 기존 scripts 경로는 등록된 공개 entry를 재수출한다. local CLI·OCI worker·테스트의 기존 import 경로를 보존한다. 본문의 DB 대상/권한 검사·오류 클래스·파일 보호·서비스 호출은 변경하지 않는다. Tool은 이미 server 의존성을 직접 소유하며 lock 변경은 없다.

실행·정책 본문 189줄의 byte 동일성을 확인했다. 전체 type-check·lint·FSD·harness 44/44·unit 99파일 700건·ops 21파일 283건·format가 성공했다. build:console-operator와 bundle/provenance의 모든 source hash 대조도 성공했고 새 Tool 구현과 기존 Root entry가 모두 포함됐다. 실제 DB 검증은 PR CI가 소유한다. 두 구현과 동일 오류 클래스·공개 entry·경계를 한 checkpoint로 맞추므로 변경량이 400줄 목표를 소폭 넘는다. 리뷰는 이동 본문 → 공개 entry/Root 재수출 → 경계/SSOT 순서로 한다.


### 5단계 B3-a 통합 증거

[PR #234](https://github.com/goldmayo/oioi-bwg/pull/234)의 [Verify #533](https://github.com/goldmayo/oioi-bwg/actions/runs/40119890530)와 push hook 전체 gate가 성공했다. 검증 head `7514a56ab67b0f36aa3f4cf2ad6c3f98f87f86f2`와 squash `6282c0256080d51c62d4c0c6f72af884fce812c2`의 tree가 동일하다.

## 5단계 B3-b — 운영 테스트·fixture의 직접 소비 소유권

기준은 `6282c0256080d51c62d4c0c6f72af884fce812c2`다. config를 직접 소비하는 배포 계약 테스트와 server를 소비하는 MFA fixture를 Tool로 이관한다. Root ops 수집은 두 위치의 합집합을 유지하며 fixture의 기존 경로는 등록된 공개 entry를 import한다. Tool은 otplib을 직접 선언해 다른 package의 node_modules를 createRequire anchor로 소비하던 우회를 제거한다. 격리 DB guard·OTP epoch·출력/정리 순서는 유지한다. Tool Node 테스트 프로그램과 전체 검사의 실행 소속을 함께 연결한다.

기존 package/snapshot과 Tool 외 importer를 보존한 frozen offline 설치가 성공했다. 배포 계약 테스트의 byte 동일성, 기존/새 MFA entry의 비격리 DB 거절·stdout 부재, otplib 13.5.0 CJS/ESM 공개 API의 4개 epoch 결과 동일성을 확인했다. 전체 type-check·lint·FSD·harness 44/44·unit 99파일 700건·ops 21파일 283건·format가 성공했다. 로컬에서 실제 DB fixture를 생성하지 않았다. 최종 push/CI는 PR에 기록한다.


### 5단계 B3-b 통합 증거

[PR #235](https://github.com/goldmayo/oioi-bwg/pull/235)의 [Verify #534](https://github.com/goldmayo/oioi-bwg/actions/runs/40120650438)와 push hook 전체 gate가 성공했다. 검증 head `861493b7b1a04fab2d515cde5c03f21709b7b698`와 squash `6a1cc6b6e1c6d02586bbeebda750d780be617e56`의 tree가 동일하다.

## 5단계 B3-c — PostgreSQL 통합 테스트의 실제 소비자 이관

기준은 `6a1cc6b6e1c6d02586bbeebda750d780be617e56`다. foundation·operator PG 테스트와 실제 PG project 조합을 Tool로 옮기고 Root 설정은 등록된 공개 entry를 재수출한다. Tool이 contracts·postgres·Drizzle을 직접 선언한다. Node/Web 타입 프로그램·수집·해석 context·HTTP adapter의 단일 예외 경로를 함께 바꾼다. 기존 Root guarded runner와 DB lifecycle·프로젝트명·직렬 실행·서버 package의 PG 소유권은 유지한다. 이전 Root foundation 경로와 인접 Tool 테스트에는 앱 참조 예외를 허용하지 않는다.

두 PG 본문은 byte 동일하며 전체 PG 수집은 기존 4파일·Node/Web project·직렬 옵션을 보존했다. 새 Node/Web 테스트에 임시 TS2322를 넣자 Tool 명령이 각각 종료 코드 2로 거절했고 Root type-check:tests도 Node 오류를 거절했다. 모두 원복한 뒤 전체 type-check·lint·FSD·harness 44/44(경계 28사례·추적 TS 테스트 124개 주 소속 포함)·unit 99파일 700건·ops 21파일 283건·format가 성공했다. frozen offline 설치와 기존 lock 해석 보존도 확인했다. Root의 정적 내부 package 직접 import는 0개다. 실제 PG 실행은 PR CI가 소유하며 Root manifest 정리는 후속 C에서 수행한다.


### 5단계 B3-c 통합 증거

[PR #236](https://github.com/goldmayo/oioi-bwg/pull/236)의 [Verify #535](https://github.com/goldmayo/oioi-bwg/actions/runs/40121550990)와 push hook 전체 gate가 성공했다. 검증 head `8662f93ab66d61b26e5614eb6774ba57181b51e8`와 squash `2fb159dc406dae81e7c9891fd35c769fa6d8735a`의 tree가 동일하다.

## 5단계 C1 — Root 내부 의존 제거와 통합 검사의 실행 보장

기준은 `2fb159dc406dae81e7c9891fd35c769fa6d8735a`다. 실제 consumer 이관과 Root 직접 import 0개를 확인한 뒤 Root config/server/contracts 선언만 제거한다. 내부 workspace 선언과 Root 직접 package import를 gate가 거절한다.

B3-c head의 별도 Git 복사본에서 18가지 입력을 변경해 cache 후보를 측정했다. Root internal hash는 빈 문자열이며 browser setup은 양 앱 unit, Next/Sentry는 앱 build/설정 타입 검사에 전파됐다. Root 설정·harness는 제품 hash를 유지했다. 이는 후속 C2 후보의 hash 실험이며 현재 브랜치의 cache 전환 완료 증거가 아니다. 실험에서 Root 파일 변경의 affected 선택이 비어 Tool을 선택하지 않음을 확인했다. Root 검증 entry는 제품 Turbo 실행에서 Tool을 제외한 뒤 Tool 자체 type/lint를 항상 호출한다. 전체 실행의 중복과 Root 변경의 누락을 함께 방지하며 Tool 통합 검사는 uncached로 유지한다. 공통 task 입력·전역 파일 입력의 세분화는 후속 C2가 소유한다.

전체 type-check·lint·FSD·harness 45/45(경계 29사례·Root manifest/alias 회귀 포함)·unit 99파일 700건·ops 21파일 283건·format가 성공했다. 실행 로그에서 Tool type-check와 lint는 각각 한 번이었다. 실제 dry JSON의 Root internal hash 빈 값과 Tool 제외 scope를 확인했다.

개인 env가 없는 index tree `1349dce1f783edb05dc4c8a439e20ee85f2d52ff` 복사본에서 frozen offline 설치 8.22초, env를 초기화한 build `--concurrency=1 --summarize`가 성공했다. 두 build 모두 cache miss, Turbo 경과 31.747초이며 양 앱 standalone server.js가 존재한다. 이후 변경은 이 RESULT 기록뿐이다. 최종 push/CI는 PR에 기록한다.


### 5단계 C1 통합 증거

[PR #237](https://github.com/goldmayo/oioi-bwg/pull/237)의 [Verify #536](https://github.com/goldmayo/oioi-bwg/actions/runs/40122730181)와 push hook 전체 gate가 성공했다. 검증 head `c19e86e1482c44aeb5a89f3ad018d8a76e19cba4`와 squash `e5907ab1cd1bf182825373fe7d3be0b5744ad79d`의 tree가 동일하다.

## 5단계 C2 — task별 config 입력과 필요한/무관 cache 회귀

기준은 `e5907ab1cd1bf182825373fe7d3be0b5744ad79d`다. Root 전역 파일 입력을 제거하고 config의 transit·build 전파는 package.json만 사용한다. script 없는 config build 노드의 실제 입력도 대조했다. 빈 inputs로 기본 입력이 사라진다고 가정하지 않는다. 자체 workspace 기본 입력과 server/contracts JIT 전파·build env/output 계약은 유지한다.

공통 config 입력을 build(Next/Sentry·base/Next preset), Node/앱 타입, ESLint/Steiger·typed lint, browser/marker unit 소비로 구분한다. ESLint family 내부와 JIT source 전파는 보수적으로 유지한다. Tool 통합 검사는 C1의 항상 실행 위임을 유지한다.

캐시 harness는 19개 cacheable task에 대해 19가지 입력 변경의 hash 변화/보존과 필요한 affected 선택을 함께 검사한다. 필요 없는 task의 미선택까지 강제하지 않는다. TypeScript의 실제 소스·설정 프로그램이 읽는 공통 config source와 preset도 입력에 포함되는지 대조한다. Root internal hash는 매 dry run에서 빈 값이어야 한다.

전체 type-check·lint·FSD·harness 45/45·unit 99파일 700건·ops 21파일 283건·format가 성공했다. hash matrix는 cacheable 19 task·입력 19종이며, config build/transit의 실제 입력은 각각 package.json 한 개다. Tool의 uncached 검사와 Root 정책 검사는 항상 실행되며 이 표의 cacheable task 수에서 제외한다.

## 5단계 D — 실제 재실행·재사용과 build 산출물 복원

개인 env 없는 index tree `39bcf3ee2a9956263a207978b1d0341b519dce8a` 복사본에서 frozen offline 설치와 환경을 초기화한 실행을 수행했다. Node 22.16.0·pnpm 10.15.1·Linux ARM64이며 고유 cache directory와 --summarize JSON을 대조했다. 아래 시간은 동일 로컬 세션의 관찰값이며 다른 로컬 검증과 병행했다. Root·Tool 항상 실행 검사를 포함한 전체 verify 시간이나 변경 전 대비 성능 향상율을 뜻하지 않는다.

| 실제 실행 | miss / hit | Turbo 경과 |
| --- | --- | --- |
| type/lint/unit cold | 17 / 0 | 51.152초 |
| 같은 입력 warm | 0 / 17 | 0.036초 |
| browser setup만 변경 | 4 / 13 | 21.253초 |
| setup 원복 | 0 / 17 | 0.044초 |
| 양 앱 build cold, concurrency 1 | 2 / 0 | 46.031초 |
| 양 앱 .next 삭제 후 archive 복원 | 0 / 2 | 1.394초 |

browser setup 변경은 config 자체 type/lint와 Web·Console unit만 다시 실행했다. 나머지 13 task는 실제 cache hit였고 원복 후 17개 모두 hit였다. build cold는 두 작업 모두 실행했고, 양 앱 .next를 삭제한 뒤 재실행해 두 archive의 hit와 두 standalone server.js 복원을 확인했다. 이후 변경은 RESULT 기록뿐이다. 최종 push/CI는 PR에 기록한다.


### 5단계 C2/D 통합 증거

[PR #238](https://github.com/goldmayo/oioi-bwg/pull/238)의 [Verify #537](https://github.com/goldmayo/oioi-bwg/actions/runs/40123778721)와 push hook 전체 gate가 성공했다. 검증 head `47a409336ea30e4462781187cbb8558e6f79f03b`와 squash `e2e5a0fcb65462388d45f861eed9b754568ba3f1`의 tree가 동일하다.

## 6단계 A — pruned 설치·source 입력과 기존 CI 호환

기준은 `e2e5a0fcb65462388d45f861eed9b754568ba3f1`다. Root Turbo를 기존 잠금 버전 2.11.7로 exact pin하고 Docker pruner도 같은 버전을 사용한다. JSON/partial lock 설치와 full source 복사를 분리한다. 단독 target은 대상 앱·config/server/contracts만 포함한다. 일반 CI의 all은 두 앱을 함께 prune해 기존 same-builder 검증을 유지하며 앱별 CI 전환은 후속 B가 소유한다. runtime/secret/standalone·Promotion digest/pair 계약은 유지한다.

YAML을 직접 사용하는 prune 회귀는 Tool이 기존 잠금 버전 2.8.2를 직접 선언해 실행한다. Root Turbo specifier와 Tool importer만 변경하고 기존 package/snapshot·나머지 importer 해석을 보존했다. frozen offline 설치와 전체 type-check·lint·FSD·harness 46/46·unit 99파일 700건·ops 21파일 283건·format가 성공했다.

prune 회귀는 양 앱 각각에 대해 무관한 앱 source와 Relay의 manifest/lock entry를 바꿔도 JSON/partial lock/full source fingerprint가 같음을 확인한다. 대상 앱/공용 server source 변경은 full source만 바꾸고, 대상 앱의 의존성·lock 변경은 설치 입력을 바꾼다. fixture의 가상 package는 설치하거나 네트워크에서 조회하지 않는다.

개인 env 없는 index tree `b4fcbd14bbe5f642039902f6c5bf828605e6805a`를 추출해 실제 Docker와 같은 JSON 설치 → full source 복사 순서로 검증했다. 각 target에 상대 앱·Tool이 없는 상태에서 frozen offline 설치와 단독 build가 성공했고 해당 standalone server.js가 생성됐다.

| target | workspace importer(Root 제외) | virtual store 디렉터리 | 설치 / build 관찰 시간 |
| --- | --- | --- | --- |
| web | 앱 1 + config/server/contracts = 4 | 1342 | 11.003초 / 17.945초 |
| console | 앱 1 + config/server/contracts = 4 | 1365 | 4.482초 / 23.551초 |

비교용 전체 C2 설치의 virtual store는 1367디렉터리였다. 공통 core/config와 Root 외부 CLI를 유지하므로 설치량이 크게 줄었다고 일반화하지 않는다. 목적은 대상 밖 변경이 설치/build 입력에 섞이지 않게 하는 것이다. 시간은 다른 로컬 검증과 병행한 ARM64 관찰값이다. Docker context 자체는 Root를 유지하며 pruner 뒤의 입력을 줄인다. 로컬 Docker 실행은 사용할 수 없어 실제 이미지·native/readiness/browser/pair 검증은 PR CI로 확인한다. 이후 변경은 RESULT 기록뿐이다.
