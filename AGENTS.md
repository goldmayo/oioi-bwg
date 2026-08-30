# oioi-bwg Agent Instructions

이 파일은 저장소에서 작업하는 Codex 및 자동화 에이전트의 실행 기준이다.
상세한 구조·계약·운영 규칙은 `docs/migration/oioi-bwg-architecture-clean-v1/`의 active 문서가
SSOT이며, 이 파일은 매 작업에서 반드시 지켜야 할 요약 규칙과 작업 절차를 정의한다.

## 1. 규칙 우선순위와 SSOT

규칙 충돌 시 다음 순서로 판단한다.

```text
사용자/시스템 지시
  ↓
01-architecture-constitution.md
  ↓
해당 영역의 active architecture 문서 및 DOMAIN_SPECIFICATION.md
  ↓
migration implementation plan/result
  ↓
현재 코드
```

헌법과 코드가 다르면 코드에 맞춰 임의로 결정하지 않는다. 영향받는 문서를 먼저 확인하고,
필요하면 헌법 및 관련 active 문서를 같은 변경 단위에서 개정한 뒤 구현한다.
도메인 용어, 권한, 상태 전이, 불변성, 데이터 생명주기는 구현 편의로 새로 만들지 않으며
`DOMAIN_SPECIFICATION.md`를 test oracle로 사용한다.

주요 문서:

- [문서 인덱스](docs/migration/oioi-bwg-architecture-clean-v1/00-document-index.md)
- [Architecture Constitution](docs/migration/oioi-bwg-architecture-clean-v1/01-architecture-constitution.md)
- [Frontend/FSD](docs/migration/oioi-bwg-architecture-clean-v1/02-frontend-architecture.md)
- [API/Error](docs/migration/oioi-bwg-architecture-clean-v1/03-api-error-architecture.md)
- [Auth/Authz](docs/migration/oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md)
- [Contract/Validation](docs/migration/oioi-bwg-architecture-clean-v1/05-contract-validation-architecture.md)
- [Server/Data Access](docs/migration/oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md)
- [Rendering/Query/Cache](docs/migration/oioi-bwg-architecture-clean-v1/07-rendering-query-cache-architecture.md)
- [Form/Client State](docs/migration/oioi-bwg-architecture-clean-v1/08-form-state-architecture.md)
- [Error UX/Observability](docs/migration/oioi-bwg-architecture-clean-v1/09-error-ux-observability.md)
- [Testing](docs/migration/oioi-bwg-architecture-clean-v1/10-testing-architecture.md)
- [Content/i18n/Assets/Runtime](docs/migration/oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md)
- [Deployment/Migration Runbook](docs/migration/oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)
- [Domain Specification](docs/migration/DOMAIN_SPECIFICATION.md)

`docs/migration/oioi-bwg-architecture-clean-v1/`에는 구현 파일을 추가하지 않는다. 작업 기록과
계획은 `docs/migration/implementation/`에 둔다.

## 2. 브랜치와 변경 절차

- migration 작업은 `migration_*` 브랜치에서 수행한다.
- 새 단계 브랜치는 최신 `migration_develop` merge head에서 만든다. 분기 전 local과
  `origin/migration_develop`의 기준 커밋을 확인해 stale local branch에서 분기하지 않는다.
- 작업 중에는 해당 단계 브랜치만 수정한다.
- 단계 전체를 한 PR에 몰아넣지 않는다. 하나의 PR은 하나의 reviewable concern 또는 하나의
  migration checkpoint만 다룬다.
- PR은 원칙적으로 생성 파일·lockfile을 제외하고 변경 파일 20개 이하, 변경 라인 400줄 이하를
  목표로 한다. 기준을 넘으면 동작을 보존하는 준비 작업, 계약, 구현, 전환, 정리처럼 독립 검증 가능한
  단위로 나눈다. 분리할 수 없다면 결합 이유와 리뷰 순서를 PR 본문에 적는다.
- 무관한 리팩터링, 의존성 정리, 설정 변경을 기능 PR에 끼워 넣지 않는다. 리뷰 중 발견한 별도 관심사는
  후속 PR 후보로 기록한다.
- 각 PR 작업이 끝나면 검증 후 하나 이상의 의미 있는 커밋을 만든다. 리뷰 중 추가 작업도 의미 단위로
  커밋하며 기존 커밋을 임의로 합치지 않는다. 최종 병합 시에만 GitHub가 squash한다.
- Git 커밋 제목은 Conventional Commit의 `type(scope): 한글 요약` 형식을 유지한다. 규격상
  `type`과 선택적 `scope`만 영어로 쓰고, 모든 개별 커밋의 제목 요약과 본문은 반드시 한글로 작성한다.
- 사용자가 보류를 요청하지 않은 단계 완료 작업은 commit → push → PR 생성까지 진행하고 링크를 보고한다.
- PR 대상은 `migration_develop`이며, merge 방식은 squash and merge를 전제로 한다. 작업 브랜치의
  upstream은 PR 대상이 아니라 같은 이름의 원격 작업 브랜치로만 설정한다.
- squash 커밋 제목은 PR 제목, 본문은 PR 본문을 사용한다. 병합 전에 PR 제목이
  `type(scope): 한글 요약`인지, PR 본문이 최종 변경 사항과 검증 결과를 한글로 설명하는지 갱신한다.
- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md` 형식을 따른다.
- PR 리뷰 중에는 같은 브랜치에 추가 커밋을 push해 기존 PR에 반영한다.

현재 단계가 끝났다는 보고에는 변경 범위, 보류 항목, 검증 결과, 커밋을 포함한다.

## 3. FSD 및 의존성 방향

레이어 방향은 항상 아래쪽에서 위쪽으로만 향한다.

```text
app → pages/widgets/features/entities → shared
```

실제 프로젝트 규칙:

- `shared`: 도메인에 독립적인 UI primitive, 범용 hook, `cn`/date/helper, 범용 HTTP infrastructure만 둔다.
- `entities`: 안정된 도메인 계약과 여러 consumer가 실제 사용하는 도메인 UI만 둔다.
- `features`: 사용자 가치가 있는 use-case slice와 그 상태/동작을 둔다.
- `widgets`: 여러 route에서 재사용되는 완성 화면 단위가 확인된 경우에만 둔다.
- 단일 consumer UI는 먼저 route-private(`_ui`, `_model`, `_lib`, `_config`)로 둔다.
- slice에는 `ui`, `model`, `api`, `lib`, `config`만 필요한 만큼 사용한다. 임의의 `_components`,
  `_hooks`, `_utils`, `_helpers` segment를 만들지 않는다.
- 도메인 이름이 있다는 이유만으로 UI를 `shared`에 두지 않는다.
- 같은 레이어의 다른 slice를 직접 import하지 않는다.
- promoted slice는 public `index.ts`를 통해서만 외부에 공개한다.
- `src/server`는 FSD 계층 밖의 server boundary다. client feature/entity/shared가 직접 import하지 않는다.
- `shared/api`는 domain-independent HTTP transport만 둔다. domain browser API와
  `queryOptions`/`mutationOptions`는 `entities/*/api`가 소유한다.
- `shared/contracts`는 client/server 양쪽이 소비하는 serializable HTTP boundary contract의
  명시적 예외다. 도메인 UI·행동·persistence dependency를 두지 않으며 Zod schema와 DTO type만 둔다.

구현 순서는 bottom-up 공용 기반 구축 후 실제 consumer에서 top-down 승격을 검토한다. 중복이
확인되기 전에는 범용 wrapper나 추상화를 만들지 않는다.

## 4. Server/Data Access

서버 데이터 접근은 단계에 따라 두 흐름을 구분한다. M3의 현재 구조를 M4 이후의
클라이언트 API 흐름과 혼동하지 않는다.

### M3 현재 서버 내부 흐름

```text
RSC / route-local Server Action (제한적 전달 어댑터)
        ↓
server service
        ↓
domain repository
        ↓
DbExecutor (Database | Transaction)
        ↓
Drizzle → PostgreSQL
```

- `src/server/db`: DB singleton과 persistence schema
- `src/server/repositories`: executor를 첫 인자로 받는 plain persistence 함수
- `src/server/services`: use case, application/domain rule, authorization, transaction boundary, DTO projection
- Repository는 DB connection을 직접 획득하지 않고 transaction을 시작하지 않는다.
- Service는 HTTP `Response`, status code, Next.js API vocabulary를 알지 않는다.
- 단일 SQL mutation에는 transaction을 억지로 추가하지 않는다.
- 여러 repository operation이 하나의 atomic use case를 이룰 때만 service가 transaction을 소유하고 `tx`를 명시적으로 전달한다.
- Generic Repository, Unit of Work, DI container, decorator framework를 도입하지 않는다.
- Drizzle row를 Client Component에 직접 전달하지 않는다. service mapper를 통해 application projection/DTO로 변환한다.
- `server-only` boundary는 client로 새지 않도록 유지한다.

### M4 이후 클라이언트 server-state 흐름

```text
Client Component
        ↓ TanStack Query
ky → /api/* Route Handler
        ↓
server service
        ↓
domain repository
        ↓
DbExecutor (Database | Transaction)
        ↓
Drizzle → PostgreSQL
```

- Client Component의 server-state는 TanStack Query가 소유한다.
- `ky`는 `/api/*` Route Handler를 호출하고, Route Handler는 동일한 server service를 재사용한다.
- 데이터별 기본 decision matrix는 다음과 같다.

  ```text
  RSC에서만 사용
  → RSC → Service 직접 호출, Query cache 사용 안 함

  RSC 초기 렌더 + Client에서 계속 사용
  → RSC → Service → DTO → setQueryData(queryKey, dto) → dehydrate/HydrationBoundary

  Client에서만 사용
  → RSC fetch 없음, Client Query가 HTTP boundary를 통해 조회

  Client mutation
  → Route Handler → Service, 성공 후 invalidateQueries
  ```

- `prefetchQuery()`는 위 기본 흐름의 대안이 아니다. server/client가 동일 acquisition path를 공유하고 내부 HTTP round-trip이 없다는 근거가 있는 경우에만 예외적으로 허용한다.
- HydrationBoundary는 hydrated data를 실제로 소비하는 subtree 가까이에 둔다. root layout 전체를 무조건 hydrate하지 않는다.
- 서버 QueryClient는 `React.cache()` 등을 이용해 request/render lifecycle별로 격리한다. process-global QueryClient에 사용자별 data를 넣지 않는다.
- Server Action을 TanStack Query의 기본 transport로 대체하지 않는다. 폼 제출 등 헌법상 적합한 제한적 use case에서만 유지한다.

## 5. API와 응답 계약

M4 이후 client server-state의 기본 경로는 다음이다.

```text
TanStack Query → ky → Route Handler → Service
```

RSC는 필요한 경우 service를 직접 호출한다. 사용자 URL/locale routing과 API URL을 혼동하지 않는다.

성공 응답에는 공통 envelope를 사용하지 않는다.

```json
{ "id": 104, "title": "고민중독" }
```

목록은 명시적 목록 DTO를 사용한다.

```json
{ "items": [], "nextCursor": null }
```

실패 응답만 다음 형태로 통일한다.

```json
{ "code": "SONG_NOT_FOUND", "message": "곡을 찾을 수 없습니다." }
```

- Request params/query/body는 Route Handler boundary에서 Zod로 한 번 검증한다.
- 중요한 response DTO도 Zod로 검증한다. output contract violation은 500/Sentry 대상이다.
- Service는 expected failure를 `AppError`로 throw하고 HTTP status를 넣지 않는다.
- Route Handler 한 곳에서만 `AppError`/`ZodError`/unknown error를 HTTP response로 변환한다.
- Client는 HTTP JSON을 `unknown`으로 받은 뒤 response parser를 통과시킨다.
- `ky`의 non-2xx는 `ApiError`로 정규화한다.
- Ky transport retry는 기본으로 두지 않는다. Query retry는 TanStack Query가 소유하며 queryFn의
  `signal`은 Ky request까지 전달한다.
- API-wide `Result<T, E>` 또는 `{ success, error }` envelope를 기본 convention으로 만들지 않는다.
- error `details`에 DB row, stack, SQL, secret, 내부 구현 정보를 노출하지 않는다.

## 6. UI 및 상태

스타일링 표준은 다음이다.

```text
Base UI → shadcn/ui → Tailwind CSS
```

현재 Radix 기반 primitive를 Base UI로 전환하는 작업은 API 작업과 섞지 않고 UI foundation 단계에서
수행한다. 기존 `src/shared/ui` public API를 가능한 한 유지하고, keyboard/focus/portal/overlay
동작을 Playwright로 검증한 뒤 Radix 의존성을 제거한다.

- TanStack Query의 `useQuery`/`useMutation`/`queryOptions` vocabulary를 숨기는 범용 wrapper를 만들지 않는다.
- Server state는 Query가 소유하고 mutation 성공 후 명시적으로 query invalidation한다.
- server-seeded data와 client query는 동일 acquisition path가 아니라 동일 `queryKey`로 연결한다.
- Query cache에는 external DTO contract만 넣는다. Drizzle row나 server persistence type을 직접 넣지 않는다.
- Next Data Cache(`unstable_cache`, `use cache`, `cacheTag`, `revalidateTag`, `updateTag`, `revalidatePath`)는 application data consistency 용도로 사용하지 않는다.
- Form draft는 React Hook Form이 소유한다.
- 공유 가능하거나 navigation과 함께 보존되어야 하는 URL state는 `nuqs`를 우선한다.
- 순수 presentation state와 UI event는 UI에 남겨도 된다.

## 7. 데이터베이스 및 운영 안전

- production DB에 연결하거나 변경하지 않는다. 명시적인 사용자 승인 없이는 production credential을 사용하지 않는다.
- 로컬 DB는 Docker Compose PostgreSQL만 사용한다.
- `db:migrate`, `db:pull`, `db:studio`는 local database guard를 통과해야 한다.
- 로컬 데이터는 승인된 `.local` dump를 `pnpm db:restore-local`로 명시적으로 복원한다.
- 임의의 seed 데이터나 `docker compose up` 자동 데이터 주입을 만들지 않는다.
- 운영 schema와 repo schema가 다르면 차이를 분류하고 production migration은 별도 계획으로 남긴다.
- Drizzle schema를 production schema의 자동 canonical로 가정하지 않는다. 실제 production 관찰값과의
  차이는 accidental mismatch, intentional application constraint, legacy artifact, future migration 후보로 분류한다.
- DB schema 변경은 schema 수정 → migration 생성 → SQL 검토 → 명시적 migration 적용 → 검증 순서로 수행한다.

## 8. 검증과 도구

코드 변경의 기본 검증:

```bash
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
```

위험도가 있는 runtime/build 변경은 추가로 다음을 실행한다.

```bash
pnpm build
```

- Vitest: 순수 함수, hook, 동기 component, service 단위 테스트
- Playwright: 브라우저, 핵심 사용자 흐름, async Server Component와 UI regression
- ESLint/FSD harness: import 방향과 파일 배치 검증
- 문서만 변경하는 작업은 요청된 경우 lint/typecheck/test/build를 실행하지 않는다.
- 문서 작업의 push에서 Git hook이 검증을 자동 실행했다면, 별도 검증으로 계획한 것처럼 기록하지 않고 hook이 실행한 명령과 결과를 그대로 보고한다.
- 테스트 도구나 번들러의 기본 동작을 추측하지 말고 현재 config와 공식 문서를 확인한다.

## 9. 문서 및 변경 원칙

- 변경 전 관련 constitution/architecture/implementation 문서를 읽는다.
- 구현과 함께 필요한 plan/result/handoff 문서를 `docs/migration/implementation/`에 기록한다.
- 기존 문서를 조용히 삭제하거나 의미를 바꾸지 않는다. superseded 상태와 이유를 남긴다.
- 자동 분석 도구의 “unused” 결과만으로 파일/패키지를 삭제하지 않는다. import, config, CLI, peer dependency, 향후 계획을 함께 확인한다.
- 기능 하나와 무관한 대규모 정리·이름 변경·추상화 도입을 끼워 넣지 않는다.
- 사용자에게 보고할 때 실제 실행한 명령과 결과만 적는다. 실행하지 않은 검증을 통과했다고 보고하지 않는다.

## 10. 설정 파일 배치

설정 파일을 미관만을 이유로 일괄적으로 `configs/`로 이동하지 않는다. Next.js, TypeScript,
ESLint, Vitest, Drizzle Kit, Steiger, Sentry, Prettier, shadcn CLI처럼 프로젝트 루트에서
자동 탐색하는 도구의 진입점은 루트에 유지한다.

- `next.config.ts`, `tsconfig.json`, `eslint.config.mts`, `vitest.config.ts`, `drizzle.config.ts`,
  `steiger.config.ts`, `components.json`, `.prettierrc`, `.prettierignore`, `sentry*.config.ts`는 루트가 기본 위치다.
- 애플리케이션의 런타임 설정·feature flag·환경변수 해석은 `src/shared/config`에 둔다. domain- 또는
  route 전용 설정은 해당 slice의 `config/` 또는 route-private `_config/`에 둔다.
- 별도 `configs/`가 필요하면 CI/스크립트 등 명시적인 `--config` 호출이 보장되는 설정만 둔다.
- 설정을 이동할 때는 package script, IDE 자동 탐색, CI, 경로 기준(`tsconfigRootDir` 등)을 함께 갱신하고 검증한다.
