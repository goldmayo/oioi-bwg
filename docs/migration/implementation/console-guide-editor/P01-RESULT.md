---
title: "P01 웹 워크스페이스 이동 결과"
kind: "result"
status: "active"
verified_source:
  repository: "goldmayo/oioi-bwg"
  branch: "migration_workspace-web-p01"
  commit: "b506c670b784d8fa301b85a03cca85348628c7f2"
verified_at: "2026-10-05"
---

# P01 웹 워크스페이스 이동 결과

승인된 [ROADMAP의 P01](ROADMAP.md)을 구현했다. 기준 merge head는
`10ebc91df17de95ad69c3c755fb80023ffd12be7`이다. 이 문서는 위 구현 커밋의 로컬 검증 기록이며,
후속 문서 커밋은 앱 동작을 변경하지 않는다. CI 결과는 PR의 검증 기록을 따른다.

- `src`, `public`, `types`의 268개 파일을 내용 변경 없이 `apps/web`으로 이동했다.
- Next 자동 탐색 설정·PostCSS·앱 의존성·로컬 환경 파일을 web workspace가 소유한다.
- 루트의 dev/build/start는 web 실행을 전달한다. 검증 설정·운영 도구·migration 이력은 루트에 유지했다.
- root TypeScript 설정은 앱 설정을 참조하며 기존 루트의 `.mts` 검사도 유지한다.
- standalone tracing root와 진입점·자산 배치, Docker/개발 Compose/CI 경로를 보정했다.
  `pnpm build`는 public/static도 standalone에 복사하여 루트 `pnpm start`에서 제공한다.
- active 문서에는 현재 물리적 소유 위치만 반영했다. API·DB schema·UI·URL·권한·env 이름은 그대로다.

## 실행한 검증

Node 22.16.0 / pnpm 10.15.1 / Next 16.3.3, WSL 로컬 환경에서 다음을 확인했다.
빌드는 ignored 환경 파일을 제외한 별도 복사본에서 수행했으며 production credential을 사용하지 않았다.

| 검사 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | 깨끗한 복사본에서 성공, 기존 packages/snapshots 변경 없음 |
| `pnpm type-check` | 성공 |
| `pnpm test:harness` | 8개 성공, 이동한 경로에서 동일 경계 검사 |
| `pnpm lint`, `pnpm lint:fsd`, `pnpm format:check` | 성공 |
| `pnpm test:unit:run` | 57개 파일 / 240개 테스트 성공 |
| `pnpm test:ops` | 3개 파일 / 21개 테스트 성공 |
| `pnpm build` | 성공, `/admin`과 기존 사용자·API route 생성 |
| `pnpm start` 및 별도 위치에 복사한 standalone 단독 실행 | smoke 성공 |
| `pnpm dev --port 3103 --hostname 127.0.0.1` | 인자 전달 및 `apps/web/.env.local` 자동 로딩, smoke 성공 |
| 원본과 이동 후 파일 내용 비교 | 소스·자산·타입 268개 모두 동일 |

[smoke 검사](../../../../tests/ops/web-standalone-smoke.mjs)는 health/public 자산, 사용자 URL,
관리자 API의 401, Playwright에서 `/admin` → `/admin-login` 이동과 브라우저 오류 부재,
Next JS/CSS 응답을 확인한다. Git pre-push hook의 `pnpm verify`도 성공했다.

## 남은 환경 검증과 보류

WSL Docker 접근이 없어 container 및 PostgreSQL integration은 로컬에서 실행하지 않았다.
기존 CI의 PostgreSQL integration과 build job의 container build/smoke에서 확인하도록 연결했다.
OCI ARM64 runtime 및 실제 Sentry 업로드는 운영 배포 시 확인할 범위이며 이번 작업에서 수행하지 않았다.

기존 manifest의 `/web-app-manifest-512x512.png` 파일은 기준 커밋에도 없다.
기존 결함으로 기록하고 자산을 임의로 추가하지 않았다.

P02의 Turborepo, `config/typescript`, `config/eslint`, `harness/architecture` 및 검증 공용화는 수행하지 않았다.
console/Admin 분리, packages 추출과 이후 기능 checkpoint도 구현하지 않았다.

## #107 통합 후 재검증 (2026-10-06)

병합된 #107의 `440d9edb8ed0c80bd7d0edf1a91cae90370ec63f`를 P01 작업 브랜치에 반영했다.
`verify.yml`의 Promotion candidate/gate와 별도 deploy workflow를 유지하면서 P01의
`apps/web/.next/cache`, workspace build와 standalone container/Playwright smoke를 함께 보존했다.
기존 migration_develop push 기반 publish/deploy는 복구하지 않았다.
문서 버전 충돌은 두 변경의 내용을 모두 유지하고 index와 버전을 맞춰 해결했다.
P01 기존 head `e813bbf`와 비교해 `apps/web` 파일에는 추가 변경이 없다.

통합 상태에서 frozen/offline install, `pnpm verify`(harness 8개, unit 240개, ops 50개),
`pnpm format:check`와 환경 파일을 제외한 복사본의 `pnpm build`가 성공했다.
WSL Docker 접근이 없어 container/PostgreSQL 검증은 갱신된 #106 CI에서 확인한다.
기존 #106의 성공 CI를 통합 결과의 검증으로 재사용하지 않는다.
보호 규칙과 Environment의 실제 적용 기록은 [ops 가이드](../../../../ops/oci/README.md#6-migration-branch-및-github-수동-설정)를 따른다.
