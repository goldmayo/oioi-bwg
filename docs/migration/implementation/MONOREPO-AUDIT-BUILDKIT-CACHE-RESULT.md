---
title: "모노레포 audit 후속 BuildKit 캐시 보관 개선 결과"
kind: migration-result
status: complete
source_commit: c3e593498aeea6b51d8706fa1f9c37461e1ebe75
verified_source_commit: b9200b40a0a550066b4e0199af0a7fb30494c414
verified_ci_commit: 5e3969f197f31e6305c853bbb07fd2bbb2acf4b8
created_at: "2026-10-25"
completed_at: "2026-10-25"
---

# 모노레포 audit 후속 BuildKit 캐시 보관 개선 결과

[후속 PLAN](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/MONOREPO-AUDIT-FOLLOWUP-PLAN.md)의 2단계다. 1단계 Root 정리는
[PR #242](https://github.com/goldmayo/oioi-bwg/pull/242)이며 이 브랜치의 구현과 독립적이다.
두 브랜치는 확인한 같은 통합선에서 분기하고 동일한 계획 내용을 공유한다.

## 구현과 선택 근거

기존 실제 CI #540의 Buildx v0.38.0·BuildKit v0.33.1을 확인하고 일반 CI builder를 그 버전으로
고정했다. 공식 local exporter/importer의 `tag` 지원과 OCI index의 태그 보존 구현을 확인했다.
[Docker local cache](https://docs.docker.com/build/cache/backends/local/)와
[검증한 client 구현](https://github.com/moby/buildkit/blob/v0.34.0/client/ociindex/ociindex.go)을 근거로 사용한다.

- 앱별 pruned Docker target·4회 build action·같은 run의 두 image·후속 pair 검증은 유지한다.
- 두 cache export는 새 local OCI 저장소에 직렬로 `tag=web`/`tag=console`을 기록한다.
  import도 해당 앱 tag를 지정한다. 공통 digest blob은 같은 경로에서 한 번 보관한다.
- export 때 reset을 사용하지 않는다. 매번 새 출력 저장소를 생성하므로 과거 run의 blob을
  계속 누적하지 않으며 두 앱 tag를 보존한다. v4 key/restore prefix로 v3 layout과 분리한다.
- `buildkit-cache-report.mjs`는 저장소를 변경하지 않고 양 앱 manifest와 참조 blob의 digest/size를
  검사한다. 실제/참조/별도 저장 가정 bytes와 공통 blob bytes를 image metadata에 기록한다.
- Runbook 1.24·index 1.53에 저장 배치를 반영했다. merge cache 발행의 source/tree/run·artifact
  검증, Promotion cache·후보 digest·배포 계약은 유지한다.

## 실제 로컬 검증

별도 worktree의 frozen offline 설치에 성공했다. 개인 env 파일을 복사하지 않았다.
Node 22.16.0·pnpm 10.15.1·Linux ARM64에서 다음을 실행했다.

| 명령/방법 | 결과 |
| --- | --- |
| `pnpm type-check`, `pnpm lint`, `pnpm lint:fsd` | 성공. dependency graph 오류 0·Turbo 위반 0 |
| `pnpm test:harness` | 46/46 성공 |
| `pnpm test:unit:run` | 99파일/700건, 실제 task 5개 miss 후 성공 |
| 새 cache report와 기존 cache publication 테스트 | 2파일/29건 성공 |
| `pnpm test:ops` | 갱신 후 22파일/287건 성공 |
| `pnpm format:check`, `git diff --check` | 성공 |
| 개인 env 없는 `pnpm build --concurrency=1` | 양 앱 실제 task 2개 miss·standalone 생성 성공, 30.16초 관찰 |

ops 최초 실행은 로컬 jq 경로 누락과 기존 앱별 cache 디렉터리 assertion 때문에 실패했다.
기존 임시 jq 1.7.1 경로를 지정하고 assertion을 앱별 tag·직렬 export·reset 금지 계약으로
갱신한 뒤 전체 ops를 다시 실행했다. 제품·배포 transport 코드는 변경하지 않았다.

새 fixture는 공통 blob을 한 번 세는지, 앱 manifest가 구분되는지, tag 누락/중복과 참조 blob의
손상/누락/size 불일치를 거절하는지 검사한다. 모의 OCI fixture 성공은 실제 BuildKit 성공과 구분한다.

## CI 측정과 잔여 범위

push hook의 type/lint/unit·Root/Tool·경계·harness·ops·format은 성공했다.
[PR #243](https://github.com/goldmayo/oioi-bwg/pull/243)의
[Verify #543](https://github.com/goldmayo/oioi-bwg/actions/runs/40130077778) app build는
source `5e3969f197f31e6305c853bbb07fd2bbb2acf4b8`에서 실제 Next compile 2회 후 성공했다.
새 v4 key는 miss였으며 native tag export/import와 digest/size 검사를 통과했다.

| 같은 run의 cache 관찰 | 바이트 |
| --- | ---: |
| 두 앱의 참조 blob을 각각 보관한 합계 | 801,182,117 |
| 공통 OCI 저장소의 실제 blob | 696,461,096 |
| 공통 digest blob의 중복 보관 절감 | 104,721,021 |
| 참조되지 않은 blob | 0 |
| 최종 cache artifact ZIP | 696,468,887 |

동일한 앱별 참조 데이터를 기준으로 약 13.1% 절감했다. 종전 #540 cache ZIP
801,278,043바이트와 비교한 관찰 차이는 104,809,156바이트다. 실제 물리적 중복 절감과
서로 다른 run의 ZIP 비교를 구분한다. 전체 CI 시간/비용 감소는 주장하지 않는다.
같은 key의 후속 warm 복원 검증은 이 PR의 최종 Verify 기록에서 추가 확인한다.

로컬 Docker는 WSL integration이 없어 실행할 수 없다. 실제 native cache export/import와
저장 bytes·artifact 크기와 같은 run의 두 runtime image·native/readiness/browser·paired Compose
보존/복구를 포함한 Verify #543 전체 gate가 성공했다. 구현·검증 완료이며 PR 병합·운영 배포는 아니다.
같은 digest의 layer만 중복 제거할 수 있으며 앱별 install layer가 다르면 공유되지 않는다.
기존 801,278,043바이트와의 단일 run 비교를 전체 CI 속도 개선이나 84% 회수로 일반화하지 않는다.
