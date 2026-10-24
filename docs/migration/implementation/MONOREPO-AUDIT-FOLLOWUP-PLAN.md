---
title: "모노레포 audit 후속 의존성·캐시 비용 개선 계획"
kind: migration-plan
status: active
authority: plan
source_commit: c3e593498aeea6b51d8706fa1f9c37461e1ebe75
created_at: "2026-10-25"
observed_at: "2026-10-25"
---

# 모노레포 audit 후속 의존성·캐시 비용 개선 계획

## 기준과 범위

사용자가 audit의 개선 판단을 승인하고 계획 작성과 실행을 요청했다. 저장소는
`goldmayo/oioi-bwg`, 기준은 `migration_main`의 위 SHA다. 분기 전에 fetch한
`origin/migration_main`과 local의 일치와 clean 작업 트리를 확인했다.

이 계획은 완료된 [경계·실행 개선 RESULT](MONOREPO-BOUNDARIES-AND-EXECUTION-RESULT.md)의
설치·cache 비용 후속 범위만 소유한다. 이전 계획과 검증 이력을 소급해서 바꾸지 않는다.
상위 기준은 [헌법 §5](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Testing §17](../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[배포 runbook §21](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)이다.

## AS-IS와 판단

| 관찰 | 문제와 변경 이유 |
| --- | --- |
| Root에 config/Tool 소비 외부 도구 선언이 남음 | 직접 source·CLI·peer·자동 탐색 소비를 대조하고 불필요한 Root 선언만 제거한다. Root 의존성 변경은 모든 task hash와 prune 설치 범위에 영향을 준다. |
| config가 Next/Node/browser 정책을 함께 제공 | contracts도 Next/browser 도구에 설치 의존한다. 곧바로 package를 분할하지 않고 Root 정리 이후 비용과 실제 소비를 보고 재판정한다. |
| 앱별 cache ZIP 합계 801,278,043바이트 | 직전 공유 builder의 434,614,786바이트 대비 약 84% 증가했다. 앱별 입력 분리는 유지하면서 공통 layer의 물리적 중복을 줄인다. |
| 일반 CI는 전체 검사, Turbo task cache 별도 복원 없음 | 이번에는 검사 범위를 줄이지 않는다. 로컬 warm 측정을 전체 CI 개선으로 보고하지 않는다. |

이번 audit의 `pnpm lint:deps`는 graph 오류 0건·Turbo 444파일/7패키지 위반 0건,
`pnpm test:harness`는 46/46이었다. 타입 포함 Console auth 순환 경고 1개는 유지했다.

## 실행 원칙과 공식 근거

- 의존성은 실제 소비 workspace가 소유한다. Root의 ESLint·jiti·Vitest·운영 DB CLI처럼
  실행 consumer가 있는 도구는 유지한다. [Turbo 의존성 관리](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies)
- Root 의존성의 전역 hash 영향 때문에 내부 workspace 의존성을 다시 추가하지 않는다.
  기존 등록된 Root→Tool 공개 파일 adapter를 유지한다. [Turbo cache](https://turborepo.dev/docs/crafting-your-repository/caching)
- pnpm manifest 정리는 동일 버전 재선언의 물리적 중복 설치라고 단정하지 않는다.
  frozen clean install·실제 명령·lockfile importer와 snapshot 변화를 대조한다.
- BuildKit local cache는 OCI blob 저장소와 index로 구성된다. 공식 `tag`/`digest` 기능을
  우선 검토해 앱별 manifest를 구분하고 공통 blob을 한 번 보관한다. 도구 버전과 실제
  CI 동작을 확인하며 독자적인 archive 포맷이나 제품 공용 package를 선생성하지 않는다.
  [Docker local cache](https://docs.docker.com/build/cache/backends/local/)
- 앱 build 입력·캐시 lookup의 논리적 경계와 저장 blob의 물리적 공유를 구분한다.
  cache는 선택적 최적화이며 검증 통과·배포 image identity를 대신하지 않는다.

## 단계와 PR 경계

| 순서 | reviewable concern | 완료 조건 |
| --- | --- | --- |
| 1 | Root 외부 의존성 소유권 | 소비자 대조 → 필요한 선언 보존 → manifest/lockfile 정리 → clean 설치와 Root/workspace 명령 검증 → commit·push·PR |
| 2 | BuildKit 공통 blob 보관 | 공식 기능·현재 도구 확인 → 새 cache namespace와 앱별 tag/manifest → 저장소 중복 제거 → cache 회귀와 실제 CI image/smoke → commit·push·별도 PR |
| 3 | 결과와 잔여 판단 | 각 concern의 RESULT에 정확한 source·PR·실행 검증·비용 기록. config 분할은 수치상 근거가 있을 때만 별도 계획으로 제안 |

직렬로 진행하며 각 feature 브랜치는 확인한 최신 `migration_main`에서 분기한다. 한 PR에
전체 단계를 합치지 않는다. 병합 전에는 구현·로컬 검증·PR/CI 성공·통합 완료를 구분한다.
최종 결과 문서는 concern별로 두며 이 계획을 참조한다.

## TO-BE

```text
Root package.json
  ├─ 실제 Root CLI·검사·운영 의존성
  └─ 내부 workspace 의존성 없음
packages/config · tools/repository
  └─ 기존 공개 API와 실제 도구 의존성 소유

AS-IS cache 저장               TO-BE cache 저장
web/blobs/<공통 digest>         blobs/<공통 digest>  # 한 번 보관
console/blobs/<같은 digest>     index: web / console # 앱별 manifest
```

공통 저장소에 export할 때 두 앱 manifest가 모두 보존되어야 한다. 병렬 export나 reset으로
다른 앱의 manifest/blob을 지우지 않으며, 첫 cache 생성과 cache 복원 후 실행을 구분해 검증한다.
namespace 전환은 기존 v3와 섞이지 않게 한다. source/tree/run·artifact 확인 후 merge cache
발행 계약, 같은 run의 두 image와 paired smoke, Promotion의 별도 cache·배포 계약을 유지한다.
저장 배치 변경 전에 runbook과 index를 같은 PR에서 개정한다.

## 검증과 완료 판정

코드 변경의 기본 gate는 `pnpm type-check`, `pnpm test:harness`, `pnpm lint`,
`pnpm lint:fsd`, `pnpm test:unit:run`, `pnpm format:check`다. Root Vitest collector와
운영 회귀는 별도로 확인한다. runtime/build 입력 변경은 개인 env 없는 clean build와
실제 CI image·native/readiness/browser/pair 검증을 추가한다.

의존성 단계는 Root 소유 여부와 lockfile 변화를 기록한다. cache 단계는 저장 bytes·중복
blob bytes·앱별 manifest·실제 compile/cache hit·저장/복원 및 job 시간을 기록한다.
동일 조건 비교가 없으면 비용·시간 개선을 일반화하지 않는다. 로컬 Docker 실행을 사용할 수
없는 상태이므로 실제 BuildKit 검증은 PR CI를 사용하며 mock 결과와 구분한다.

계획에서 보류한 항목은 config 패키지 일괄 분할, CI affected 확대와 Turbo remote cache,
auth 타입 순환 리팩터링, API 일괄 버저닝, UI package 생성이다. 운영 배포·production DB와
외부 알림은 이 작업의 실행 범위에 포함하지 않는다.
