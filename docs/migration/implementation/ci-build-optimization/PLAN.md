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
