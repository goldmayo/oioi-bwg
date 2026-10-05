---
title: "Migration 통합과 Promotion 배포 분리 계획"
status: "draft"
authority: "plan"
updated_at: "2026-10-05"
---

# Migration 통합과 Promotion 배포 분리

기준은 `migration_develop`/신규 `migration_main`의 `10ebc91df17de95ad69c3c755fb80023ffd12be7`이다.
현재 verify.yml은 migration_develop push에서 verify→ARM64 publish→Run Command deploy를 모두 수행한다.
기존 host deploy script는 immutable digest, health/readiness/smoke, env/digest rollback과 exit 0/20/21을 이미 소유한다.
상위 계약은 개정한 헌법과 active 배포 runbook §21이며, P01~P10 기능 설계는 변경하지 않는다.

1. 현재 배포 head에서 migration_main을 생성하고 P01 PR #106의 base를 변경한다.
2. 일반 PR verify를 재사용하며 migration 통합/promotion push의 중복 heavy verification을 제거한다.
3. Promotion PR만 ARM64 candidate를 build/publish하고 같은 digest를 pull/smoke한다.
4. source SHA/tree·PR·run/attempt·digest를 GitHub Actions artifact로 기록한다.
5. merged/closed Promotion event에서 검증된 현재 head의 artifact와 squash tree를 확인하고 같은 digest만 배포한다.
6. Slack의 candidate 게시/검증과 deploy/rollback 의미를 분리한다. host rollback script는 변경하지 않는다.

검증은 ops fixture로 event/branch, stale head, 다른 PR/registry/tree, 미완료 run, 누락 artifact 및 rollback 경계를 확인한다.
표준 검사와 build를 실행하며 일반 feature PR CI에서 publish/deploy가 실행되지 않는지 확인한다.
실제 OCIR 게시·OCI 배포는 Promotion 활성화 후 검증할 범위로 구분하여 보고한다.

현재 저장소는 squash만 허용한다. 신규 main protection, develop의 promotion required check 및
Environment PR ref 허용은 수동 설정으로 보고하며 별도 설정 관리 시스템을 만들지 않는다.
