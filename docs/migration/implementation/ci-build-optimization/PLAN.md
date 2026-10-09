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
