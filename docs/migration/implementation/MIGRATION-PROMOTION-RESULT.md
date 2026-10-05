---
title: "Migration 통합과 Promotion 배포 분리 결과"
kind: "result"
status: "active"
verified_source:
  repository: "goldmayo/oioi-bwg"
  branch: "feature/migration-promotion"
  commit: "416edd451fcaa173cf83a5fe73aa3a4f0fcc8a72"
verified_at: "2026-10-05"
---

# Migration 통합과 Promotion 배포 분리 결과

[계획](MIGRATION-PROMOTION-PLAN.md)에 따라 기존 app/DB/Dockerfile과 host 배포 script를 유지하고 CI 흐름을 분리했다.
기준 `10ebc91df17de95ad69c3c755fb80023ffd12be7`에서 원격 `migration_main`을 생성하고
[P01 PR #106](https://github.com/goldmayo/oioi-bwg/pull/106)의 base를 재지정했다. P01 merge와 OCI 배포는 실행하지 않았다.

- 일반 feature PR → migration_main: 기존 full verify, private publish/deploy 없음.
- migration_main push: 중복 heavy verify/deploy trigger 없음. main/develop의 기존 verify push 정책은 유지.
- Promotion PR: 동일 repo/main head와 검증용 merge tree 대조 → ARM64 candidate 게시 → exact digest pull →
  로컬 Docker PostgreSQL의 schema와 readiness/브라우저 smoke → Actions artifact 기록. 아직 OCI deploy하지 않음.
- Promotion squash merge: 검증한 head/tree와 실제 merge tree, PR/run/attempt/artifact/registry를 확인하고
  기존 Run Command에 동일 digest만 전달. 새 build/publish 없음.
- head 변경·실패한 최신 run·다른 PR/tree/registry·누락/만료 artifact는 배포하지 않음.
- host의 health/readiness/smoke, env/digest rollback과 exit 0/20/21은 유지.
  기존 Slack layout을 재사용하며 candidate 게시·검증과 실제 배포·rollback 결과를 구별.

정책 SSOT는 active 배포 runbook §21이다. AGENTS와 관련 architecture/index/운영 문서의 충돌만 수정했다.
P01~P10 기능은 변경하지 않았으며 DESIGN의 affected 기준과 ROADMAP의 PR 대상만 새 통합선으로 맞췄다.

## 실행한 검증

Node 22.16.0 / pnpm 10.15.1 / WSL ARM64에서 다음을 확인했다. 이 기록은 구현 커밋의 로컬 검사이며 CI 결과는 PR checks를 따른다.

| 검사 | 결과 |
| --- | --- |
| type-check / harness / lint / FSD / format | 모두 성공, harness 8개 |
| unit | 57개 파일 / 240개 테스트 성공 |
| ops | 기존 digest/rollback 포함 4개 파일 / 50개 테스트 성공 |
| Actionlint 1.7.12 ARM64 | 두 workflow 성공 |
| `bash -n` | 기존 host/Run Command script 성공 |
| frozen/offline install + `pnpm build` | ignored env 없는 복사본에서 성공 |
| app, package/lockfile, Dockerfile, 기존 배포 script diff | 변경 없음 |

ops 검증은 fixture/API mock으로 stale head·source/tree·PR/run/attempt·artifact 경계와 알림/rollback을 확인한다.
실제 OCIR candidate 게시와 OCI Run Command 배포의 성공으로 표현하지 않는다. production credential을 사용하지 않았다.

## 수동 설정 및 실제 환경 검증

관찰한 기존 migration_develop ruleset에는 PR required, verify, force-push 금지가 있다.
새 migration_main에는 보호 규칙이 없으며 Environment는 migration_develop만 허용한다.
기존 strict 검사는 꺼져 있고 저장소의 `allow_update_branch=false`도 확인했다.
다음 설정은 코드에서 자동 변경하지 않았다.

1. migration_main: PR required / verify / 최신 base 포함 검증(strict) / direct·force push 금지 / stale approval 재검토.
2. migration_develop: required promotion 추가 / 최신 base 포함 검증(strict) / stale approval 재검토.
3. oci-development-image: `refs/pull/*/merge` 허용. 기존 migration_develop 허용은 유지.

상세 운영 경계는 [ops 가이드](../../../ops/oci/README.md#6-migration-branch-및-github-수동-설정)를 따른다.
적용 순서는 #107 병합 → 보호/Environment 설정 → #106에 최신 migration_main merge/rebase 및 push →
새 CI 전체 성공 → #106 병합 → 첫 Promotion PR이다. #106의 기존 성공 CI를 그대로 재사용하지 않는다.
첫 Promotion acceptance는 ARM64 candidate publish → 동일 digest pull/smoke → merge → artifact 조회/identity 대조 →
동일 digest Run Command 배포와 health/readiness/smoke/Slack 확인이다. head 변경 후 재검증과 runtime rollback도 확인한다.
이 실제 환경 검증은 미실행이다.
