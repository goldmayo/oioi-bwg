---
title: "CI 공통 빌드 재사용 및 Docker 캐시 계획"
kind: migration-plan
status: active
source_commit: 770dc663b1ead0a2c121356ed5474b89ab05255f
created_at: "2026-10-10"
---

# CI 빌드 최적화 계획

기준은 P04 리뷰 보완을 병합한 위 migration_main head다.
[헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md)과
[배포 runbook §21](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)을 따른다.
기존 [P04 검증 결과](../console-guide-editor/P04-REVIEW-RESULT.md)는 당시 기록으로 유지한다.

기준 CI 37971575120의 build job은 286초, 그중 Docker 빌드는 168초다.
관리자 통합 job 223초 중 앱 빌드는 126초, 실제 브라우저 시나리오는 23초다.
호스트 일반 빌드·Docker·관리자 job에서 두 앱을 각각 빌드하고 있다.

1. app_build가 기존 production runner를 빌드하고 동일 BuildKit builder의 두 앱
   standalone/static을 tar로 export한다. tar는 숨김 파일·심볼릭 링크·권한을 보존한다.
2. 같은 run의 image/standalone artifact를 build smoke와 관리자 통합 job이 전달받는다.
   두 consumer는 병렬 실행하고 직접 빌드하지 않는다. artifact 누락 시 실패한다.
3. 검증용 amd64 BuildKit layer cache를 별도 scope, mode=max로 적용한다.
   앱 build가 참조하지 않는 docs와 로컬 생성물(.turbo/tsbuildinfo/next-env)은
   Docker context에서 제외해 문서 기록·로컬 검증만으로 캐시를 무효화하지 않는다.
   배포 candidate/ARM64·Sentry secret 경로·배포 digest 흐름은 그대로 유지한다.
4. verify는 producer까지 모두 성공해야 통과한다. 동일 run 내 산출물만 재사용하며
   tar/image는 1일 보관한다. 다른 run artifact나 배포 후보로 대체하지 않는다.

기본 검증과 ops를 실행하고 Docker/실제 PostgreSQL/브라우저는 CI에서 확인한다.
새 CI를 한 번 더 실행하여 cold/warm 실행 시간과 cache hit를 비교한다.
artifact 전송·job 의존으로 cold 실행이 느려질 수 있으므로 결과에 실제 시간을 기록한다.
P05/TOTP, 앱 기능, production 연결·배포는 범위 밖이다. 완료 시 commit/push/PR을 생성한다.

## 실행 중 보완 — 2026-10-10

초기 구현 `1bb4db8`의 CI 37977862003 첫 실행은 모두 통과했지만 513초로 기준 294초보다
느렸다. producer의 GHA mode=max cache export가 164.3초(압축 준비 43.9초,
레이어 전송 120.5초)를 차지했다. 이 방식을 최종 최적화로 채택하지 않는다.

[Docker의 local cache 예제](https://docs.docker.com/build/ci/github-actions/cache/#local-cache)를
따라 local exporter와 actions/cache의 일괄 전송으로 바꾸고 zstd 압축을 사용한다.
export는 새 디렉터리에 한 뒤 교체하여 과거 blob 누적을 막는다. 검증용 key는 amd64·SHA별이며
동일 ref의 이전 key로 fallback할 수 있으나 BuildKit이 내용 hash를 검증한다.
GitHub-hosted 일회성 VM에서 builder 삭제를 생략해 무거운 post-job 정리 비용도 줄인다.
producer/consumer 및 실제 검증 범위는 최초 계획과 같으며 새 cold/warm CI로 재측정한다.

추가로 archive를 cache graph에 먼저 포함한다. archive stage는 runtime entrypoint를
builder entrypoint와 cmp로 대조해 두 target의 cache를 함께 참조하며, runner는 마지막
alias로 유지한다. 다음 실행은 builder 전체 파일을 복원해 tar를 다시 만들지 않고
이미 생성된 archive layer를 재사용한다. Dockerfile/.dockerignore는 BuildKit이 직접
해석하고 .github는 앱 build가 참조하지 않으므로 COPY context에서 제외한다.

각 target 호출에 cache-from을 명시한다. 외부 cache hit로 건너뛴 ancestor는 두 번째
호출의 내부 cache에 자동 저장되지 않으므로 runner도 방금 export한 local cache를 import한다.

cache hit에도 46.6초의 전체 재export가 관찰되어 cache key를 docs를 제외한 전체 Git
tracked index(mode/blob/path)의 digest로 정한다. workflow/Dockerfile/ignore와 앱·공용
설정·lockfile·테스트가 모두 key에 포함되며 문서 commit은 같은 key를 사용한다.
exact hit에서는 재export·교체·save를 생략하고 두 target 모두 기존 cache를 import한다.
fallback/미스일 때만 새 cache를 export·저장한다. 기존 v1 fallback은 전환 시 한 번 활용한다.

## 새 PR의 캐시 재사용 보완 — 2026-10-21

기준은 `b9044601a934ba61dd31f1437f1bad517ceb3168`이다. 사용자가 캐시 문제 해결을 명시했다.
[최근 실측](LATENCY-AUDIT-2026-10-21.md)의 서로 다른 PR 캐시 미스를 해결한다.

- app_build가 기존 local BuildKit 캐시를 1일 artifact로 전달한다.
- migration_main/migration_develop의 신뢰된 push에서 병합 PR·동일 저장소/head/tree·성공한 Verify와
  app build·같은 입력 key·병합 전 생성 및 미만료 artifact를 대조해 base branch 캐시로 저장한다.
- 병합 후에는 build/test/이미지 발행을 반복하지 않는다. 다운로드한 캐시는 코드로 실행하지 않는다.
  증거가 없으면 발행을 건너뛰며 다음 PR은 기존처럼 직접 빌드한다. API/전송 실패는 별도 workflow에 표시한다.
- 검증용 image/standalone은 계속 같은 run의 것만 소비한다. 캐시는 검증 통과나 배포 증거가 아니다.
  ARM64 후보의 별도 cache와 exact digest 계약은 이번 amd64 캐시 발행 변경에 포함하지 않는다.
- source/실패/만료/다른 tree 거절 회귀와 기본 검증을 실행한다. 병합 후 base cache 생성과
  **다른 PR**에서 실제 restore 및 BuildKit CACHED를 확인해야 완료로 기록한다.
  같은 PR 재실행만으로 검증을 대신하지 않는다. 전송 시간과 전체 CI 시간을 함께 기록한다.

[GitHub cache 접근 범위](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)를
따라 push의 base ref에 저장한다. cache-mode 권한 우회나 pull_request_target은 사용하지 않는다.


## 캐시 용량 축소 — 2026-10-21

사용자의 명시적 축소 요청에 따라 `9e09077ac4949b4b105582a1c3c759a3f9515e48`에서 진행한다.
[전수 분석](LATENCY-AUDIT-2026-10-21.md#캐시-용량-전수-분석--2026-10-21-후속-실측)의
재사용되지 않는 내부 cache와 standalone archive 중복을 제거한다.

- Docker builder에만 `OIOI_EPHEMERAL_BUILD=true`를 설정하고 두 앱의 공식
  `experimental.turbopackFileSystemCacheForBuild`를 false로 만든다. Turbo build env 목록에 포함해
  strict env 전달과 hash를 유지한다. 로컬 dev/build는 기존 파일시스템 cache를 사용한다.
- Docker의 Turbo 호출만 `--cache=local:r`로 실행해 별도 output archive 쓰기를 중단한다.
  전역 task cache와 BuildKit install/build 중간 레이어의 max cache는 유지한다.
- CI는 두 runtime target을 참조하는 작은 `verification-cache` target을 `type=cacheonly`로 빌드한다.
  두 image는 같은 builder/cache에서 load·전달·검증한다. standalone tar 생성/중복 COPY/별도 artifact
  업로드·다운로드·해제를 제거한다. 앱의 standalone 출력과 로컬 수동 HTTPS 검증은 유지한다.
- 기본 검사와 실제 Docker CI를 통과하고 새 cache artifact의 압축 크기를 이전1,308,788,491바이트와
  비교한다. restore된 install 레이어의 재사용, 두 image native/readiness·화면·paired smoke를 확인한다.
  실제 동일 입력 재실행에서는 첫 target과 두 load target의 CACHED 여부도 확인한다.

근거: [Next의 컨테이너 build cache 안내](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache),
[Turbo cache 쓰기 제어](https://turborepo.com/docs/reference/run#--cache-options),
[Docker cacheonly exporter](https://docs.docker.com/build/exporters/#cache-only-export).
ARM64 후보에도 같은 builder 정책이 적용되지만 GHA cache의 별도 접근 범위 개선은 이 변경에 포함하지 않는다.

## 완료된 임시 workflow 정리 — 2026-10-21

사용자의 미사용 workflow 식별·제거 요청에 따라 캐시 축소 병합 뒤 최신 통합선에서 진행한다.
active 배포 runbook §21의 Verify/Promotion/cache 발행 계약은 유지한다.

- 실제 실행 이력·현재 파일·소비자를 함께 확인하고 완료된 Development Image/P02 bootstrap/B0 probe만 폐기한다.
- B0 command workflow와 항상 false인 publish job을 제거하고 운영 README의 당시 절차를 과거 기록으로 표시한다.
- GitHub의 해당 세 workflow는 비활성화하되 증거로 참조되는 기존 run은 삭제하지 않는다.
- F 전환 전인 기존 Cloudflare Production/Staging은 유지한다. helper·IAM·secret·VM 설정 정리는 포함하지 않는다.
- 남는 YAML/필수 gate와 기본 검사·실제 PR CI를 확인한다. 실행 결과와 식별 근거는 [지연 조사](LATENCY-AUDIT-2026-10-21.md)에 남긴다.
