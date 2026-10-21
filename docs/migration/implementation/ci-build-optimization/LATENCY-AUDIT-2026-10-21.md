---
title: "CI 지연 실측과 배포 입력 검증 병목 수정"
kind: migration-evidence
status: active
source_commit: f101af46e606ebd48af0a20b5ef89cad0a0bfaa2
implementation_commit: f33492b7a28632cae726a797ca5d7b8b56e6fb37
observed_at: "2026-10-21"
---

# CI 지연 실측과 배포 입력 검증 병목 수정

기존 [빌드 재사용 결과](RESULT.md)의 2026-10-10 측정은 당시 사실로 유지한다.
이번 조사는 로그인 UX PR #177을 포함한 최근 실행과 위 source의 workflow·hook·테스트를 대조했다.
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)과
[배포 runbook §21](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)을 따른다.
이 문서의 후속 개선 후보는 현재 검증 정책을 변경하는 승인이 아니다.

## 실제 소요 시간

아래 전체 시간은 run 생성부터 완료 상태 갱신까지다. 병렬 job 시간을 합산하지 않는다.

| 실행 | 전체 시간 | 주요 직렬 구간 |
| --- | --- | --- |
| [#173 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/39541325093) | 8분 3초 | app build 245초 → 관리자 통합 222초 |
| [#174 파일 변경 없는 이력 연결](https://github.com/goldmayo/oioi-bwg/actions/runs/39542556758) | 8분 58초 | app build 269초 → 관리자 통합 248초 |
| [#175 Promotion Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/39543479896) | 15분 30초 | app build 255초 → 관리자 통합 233초 → verify → ARM64 후보 413초 |
| [#175 실제 배포](https://github.com/goldmayo/oioi-bwg/actions/runs/39545543065) | 4분 25초 | Run Command 인증 31초·배포 210초 |
| [#177 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/39550228103) | 첫 실행 8분 45초 실패, 재실행 구간 4분 15초 | 기존 배포 fixture 180초 초과. unit과 후속 gate만 재실행하여 성공 |

#174 → #175 검증 → 실제 배포만 합쳐도 약 28분 53초다. 사람의 리뷰·승인 대기와 앞선 기능 PR 검증은 포함하지 않는다.
#167의 run 39533783736은 attempt 2가 있으므로 최초 생성과 마지막 시작 시각 차이를 runner 대기 시간으로 해석하지 않는다.

## 확인한 원인

### 배포 입력 정규식과 반복 실행

`deploy-release.sh`와 `deploy-via-run-command.sh`는 Bash에서
`^[A-Za-z0-9_-]{1,16000}$`를 매 실행 평가했다. 로컬 Bash 추적에서 이 한 줄에 3.2~4.6초가 걸렸다.
가짜 배포의 `test_no_changes` 한 건은 9.2초였지만, 두 번 실행된 Python 배포 로직의
프로파일 시간은 각각 0.35·0.44초였다. 두 배포 진입점의 큰 반복 범위 검사가 주요 병목이다.

[이전 #167의 첫 실행](https://github.com/goldmayo/oioi-bwg/actions/runs/39533783736/attempts/1)과
[#177 첫 실행](https://github.com/goldmayo/oioi-bwg/actions/runs/39550228103/attempts/1)이
같은 Python fixture의 180초 제한으로 실패했다. #177 재실행은 fixture 154.8초,
OCI 전송 테스트 45.4초, 전체 ops 162.2초로 통과했다. 업무 단위 테스트 실패와 구분한다.

로컬에서도 `pnpm verify` 뒤 pre-push가 root 검증과 ops를 다시 실행한다.
이번 수정 전 ops 실측은 verify 158.49초, push hook 155.47초였다.
package 단위 Turbo cache와 달리 root ops/harness에는 검증 결과 재사용이 없다.

### 서로 다른 PR에서 빌드 캐시 미스

#173·#174·#175의 검증용 cache key는 같은 `Linux-verify-amd64-v2-0109ae…`였다.
세 app build 로그 모두 `Cache not found`이며 cache API에는 각각
`refs/pull/173/merge`, `refs/pull/174/merge`, `refs/pull/175/merge`에 약 1.30GB가 저장돼 있었다.

[GitHub cache 규칙](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)상
PR merge ref의 캐시는 다른 PR이나 base branch가 복원할 수 없다.
현재 push trigger는 main/develop뿐이고, 실제 통합 기준인 migration_main에는 캐시 생성 실행이 없다.
같은 PR 재실행 최적화만으로 새 PR의 빌드 비용은 해결되지 않는다.
Docker `COPY . .`에는 테스트·운영 스크립트도 들어가며 일반 검증 builder는 두 앱을 빌드한다.

### 빌드 이후 관리자 통합과 실제 OTP 시간 대기

관리자 job은 app_build 종료 후 시작한다. #175에서 233초 중 실제 관리자 시나리오가 156초였다.
`console-mfa-smoke.mjs`의 `nextConsoleOtp`와 `console-enrollment-smoke.mjs`의 `nextOtp`는
같은 테스트 계정의 사용된 time step 때문에 실제 30초 구간이 진행될 때까지 기다린다.
로그에서 등록 검증 구간은 약 56초, 관리 편집 이후 세션·권한 경계 구간은 약 76초였다.
각 구간에는 다른 검증도 포함되므로 이 시간을 전부 OTP 대기로 단정하지 않는다.
이는 자동화 fixture 재사용의 비용이며, 실제 사용자가 새 코드가 뜨자마자 로그인해야 한다는 뜻이 아니다.

### 배포 후보의 불필요한 빌더 삭제

#175 후보의 Web ARM64 빌드는 149초, Console은 44초였다.
검증과 후보 기록 후 `docker buildx rm`에 추가 83초가 걸렸다.
일반 app_build는 이미 `cleanup: false`지만 promotion-candidate에는 없다.
[Buildx action](https://github.com/docker/setup-buildx-action#inputs)은 cleanup을 기본 활성화한다.
GitHub-hosted 일회성 VM의 해당 정리 비용은 별도 개선할 수 있다.

### 작은 중복과 변경 범위

Terraform 검증은 infra와 PostgreSQL job 양쪽에서 실행된다. #175 기준 각각 약 8초다.
앱 `lint`는 FSD를 포함하지만 quality에서 FSD를 한 번 더 실행한다.
이 중복은 낭비지만, 병렬인 quality/DB job만 줄여서는 app_build → 관리자 통합의 완료 시간이 크게 줄지 않는다.
일반 PR 분류는 Markdown-only 여부만 구분하므로 작은 코드 수정·빈 diff 이력 연결도 전체 검증이다.
Promotion의 full verify와 source/merge tree·digest 검증은 현재 runbook의 명시적 계약이다.

## 이번 수정 범위와 검증

두 Bash 진입점에서 길이를 먼저 확인하고 `^[A-Za-z0-9_-]+$`로 문자를 확인한다.
1~16,000자의 base64url 문자 제한, 후보 JSON/동일 digest 검증, 실패 코드와 실제 배포 절차는 유지한다.
Python의 별도 검증은 그대로 둔다. 배포 테스트 timeout을 늘리지 않는다.

두 실제 진입점에 빈 값·1자·허용 문자·16,000자·16,001자·padding·공백·개행·쉘 구두점·비 ASCII 입력
20건을 추가했다. 성공 문자열은 다음 guard에서 멈추므로 실제 OCI나 호스트 설정을 사용하지 않는다.
기존 paired host/OCI transport 회귀와 합친 45건은 9.46초에 통과했다.

Bash 검사 단독 실측: 기존 1,300자 입력 3,898ms → 변경 후 1.23ms.
기존 16,000자 측정은 15초 제한으로 종료했으며, 변경 후에는 1.98ms에 허용됐다.
새 검사에서 빈 값·길이 초과·개행·padding 거부도 확인했다. 수치는 이 로컬 환경의 표본이다.

`pnpm verify`가 통과했다. root 타입·ESLint, 구조 harness 18건, ops 231건, format을 실행했다.
package 타입·린트·단위 487건에 대응하는 Turbo 12 task와 두 앱 build는 동일 입력의 로컬 cache를 재사용했다.
전체 ops는 22.30초로 수정 전 158.49초보다 약 86% 줄었다. 새 테스트 20건도 포함한다.
`bash -n` 두 스크립트와 `git diff --check`도 통과했다.
GitHub의 수정 후 실측과 자동 push hook 결과는 해당 PR에서 이어서 기록한다.
VM에 설치된 운영 스크립트는 이 로컬 변경만으로 갱신되지 않는다.

## 사용자 결정 — 관리자 전체 E2E 자동 실행 제외

2026-10-21 사용자의 명시적 요청으로 `Admin migration integration` job을 Verify workflow에서 제거하고
required gate의 needs·검증 목록도 함께 갱신했다. 일반 PR·기존 push·Promotion 모두 자동 실행하지 않는다.
테스트 코드와 `pnpm test:integration:admin:local` 명령은 필요 시 직접 실행할 수 있도록 남겼다.
Testing §12.1 및 배포 runbook §21을 같은 변경에서 갱신했다.
컨테이너 시작·native/readiness·간단한 화면 smoke와 Promotion의 exact digest 검증은 기존대로다.

#175 실측에서는 app_build 뒤 관리자 job 233초와 build smoke 188초가 병렬이었다.
따라서 관리자 job 제거만으로 전체 시간이 233초 줄어드는 것이 아니라 이 표본 기준 약 45초가 줄어드는 구조다.
브라우저 job 자체의 실행 비용·OTP 대기·해당 job의 실패 후 재실행 비용은 제거된다.
수정 후 실제 CI 전체 시간은 새 실행 결과로 확인한다.

## 중복 검사와 일회성 builder 정리

같은 변경에서 PostgreSQL job의 중복 Terraform setup/validate를 제거했다. infra의 동일 검증은 남는다.
quality의 별도 FSD step도 제거했다. 두 앱의 `lint` 스크립트가 이미 `lint:fsd`를 수행한다.
GitHub-hosted ARM64 후보 job에 일반 app_build와 같은 `cleanup: false`를 적용했다.
컨테이너 smoke 정리와 registry logout은 유지하고, job 종료 시 무거운 builder 삭제를 생략한다.
기존 #175의 83초는 수정 전 관찰값이며, 수정 후 절감 시간은 다음 Promotion에서 측정한다.

Workflow YAML 파싱 후 남은 필수 6 job과 gate needs가 일치함을 확인했다.
관리자 E2E 없이 통과하되 app_build 증거 누락은 거절하는 gate 회귀를 포함해 13건이 통과했다.
Terraform 검증이 한 군데 남고 FSD가 두 앱 lint에 포함되는 것도 실제 설정으로 확인했다.

## 후속 개선 순서

1. 이번 정규식 수정으로 ops 지연과 반복 timeout을 제거한다. 전체 CI의 최장 경로는 별도로 측정한다.
2. 검증을 통과한 통합 기준의 캐시를 새 PR에서 읽을 수 있도록 캐시 발행 경로를 설계한다.
   migration_main push에서 무거운 검증·빌드를 반복하지 않는 기존 계약을 고려하고,
   검증된 입력·산출물 근거를 확인하는 방식과 필요 시 runbook 개정을 별도 PR에서 다룬다.
3. 관리자 E2E는 자동 CI에서 제외됐다. 시나리오별 계정 격리는 수동 E2E가 필요할 때 검토할 별도 항목이다.
4. 일회성 ARM64 runner 정리와 중복 Terraform/FSD 제거는 이번에 적용했다. 실제 CI·Promotion 시간을 후속 측정한다.
5. squash Promotion의 이력 연결 반복을 줄이는 merge 전략은 repository 보호 설정·runbook과 함께 별도 검토한다.
   파일 변경 없는 PR의 전체 검증을 현재 규칙 아래에서 임의로 생략하지 않는다.

이 항목들의 단축 효과를 합산해 목표 시간으로 제시하지 않는다. 각 변경 후 최장 직렬 경로와
cold cache·다른 PR·동일 PR 재실행을 구분해 측정해야 한다.

## 통합 브랜치 캐시 발행 구현

후속 기준은 #178의 squash `b9044601a934ba61dd31f1437f1bad517ceb3168`이다.
[#178 실제 CI](https://github.com/goldmayo/oioi-bwg/actions/runs/39553267013)는 8분 7초에 통과했다.
ops step은 24초, app build는 246초였다. 관리자 전체 E2E job은 생성되지 않았다.
ops 개선만으로 전체 CI의 빌드·컨테이너 검증 병목이 해결된 것은 아니다.

[계획의 2026-10-21 보완](PLAN.md)에 따라 캐시 전송 artifact와 별도 push 발행 workflow를 추가했다.
성공한 같은 저장소 PR의 source/tree와 입력 key를 확인하고, migration_main 또는 migration_develop
ref에서 actions/cache에 저장한다. 검증 job이나 앱 build를 병합 후 다시 실행하지 않는다.
기존 검증 image/standalone은 같은 run 안에서만 전달한다. cache 자료의 보관은 1일이며
병합이 늦어 만료됐으면 발행을 생략하고 다음 PR에서 직접 빌드한다.

로컬 회귀 26건은 정상 발행 두 경로와 다른 source/tree/저장소/trigger, 실패·미완료 실행,
문서 전용 skipped build, 다른 입력 key, 누락·중복·만료 artifact 거절을 통과했다.
`pnpm verify`도 통과했다. root 타입·lint·harness 18건·ops 258건·format을 실행했고,
앱/package 12 task와 두 앱 build는 동일 입력의 기존 Turbo cache를 재사용했다.
두 workflow YAML 파싱과 `git diff --check`를 확인했다.
base cache 생성과 별개 PR의 실제 적중·시간 측정은 아래 후속 실측에서 확인했다.
ARM64 후보의 별도 GHA cache는 이번 amd64 발행 경로의 검증 대상이 아니다.

## PR 간 캐시 재사용 검증 및 공식 근거

구현 `efb5a762fe5440f0910808a99b86136ec2367464`는 [#179](https://github.com/goldmayo/oioi-bwg/pull/179)에서
`639e6d7fd66ab48ee46806f472b07c4dcb8f78a2`로 squash 병합됐다.
검증 대상은 cache key `Linux-verify-amd64-v2-2aee60bdbec7ce2dbbbeeb844f0d74e7a0cc644b90e32256558ee7e46ea8bf83`다.

- [#179 Verify 39555786963](https://github.com/goldmayo/oioi-bwg/actions/runs/39555786963):
  캐시 없음, 전체483초 성공. app build257초 중 build/export209초, 공유 artifact 업로드7초.
- [Publish 39556873505](https://github.com/goldmayo/oioi-bwg/actions/runs/39556873505):
  전체74초 성공. artifact 다운로드58초, cache save5초. cache id9260156050,
  `refs/heads/migration_main`, 1,298,396,369바이트 저장을 API로 확인했다. build/test 재실행은 없다.
- 다른 [#180 Verify 39557334782](https://github.com/goldmayo/oioi-bwg/actions/runs/39557334782),
  head `d669a443ee85567fec8da719ea501f067bc766a9`: 위 key 복원 성공9초, app build75초,
  첫 build/export8초. 첫 target에서 의존성 설치·앱 build·archive가 CACHED이며
  cache 재export/save는 skipped다. 같은 PR 재실행 결과가 아니다.

app build는257→75초, 약71% 단축됐다. 같은 빌드 입력의 두 표본이며 새 소스 변경까지
같은 단축률을 보장하지 않는다. 새 입력에서는 fallback cache와 BuildKit의 내용 검사를 사용한다.
전체 CI도 #179의483초(8분3초)에서 #180의309초(5분9초)로 약36% 줄었고 전부 성공했다.
#180의 후속 container build job은214초다. 발행 workflow74초는 위 Verify 시간과 별도이며
병합 후 비동기로 실행된다. 다음 PR이 같은 key를 읽은 사례의 전체 시간과 구분해서 기록한다.

판단 근거는 다음 공식 문서와 실제 설정·실행 기록이다.

- [GitHub cache 접근 제한](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache):
  다른 PR의 merge ref 캐시는 읽을 수 없고 base branch의 cache는 읽을 수 있다.
  이번 push 발행은 이 범위를 따른다. 보호 설정이나 cache-mode 우회는 추가하지 않았다.
- [Docker cache mode](https://docs.docker.com/build/cache/backends/#cache-mode): max는 중간 단계까지 저장하고
  min은 최종 결과에 포함된 레이어만 저장한다. 문서가 제시하는 전송 비용·적중률 실측 기준을 따른다.
  이번 수정에서 mode를 바꾸지 않았다.
- [Docker local cache](https://docs.docker.com/build/ci/github-actions/cache/#local-cache): 과거 blob 누적을 방지해야 한다.
  현재 workflow는 새 디렉터리에 export한 뒤 교체하므로 이전 export를 계속 덧붙이는 구조는 아니다.
- [Next.js CI caching](https://nextjs.org/docs/app/guides/ci-build-caching): `.next/cache`의 build 간 보존을 안내한다.
  현재 Docker layer의 동일 입력 재사용과 소스 변경 후 Next 증분 캐시 재사용은 별개다.
  [standalone 출력](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)은 추적된 실행 파일을
  복사한 배포 산출물이므로 빌드 중간 데이터와 역할을 구분한다.

## 캐시 용량 실측

#179의 cache artifact12326230222 ZIP 중앙 디렉터리·OCI manifest와 큰 레이어의 제한된 tar 표본을 읽었다.
전체 파일36개의 합계는1,308,780,015바이트이며 ZIP artifact는1,308,788,491바이트다.
이 첫 표본 조사는 전체1.31GB를 다운로드하거나 실행하지 않았다. 아래 MB는10진수이고 압축된 blob 크기다.

| 구성 | 크기 | 확인 근거 |
| --- | --- | --- |
| 두 앱 빌드 RUN 레이어 | 804.17MB | digest62d4539d…; 표본의 app/apps/console/.next 및 Dockerfile build RUN |
| 의존성 설치 레이어 | 264.42MB | digest3ad6c21c…; 표본의 app/apps/*/node_modules 및 install RUN |
| standalone 압축본을 담은 두 레이어 | 105.17MB | digestd0b0c9fd…·34baf91e…; /tmp/standalone.tar.gz와 scratch의 standalone.tar.gz, 각 파일52,585,094바이트 |
| Node·OS·runtime 등 나머지 | 135.02MB | 전체 파일 합계에서 위 레이어 제외 |

이 첫 표본 조사만으로는 레이어 내부 전체 파일별 합계를 알 수 없어804MB 전체를 `.next/cache`로 단정하지 않았다.
확인된 중복 archive는 용량 축소 검토 대상이다. 삭제 시에는 실제 consumer와 Docker cache graph를 함께
검증해야 하며 이번 PR 간 캐시 발행 수정에 추측으로 포함하지 않았다. ARM64 후보 cache와 Next 증분
캐시 분리·용량 축소는 이 결과가 완료했다고 주장하는 범위에 포함되지 않는다.


## 캐시 용량 전수 분석 — 2026-10-21 후속 실측

같은 artifact의 빌드·의존성 레이어 두 개, 합계1,068,590,584바이트를 HTTP Range로 끝까지
스트리밍하여 zstd 해제 후 tar 파일 헤더를 집계했다. 두 압축 blob의 SHA-256과 전송 바이트 수가
OCI digest·크기와 일치했다. 파일을 추출하거나 실행하지 않았으며 압축본 전체를 디스크에 저장하지 않았다.
빌드 레이어7,436개, 의존성 레이어192,151개 entry를 확인했다. 아래는 일반 파일의 크기 합계이며
디렉터리·symlink는 제외한다. 압축 전 파일 크기와 앞 표의 압축 blob 크기를 합산하지 않는다.

분석 대상 코드/tree는 #179/#180의 `9dc714d6287cae97590a9f4a4d209ad1633a350d`다.
재현 스크립트와 전체 파일 목록은 작업 worktree의 `.local/ci-base-cache/analyze-layers.py`,
`<digest>-files.json`, `layer-analysis.json`에 보존했다. 인증 토큰·서명 URL은 기록하지 않았다.

### 804.17MB 빌드 레이어의 실제 내용

| 구성 | 압축 전 크기 | 판단 |
| --- | --- | --- |
| Web `.next/cache` | 533.75MB | Turbopack 파일시스템 캐시 |
| Console `.next/cache` | 172.29MB | Turbopack 파일시스템 캐시 |
| 두 앱 `.next/server` | 219.18MB | 서버 빌드 출력 및 source map |
| 두 앱 `.next/standalone` | 178.41MB | 실행용 파일·추적 의존성 복사본 |
| Turbo 로컬 cache | 89.70MB | `.tar.zst` 두 개87.23MB와 JSON2.46MB |
| static·build·manifest 등 나머지 | 7.87MB | 실제 빌드 출력 등 |
| 합계 | 1,201.19MB | 압축 후804.17MB인 한 레이어 |

`.next/cache` 합계706.03MB는 빌드 레이어 일반 파일의58.78%다. 원인은 다음과 같이 확인했다.

- 설치된 Next16.4.1의 `config-shared.js`에서 `turbopackFileSystemCacheForBuild: true`를 확인했다.
  앱 config는 이를 재정의하지 않는다. [Next 공식 문서](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache)는
  16.3.0부터 build 기본 활성화이며 컨테이너에서 다음 빌드에 보존하지 않으면 비활성화하도록 안내한다.
- 현재 Dockerfile은 dependencies → source COPY → build RUN이다. `.dockerignore`가 host의
  `.next`와 `node_modules`를 제외하고 Next/Turbo cache mount·별도 복원도 없다.
  따라서 동일 입력이면 BuildKit이 RUN 전체를 건너뛰고, 소스가 바뀌면 이전 RUN 출력의
  `.next/cache`나 Turbo cache를 새 RUN의 입력으로 넘기지 않는다. 이 경로 판단은 코드와
  [Next CI cache 요구사항](https://nextjs.org/docs/app/guides/ci-build-caching)을 대조한 결과다.
- `turbo.json`의 `.next/cache` 제외는 **Turbo archive의 outputs 범위만** 줄인다.
  Docker `mode=max`가 저장하는 build RUN 파일시스템에서는 해당 폴더가 제외되지 않는다.
  [Turbo 캐시 문서](https://turborepo.com/docs/crafting-your-repository/caching)의 output 저장 동작과 일치한다.
- Turbo archive87.23MB는 이미 생성된 `.next` 출력을 다시 압축해 같은 RUN 안에 보관한 것이다.
  현재 Docker 경로에는 다음 변경 빌드가 이 cache를 복원하는 단계가 없다. 로컬 개발의 Turbo cache는
  별개로 유효하므로 전역 `turbo.json`에서 caching을 끄는 처방은 적절하지 않다.

### 264.42MB 의존성 레이어

압축 전 일반 파일 합계는1,313.47MB다. 상위 항목은 Next192.51MB, SWC gnu100.92MB와
musl98.44MB, Turbo41.10MB, lucide-react36.63MB, TypeScript23.63MB다.
Rolldown gnu/musl 합계46.05MB와 libvips gnu/musl 합계37.63MB도 함께 설치돼 있다.
현재 builder는 Debian glibc지만 lockfile·optional dependency 동작과 앱의 native smoke를
확인하기 전에 musl 패키지를 임의 삭제하지 않는다. 이들은 캐시 압축 후 크기와도 다르다.

의존성 레이어는 manifest/lockfile이 같으면 source 변경에도 재사용할 수 있어 보존 가치가 있다.
개발 도구·타입·빌드 도구가 필요한 builder에서 무조건 production install로 바꾸는 것도 맞지 않는다.
standalone에 두 앱 각각 gnu/musl libvips가 들어간 사실은 추가 추적 최적화 후보이며,
현재 런타임 의존성을 안전하게 제거할 수 있다는 결론은 아니다.

### 105.17MB 중복 standalone archive

`verification-archive`의 `/tmp/standalone.tar.gz`와 scratch 출력의 `/standalone.tar.gz`가
각52,585,094바이트 파일을 담는다. max export에 서로 다른 두 레이어가 들어간다.
현재 build job은 이 artifact를 다운로드·해제하지만 이후 실행은 전달받은 두 Docker image와
HTTP URL을 사용한다. native/readiness/Web·Console 화면 smoke 및 paired Compose 스크립트의
실제 호출 경로를 확인했다. 전체 관리자 E2E 제거 뒤 남은 전달 경로다.

로컬 `console-https-smoke`·`console-auth-ingress-smoke`는 standalone을 사용하므로
Next의 standalone 생성 자체를 제거해서는 안 된다. 후속 변경은 CI archive 전달과 Docker
검증 target에 한정하고 동일 builder에서 만든 두 image의 검증 계약을 보존해야 한다.

### 개선 우선순위와 검증 기준

1. **Docker build에서 소비하지 않는 Next·Turbo 내부 cache부터 줄인다.** Next 파일시스템 cache를
   Docker build에 한정해 비활성화하거나 별도 mount로 레이어 밖에 두는 안을 비교한다.
   Turbo도 Docker 호출에 한정한 cache write 제어를 검토한다.
   [공식 `--cache` 옵션](https://turborepo.com/docs/reference/run#--cache-options)을 사용하고 로컬 cache는 유지한다.
   이후에 별도 증분 캐시 복원을 도입한다면 저장·전송 비용을 포함해 다시 측정한다.
2. **불필요한 CI standalone archive 전달을 제거한다.** 위105.17MB 두 blob과 별도 artifact
   업로드·다운로드·해제 비용이 대상이다. 두 image 생성·검증은 유지한다.
3. **의존성·native 중복은 별도 범위로 검토한다.** 크기만 보고 삭제하거나 lockfile을 정리하지 않는다.
   현재 최대 낭비는 다시 읽지 않는 build 내부 cache이며 dependency layer는 실제 재사용된다.

`mode=max`를 무조건 `min`으로 바꾸는 안은 우선하지 않는다. 현재 최종 target은 archive 한 개를
담은 scratch여서 min으로 바꾸면 유용한 install/build 중간 캐시까지 잃을 수 있다.
[Docker 공식 문서](https://docs.docker.com/build/cache/backends/#cache-mode)도 용량과 적중률을 함께 실측하도록 안내한다.
또한 현재 cache 디렉터리는 매 export마다 새 폴더로 교체하므로 오래된 blob의 무한 누적이 이번1.31GB의 원인은 아니다.

이 분석 변경에서는 빌드 설정을 수정하지 않았다. **706.03MB+89.70MB는 압축 전 수치이며
그만큼 다운로드가 줄어든다고 주장하지 않는다.** 제거 후 실제 압축 cache 크기와 cold build,
동일 입력 restore, source 변경 build, 후속 image smoke 전체 시간을 비교해야 절감량을 확정할 수 있다.
ARM64 후보의 GHA 캐시는 별도 경로이므로 이 amd64 표본을 그대로 적용하지 않는다.

## 캐시 용량 축소 구현과 실제 재사용 — 2026-10-21

[계획](PLAN.md#캐시-용량-축소--2026-10-21)에 따른 구현은
[#183](https://github.com/goldmayo/oioi-bwg/pull/183)의 `22e6b4d4c0f82ce1e52f99cccd53f5a56207f294`이며,
통합 커밋은 `97ea968fb9e519f1178dd75af0184d440a0cf855`다. Docker builder에서만 Next의 Turbopack 파일시스템 build cache와
Turbo output archive 쓰기를 끄고, 두 runtime을 참조하는 cacheonly target으로 standalone tar 중복을 제거했다.
로컬 cache·Next standalone 출력·의존성/앱 BuildKit 레이어와 두 image smoke는 유지했다.

| 저장 항목 | 변경 전 | 변경 후 | 확인 위치 |
| --- | --- | --- | --- |
| Actions Cache | 1,298,396,369바이트 | 480,296,068바이트 | cache id9260156050 → 9261804114 |
| base 발행용 artifact ZIP | 1,308,788,491바이트 | 481,693,867바이트 | artifact12326230222 → 12329015256 |
| OCI build 레이어 | 804,172,528바이트 | 82,073,723바이트 | 새 digest095ef091ca2ed04e2d6cfc0ccb7239a0954fee9fe7c44b9f2dc3515f54fddcdb |

Actions Cache·artifact 모두 약63% 감소했다. MB는10진수다. UI가480,296,068바이트를 약458MiB로
표시할 수 있다. [Actions / Caches](https://github.com/goldmayo/oioi-bwg/actions/caches)의
`refs/pull/183/merge`·key `Linux-verify-amd64-v2-8dac91326c30bd9131e4f48cac080b30c925617899f5593c4f129ca0c513f480`가
실제 cache 항목이다. [실행 artifact](https://github.com/goldmayo/oioi-bwg/actions/runs/39561253202/artifacts/12329015256)는
병합 후 base cache로 전달하는 별도 사본이다. 최초 artifact12328031644는 같은 입력 재실행의 overwrite로 교체됐고
두 ZIP 크기는 같다. 저장소 전체 cache 사용량과 단일 항목 크기를 혼동하지 않는다.

새 build 레이어82,073,723바이트를 끝까지 스트리밍하여 전송 크기·SHA-256·tar7,328개 entry를 대조했다.
일반 파일416,359,545바이트 중 server219.18MB·standalone178.41MB는 유지됐다. Turbopack 파일시스템
cache와 Turbo archive는 없어졌지만 `.next/cache`에는 tsbuildinfo 등10.91MB가 남는다.
의존성 레이어264,418,056바이트는 동일 digest3ad6c21c…로 보존됐다. 분석 자료는 ignored
`.local/ci-cache-size/`의 cache-size/layer-analysis 및 전체 파일 목록에 있고 비밀값을 포함하지 않는다.

- `OIOI_EPHEMERAL_BUILD=true pnpm verify`와 push hook 통과: type/lint/FSD·unit487·harness18·ops258·format,
  두 앱 실제 build. config ESM 읽기로 로컬true/Dockerfalse를 대조했다. YAML·diff 검사도 성공했다.
- [Verify39561253202 첫 실행](https://github.com/goldmayo/oioi-bwg/actions/runs/39561253202/attempts/1) 전체 성공.
  app build204초 중 첫 target154초, 후속 image build smoke199초. 이전 key fallback에서 의존성을 재사용하고
  새 builder 정책으로 앱을 빌드했다. 관리자 전체 E2E는 실행하지 않았다.
- [동일 입력 attempt2](https://github.com/goldmayo/oioi-bwg/actions/runs/39561253202/attempts/2)의
  app build74초, cache 복원6초, 첫 target4초. 첫 target과 두 image load의 install/build/runtime CACHED를
  확인했고 cache 재export/save는 skipped다. 재실행은 app build와 종속 job에 한정했다.
  기존에 성공한 unit/quality/PostgreSQL/infra를 다시 실행하지 않았다. 후속 build smoke와 최종 verify도 성공했다.

병합 후 [Publish39563382114](https://github.com/goldmayo/oioi-bwg/actions/runs/39563382114)의
선택·다운로드·save가 모두 성공했고 main ref의 새 cache9262444221, 480,308,753바이트를 API로 확인했다.
새 PR이 공유할 작은 base cache가 실제 생성됐다. Actions 압축 패키징 차이로 PR cache와12,685바이트 차이가 난다.

기존1.3GB 항목은 삭제하지 않았다. 2026-10-21 조회에서 전체 cache는25개·5,933,493,281바이트였고
main/develop/이전 PR에 큰 항목이 함께 있었다. [GitHub 공식 보존 정책](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#usage-limits-and-eviction-policy)은
마지막 접근 후7일 초과 미사용 시 삭제하며, 새 key가 기존 항목을 덮어쓰지 않는다. 새 base 발행/다음 사용이 먼저이며
기존 항목 전체 삭제나 저장 용량 상향은 하지 않는다. ARM64 GHA cache의 별도 접근 범위 개선은 이번 결과에 포함하지 않는다.

## 미사용 workflow 식별과 폐기 — 2026-10-21

검토 기준은 `97ea968fb9e519f1178dd75af0184d440a0cf855`다. GitHub workflow API·최근 run·현재 YAML·코드 참조와
[P06 로드맵](../console-guide-editor/ROADMAP.md), [B0 통과 결과](../console-guide-editor/P06-B0-2-RESULT.md)를 함께 대조했다.
오래 실행되지 않았다는 이유만으로 사용 중인 배포 경로를 제거하지 않았다.

| 대상 | 식별 근거 | 조치 |
| --- | --- | --- |
| Development Image353263607 | 2026-09-08 run34245521768 cancelled, 현재 통합선 파일 없음, 정상 Promotion으로 대체 | GitHub disabled_manually |
| P02 Bootstrap Validation375623717 | 2026-10-05 run37386630281 성공, 현재 파일 없음, 상시 검증은 Verify 소유 | GitHub disabled_manually |
| P06 B0 command probe384570847 | run38601706992 성공으로 실제 권한 실증 완료, 현 배포 consumer 없음 | workflow 파일 제거·GitHub disabled_manually |
| Verify의 B0 publish probe | `if: false`인 일회성 marker 게시 job, 필수 gate가 의존하지 않음 | job 제거 |
| Verify / Deploy promotion / Publish build cache | 일반 검증·현 배포·새 캐시 공유에 사용 | 유지 |
| Cloudflare Production / Staging | default main의 tag/staging push 배포, P06-F의 기존 Worker 종료 전 | 유지 |

세 GitHub 비활성화 상태를2026-10-21T07:33:40Z에 API로 다시 확인했다. 과거 run을 삭제하지 않아 UI에
이력이 남을 수 있다. 운영 README의 B0 절차는 폐기된 과거 기록으로 표시하고 helper·테스트·IAM·secret은 유지한다.
상시 job 삭제로 절감되는 시간이라고 주장하지 않는다. 기존 B0 게시 job은 이미 skipped였다.
