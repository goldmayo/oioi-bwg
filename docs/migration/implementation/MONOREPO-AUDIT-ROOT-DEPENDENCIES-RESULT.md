---
title: "모노레포 audit 후속 Root 의존성 정리 결과"
kind: migration-result
status: complete
source_commit: c3e593498aeea6b51d8706fa1f9c37461e1ebe75
verified_source_commit: 5e160e101f964f6d6ad395370f738e0ffb182291
verified_ci_commit: 49f0d068f8313125d9055fc0f36bd34df7f7e2af
created_at: "2026-10-25"
completed_at: "2026-10-25"
---

# 모노레포 audit 후속 Root 의존성 정리 결과

[후속 PLAN](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/MONOREPO-AUDIT-FOLLOWUP-PLAN.md)의 1단계다. 구현 commit은 위 verified source이며
`feature/monorepo-audit-root-dependencies`에서 실행했다. 병합 완료를 뜻하지 않는다.

## 변경과 소비자 확인

Root source·설정·scripts·ops·workflow·hook의 import/CLI와 직접 Root 패키지의 peer 요구를
대조한 뒤 다음 9개 Root 선언을 제거했다. 도구 자체를 저장소에서 제거한 것은 아니다.

| 선언 | 실제 소유자 |
| --- | --- |
| `dependency-cruiser` | Tool의 dependency CLI/harness와 config의 정책 타입 |
| `@feature-sliced/steiger-plugin` | config의 `steiger.ts` |
| `eslint-config-next`, `eslint-config-prettier` | config의 Next/Node lint preset |
| `eslint-plugin-boundaries`, `eslint-plugin-simple-import-sort`, `eslint-plugin-unused-imports` | config의 앱 lint 정책 |
| `globals`, `typescript-eslint` | config의 Node/base lint preset |

Root에서 실제 실행하는 ESLint·jiti·Vitest·TypeScript·Steiger·Prettier·hook 및 DB/운영 CLI는
유지했다. Root React/types/jsdom은 이번 제거 범위에 포함하지 않는다. 제품 의존성, public
script, 등록된 Root→Tool adapter와 workspace manifest는 변경하지 않았다.

pnpm의 lockfile 재생성에 무관한 Vite/Webpack/Terser 전이 해석 변경이 섞여 기존 resolution을
보존했다. 최종 lock은 Root importer의 해당 9개 항목만 삭제했으며 다른 importer·`packages`·
`snapshots`가 기준과 구조적으로 동일하다. 이 lock으로 frozen offline 설치가 성공했다.

## 실제 검증

Node 22.16.0·pnpm 10.15.1·Linux ARM64에서 검증했다. 별도 clean clone은 위 commit을 사용하며
개인 env 파일을 복사하지 않았다. `HUSKY=0 pnpm install --frozen-lockfile --offline`는 다운로드
없이 1,367개 package를 설치했다. Root 선언 9개 제거를 설치량 감소로 주장하지 않는다.

| 명령/방법 | 결과 |
| --- | --- |
| clean `pnpm type-check` | 자체 workspace와 Root/Tool 검사 성공 |
| clean `pnpm lint`, `pnpm lint:fsd` | 성공. dependency graph 오류 0·Turbo 444파일/7패키지 위반 0 |
| clean `pnpm test:harness` | 46/46 성공 |
| clean `pnpm test:unit:run` | 99파일/700건, 실제 task 5개 모두 miss 후 성공 |
| clean `pnpm test:ops` | 21파일/284건 성공. 기존 임시 jq 1.7.1 경로 사용 |
| clean `pnpm format:check` | 성공 |
| 개인 env 없는 clean `pnpm build --concurrency=1` | 양 앱 build·타입·standalone 복사 성공, 실제 task 2개 miss, 30.23초 관찰 |
| 작업 checkout의 Root `vitest run --config vitest.config.ts` | 전체 collector 99파일/700건 성공 |

최초 Root Vitest의 `--project web/console` 실행은 프로젝트 name 미정의로 시작 단계에서
실패했다. 설정을 변경하지 않고 실제 Root config 전체 실행으로 바로잡았다.

## 남은 범위

push hook의 type/lint/unit·Root/Tool·경계·harness·ops·format이 성공했다.
[PR #242](https://github.com/goldmayo/oioi-bwg/pull/242)의
[Verify #542](https://github.com/goldmayo/oioi-bwg/actions/runs/40129786377)는 실제 PostgreSQL·
양 앱 image·native/readiness/browser·paired Compose 보존/복구를 포함해 전체 성공했다.
구현과 검증 완료 판정이며 PR 병합이나 운영 배포 완료는 아니다.

이번 변경만으로 config의
Next/browser 설치 의존성이나 CI cache 보관 비용이 줄었다고 평가하지 않는다. config 패키지
분할은 보류한다. 현재 두 Next 배포 대상이 해당 도구를 함께 사용하므로 package 분할만으로
전체 설치가 줄어든다는 근거가 없다. 독립 Node 소비자나 분리 설치의 실측 필요가 생기면
재검토한다. 추가 Root 패키지 제거도 직접 consumer·CLI·peer 검증 없이 확대하지 않는다.
