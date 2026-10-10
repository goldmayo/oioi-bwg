---
title: "CI 공통 빌드 재사용 및 Docker 캐시 결과"
kind: migration-result
status: active
source_commit: 394ea7e65c0690fc8f8a12638014768a9a262c12
verified_source_commit: 394ea7e65c0690fc8f8a12638014768a9a262c12
verified_at: "2026-10-10"
---

# CI 빌드 최적화 결과

[계획](PLAN.md)에 따라 `migration_main`의 `770dc66`에서 작업했다.
[PR #119](https://github.com/goldmayo/oioi-bwg/pull/119)는 CI 빌드 재사용 한 관심사만 다룬다.
앱 기능·P05/TOTP·배포 candidate/ARM64/Sentry secret·배포 digest 흐름은 변경하지 않았다.

app_build가 두 앱을 한 번 빌드하고 Web image 및 두 standalone/static archive를 만든다.
archive와 runtime을 함께 cache graph에 포함하고 entrypoint를 cmp로 대조한다.
두 consumer는 동일 run artifact를 받아 병렬 검증하며 verify는 producer까지 성공해야 통과한다.
production runner는 마지막 alias로 유지하고 기존 USER/CMD/env/healthcheck를 보존했다.

최종 cache는 local mode=max/zstd export와 actions/cache 일괄 전송이다.
key는 docs를 제외한 전체 tracked index(mode/blob/path)의 digest이며 workflow와 빌드 설정도 포함한다.
exact hit에서는 재export/교체/save를 생략하고 두 target이 기존 cache를 import한다.
fallback/미스에서는 새 cache를 export하고 runner도 그 cache를 import한 뒤 교체·저장한다.
COPY context에서 docs/.github/빌드 recipe 및 로컬 생성물을 제외했다. recipe는 BuildKit이 직접 해석한다.

사용자 환경 파일이 없는 worktree에서 `pnpm verify`와 `pnpm lint:fsd`를 실행해 통과했다.
단위 406건, 구조 harness 18건, ops 51건과 type/lint/format 및 두 앱 build를 확인했다.
최종 Dockerfile의 로컬 linux/arm64 export와 runner load가 통과했으며 두 번째 target의 build는 CACHED였다.
tar의 5,336개 entry에 두 앱 server/static과 symlink 290개가 있다. Web 컨테이너 /healthz는 200이었다.
기존/최종 runtime config의 User/Cmd/WorkingDir/Healthcheck/Env/ExposedPorts도 같았다.
actionlint 1.7.12(shellcheck 비활성), diff check와 매 code push의 자동 hook(root type/lint/harness/ops/format)이 통과했다.

최종 code source의 [CI](https://github.com/goldmayo/oioi-bwg/actions/runs/37981257013)가 전체 통과했다.
quality/unit/infra/PostgreSQL/app build/build/Admin migration integration/verify 8개 job을 확인했다.
격리 PostgreSQL 17·실제 Auth/API·Playwright의 기존 관리자 흐름은 줄이지 않았다. 외부 YouTube만 fixture다.
문서 커밋의 exact-hit 검증과 최종 실행 시간은 PR 본문의 별도 CI 실행 근거로 추적한다.

실측 기준은 run 생성부터 verify 완료까지이며 queue/setup/cache/artifact/consumer 시간을 포함한다.
기준 CI 37971575120은 294초다. 초기 CI 37977862003 attempt 1의 GHA layer export는 164.3초를 써 전체 513초가 되어 채택하지 않았다.
local 전송의 캐시 없는 CI 37979844381은 342초, 캐시 재사용 CI 37980628425는 202초였다.
따라서 캐시 없는 첫 실행 비용은 기준보다 48초 크지만 반복 실행은 줄었다. 각 source와 이후 exact-hit의
시간·cache log는 PR 본문과 Actions를 원본으로 참조하며 단일 표본을 보편적 속도 보장으로 해석하지 않는다.

artifact는 같은 run에서만 소비하며 1일 보관한다. GitHub cache ref 제한에 따라 다른 PR 간 재사용을 보장하지 않는다.
P05와 배포는 미착수다. CI optimization PR 병합은 실행하지 않았다.
