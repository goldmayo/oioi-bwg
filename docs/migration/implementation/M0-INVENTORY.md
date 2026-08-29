---
title: "M0 Migration Inventory"
document_id: "M0-INVENTORY"
version: "1.0"
status: "active"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "00"
  - "01"
  - "12"
tags:
  - "migration"
  - "inventory"
  - "nextjs"
---

# M0 Migration Inventory

## 1. 목적과 기준

이 문서는 `12-deployment-migration-runbook.md`의 Phase M0 결과다. 현재 코드의 사실을 기록하고
M1 Runtime Normalization에서 유지, 이동, 제거하거나 추가 확인할 대상을 분류한다. 목표 구조를
현재 코드에 소급해 정당화하거나 이 문서에서 새 아키텍처를 결정하지 않는다.

조사 기준:

| 항목 | 값 |
|---|---|
| 기준 브랜치 | `migration_develop` |
| 기준 커밋 | `70d393d7031bef6aa785f88f068be507765e2bf0` |
| 조사일 | 2026-08-29 |
| 조사 방식 | tracked source/config 정적 조사 |
| 실행 검증 | 수행하지 않음 |

문서 작업 원칙에 따라 lint, typecheck, test, build를 실행하지 않았다. 로컬의 ignored `.next/`
산출물은 생성 시점과 명령이 보장되지 않으므로 M0 근거로 사용하지 않는다.

분류 vocabulary:

- **유지**: M1에서도 그대로 가져갈 수 있는 코드 또는 도구
- **이동/교체**: 제품 책임은 유지하지만 목표 architecture/runtime에 맞게 경계를 바꿀 대상
- **제거**: 목표 runtime에서 사용하지 않을 종속성 또는 설정
- **결정 필요**: 후속 phase 전에 제품 또는 운영 결정이 필요한 항목

## 2. Executive Summary

현재 애플리케이션의 UI와 route는 Next.js 16 App Router API를 사용하지만 기본 실행, 빌드,
배포 경로는 Vinext + Vite + Cloudflare Workers다.

| 영역 | 현재 상태 | M1 방향 |
|---|---|---|
| Framework API | Next.js 16 App Router, React 19 | 유지 |
| 기본 runtime | Vinext/Vite, Cloudflare Worker | Next.js Node standalone으로 교체 |
| Database | Drizzle + postgres.js + Hyperdrive binding | Drizzle/postgres.js 유지, Node DB 초기화로 교체 |
| Read path | RSC에서 DB query 함수 직접 호출 | M1 임시 경로로 유지 가능, M3에서 Service/Repository로 이동 |
| Write path | Server Action이 validation/DB/cache를 함께 소유 | M1 기능 보존, M3~M4에서 Service + Route Handler로 이동 |
| Auth | Supabase Auth, Proxy session refresh, admin layout role check | M1 기능 보존, M5에서 Auth.js + RequestContext + CASL로 교체 |
| Mutable asset | Supabase Storage `images` bucket | 임시 유지, provider 결정은 architecture 11에서 수행 |
| Cache | `cacheComponents`, `updateTag`, `revalidatePath` | application consistency 용도 제거 |
| Observability | `@sentry/nextjs`와 Cloudflare/Vite 설정 혼재 | Next.js SDK 경로 유지, Cloudflare/Vite 경로 제거 |
| Tests | Vitest unit test 5개, jsdom | M1 regression 자산으로 유지 |
| Deployment | Wrangler + Cloudflare Workers GitHub Actions | Docker/GHCR/Caddy/OCI 경로는 아직 없음 |

M1의 핵심 위험은 화면 코드 이전이 아니라 DB binding, 실행 script, worker entry, cache API,
Sentry build integration을 동시에 Node standalone에 맞게 분리하는 것이다.

## 3. Route Inventory

tracked `page.tsx`는 14개이며 Route Handler는 0개다. `src/app`은 이미 App Router 구조이므로
M1에서 route URL을 바꾸지 않는다.

| URL | 파일 | 데이터/동작 | 현재 rendering 신호 | M1 처리 |
|---|---|---|---|---|
| `/` | `src/app/(user)/page.tsx` | 공개 앨범/곡 목록 DB 조회 | RSC | 유지 |
| `/chants` | `src/app/(user)/chants/page.tsx` | 공개 앨범/곡 목록 DB 조회 | RSC | 유지 |
| `/albums/[slug]` | `src/app/(user)/albums/[slug]/page.tsx` | 앨범 DB 조회, dynamic metadata, 404 | RSC + Suspense | 유지 |
| `/songs/[slug]` | `src/app/(user)/songs/[slug]/page.tsx` | 곡 DB 조회, dynamic metadata, 404 | RSC + Suspense | 유지 |
| `/more` | `src/app/(user)/more/page.tsx` | 정적 UI | 별도 강제 없음 | 유지 |
| `/more/notice` | `src/app/(user)/more/notice/page.tsx` | 정적 mock content | 별도 강제 없음 | 유지 |
| `/more/policy` | `src/app/(user)/more/policy/page.tsx` | 정적 policy 목록 | 별도 강제 없음 | 유지 |
| `/more/policy/[slug]` | `src/app/(user)/more/policy/[slug]/page.tsx` | 정적 policy 상세 | `generateStaticParams` | 유지 |
| `/more/report` | `src/app/(user)/more/report/page.tsx` | 정적 UI | 별도 강제 없음 | 유지 |
| `/more/updates` | `src/app/(user)/more/updates/page.tsx` | 정적 mock content | 별도 강제 없음 | 유지 |
| `/admin` | `src/app/(admin)/admin/page.tsx` | `/admin/albums` redirect | redirect | 유지 |
| `/admin/albums` | `src/app/(admin)/admin/albums/page.tsx` | 전체 앨범 DB 조회/관리 | `force-dynamic`, noindex | 유지 |
| `/admin/songs` | `src/app/(admin)/admin/songs/page.tsx` | 전체 곡/앨범 DB 조회/관리 | `force-dynamic`, noindex | 유지 |
| `/admin/edit/[slug]` | `src/app/(admin)/admin/edit/[slug]/page.tsx` | 곡 DB 조회/편집, 404 | RSC | 유지 |

추가 App Router surface:

- root/user/admin layout, root loading/not-found
- `src/app/sitemap.ts`: DB에서 공개 곡을 읽는 dynamic sitemap
- `src/app/robots.ts`: production 여부에 따라 crawler policy 분기
- `src/app/apple-icon.png`, `public/favicon.ico`, `public/manifest.json`
- `proxy.ts`: 대부분의 요청에서 Supabase session refresh 실행

확인 사항:

- route-local private folder 구조는 아직 적용되지 않았다. 이는 M2 책임이며 M1에서 선행 이동하지 않는다.
- API Route Handler가 없으므로 현재 client mutation을 전달할 `/api/*` HTTP boundary가 없다.
- URL locale 전략은 확정되어 있지 않다. architecture 11/12에 따라 M2 전에 별도 결정한다.

## 4. Vinext / Vite / Cloudflare Runtime Inventory

### 4.1 직접 종속성과 설정

| 대상 | 근거 | 분류 |
|---|---|---|
| `vinext` | devDependency, 모든 기본 dev/build/deploy script | 제거 |
| `vite` | devDependency, `vite.config.ts` | runtime/build 경로에서 제거 |
| `@cloudflare/vite-plugin` | devDependency, Vite Cloudflare plugin | 제거 |
| `@vitejs/plugin-rsc` | devDependency | 제거 |
| `@sentry/vite-plugin` | devDependency, source map upload | `@sentry/nextjs` build integration으로 교체 |
| `wrangler` | devDependency, scripts, workflow | runtime/deploy 경로에서 제거 |
| `wrangler.jsonc` | Worker entry, Hyperdrive/Images/Assets/routes | 제거 후 운영 설정으로 대체 |
| `worker/index.ts` | Vinext handler와 `/_vinext/image` | 제거 |
| `worker-configuration.d.ts` | Cloudflare binding types | 제거 |
| `vite.config.ts` | Vinext/Cloudflare/Sentry/visualizer 조립 | 제거 |
| `.vinext`, `.wrangler`, `dist` | build artifact 경로 | 기존 ignore 유지, M1 완료 후 불필요 여부 정리 |

Vitest는 내부적으로 Vite를 사용할 수 있으나 application runtime의 Vite 유지 근거가 아니다.
M1의 `zero Vite runtime dependency`는 test runner 내부 구현과 분리해 판정한다.

### 4.2 package scripts

현재 기본 script의 상태:

- `dev`, `build`, `build:staging`, `build:prod`: Vinext 및 Wrangler type 생성에 결합
- `start`, `start:staging`, `start:prod`: `wrangler dev` 실행
- `deploy*`: `vinext deploy`
- `type-check`: Wrangler type 생성 선행
- `dev:next`, `build:next`, `start:next`: Next 명령이 별도 보조 script로만 존재

M1에서는 Next 명령을 기본 script로 승격하고 `next.config.mjs`에 `output: "standalone"`을
설정해야 한다. `next start`는 로컬 production 확인용으로 둘 수 있지만 배포 DoD는
`.next/standalone/server.js`를 기준으로 한다.

### 4.3 Next config 충돌

`next.config.mjs`는 Next 설정 파일이지만 현재 다음 정책은 Constitution과 충돌하거나 재검토가
필요하다.

- `experimental.cacheComponents: true`: application data consistency에 Next Data Cache를
  사용하지 않는 architecture 07과 함께 제거/비활성화 검토
- `experimental.staleTimes`: browser Router Cache 정책으로, M1 기능 보존 범위와 실제 필요를 재검토
- `images.unoptimized: true`와 Cloudflare R2 주석: 실제 source는 Supabase public URL과
  `assets.oioibawige.com`이 혼재하므로 provider 가정을 분리
- `serverExternalPackages: ["postgres"]`: Node standalone에서도 필요한지 build 단계에서 검증
- `output: "standalone"`: 현재 없음, 추가 필요

## 5. Database / Persistence Inventory

### 5.1 현재 구성

- PostgreSQL, Drizzle ORM, `postgres` driver 사용
- table: `Album`, `Song`; relation: Album 1:N Song
- tracked SQL migration 1개와 Drizzle meta 존재
- Drizzle Kit은 `DATABASE_DIRECT_URL`과 `src/shared/api/db/drizzle/schema.ts`를 사용
- application DB client는 `src/shared/api/db/drizzle/index.ts`의 `getDb()`가 매 호출마다 생성
- production connection은 `cloudflare:workers`의 `env.DB.connectionString`을 우선 사용
- `prepare: false`는 Hyperdrive/PgBouncer 전제를 주석으로 명시

### 5.2 현재 접근 경계

- query 7개: song/album 공개·관리 조회
- command 5개: album/song 생성·수정·삭제
- RSC가 query module을 직접 호출
- Server Action 일부는 command를 호출하지만, manage-content action은 Drizzle을 직접 호출
- Repository/Service/transaction boundary는 아직 없음
- Drizzle inferred row type을 client component props에서 직접 사용
- command module이 persistence와 `next/cache` invalidation을 함께 소유

### 5.3 분류

| 대상 | 분류 | 후속 phase |
|---|---|---|
| PostgreSQL/Drizzle/schema/migration | 유지 | M1/M3 |
| `postgres` driver | 유지 | M1에서 Node 연결 검증 |
| Hyperdrive binding과 `cloudflare:workers` import | 제거 | M1 |
| Node process DB singleton/pool | 추가 | M1 최소 구현, M3 정착 |
| query/command의 현재 제품 동작 | 유지 | M1 |
| Repository/Service/DTO mapping | 이동/추가 | M3 |
| transaction ownership | 추가 | M3 |
| DB row의 UI 직접 노출 | 이동/교체 | M3~M4 |
| persistence 내부 cache invalidation | 제거 | M1/M3 |

DB data migration은 완료된 것으로 보며 M1에서 data copy를 수행하지 않는다.

## 6. Server Action / Mutation Inventory

현재 Route Handler는 없고 다음 Server Action이 mutation transport다.

| 영역 | Action | 책임 |
|---|---|---|
| Auth | `signIn`, `signOut` | Supabase Auth, role 확인, redirect/cache |
| Album | `createAlbumAction`, `updateAlbumAction`, `deleteAlbumAction` | Zod, DB write, cache, Result-like 응답 |
| Song | `createSongAction`, `updateSongAction`, `deleteSongAction` | Zod/LRC parse, DB write, cache, Result-like 응답 |
| Lyrics | `saveSongData` | Zod, command 호출, cache, Result-like 응답 |
| Asset | `uploadAlbumImageAction` | 파일 검사, Supabase Storage upload/public URL |
| Feature flag | `withFeatureFlag` | server-only action wrapper |

M1은 runtime normalization phase이므로 기본 interaction을 보존하기 위해 Server Action을 즉시
전면 교체하지 않는다. 다만 `revalidatePath`, `updateTag`, DB binding 때문에 M1에서 최소 호환
수정은 필요하다. M3~M4에서 application logic을 Service로 옮기고 client mutation transport를
Route Handler + ky로 교체한다. Result-like `{ success, error }`와 broad catch/logging도 03/06/09
경계에 맞춰 후속 정리한다.

## 7. Auth / Authz Inventory

현재 구성:

- Supabase SSR browser/server client
- `proxy.ts`가 session cookie refresh
- Credentials-style email/password sign-in은 Supabase Auth Server Action 사용
- admin 여부는 `user.app_metadata.role === "admin"`으로 확인
- admin layout은 비관리자에게 로그인 form을 보여줌
- manage-content action 자체에는 최종 authorization check가 보이지 않음
- Supabase URL/anon key는 `NEXT_PUBLIC_*` environment variable 사용

분류:

- M1: Next Node runtime에서 기존 Supabase auth/session interaction을 임시 보존하고 회귀 확인
- M5: Auth.js, RequestContext, DB authorization facts, CASL로 교체
- M5 이전에도 mutation의 security가 layout/proxy 통과에만 의존하지 않는지 별도 위험으로 추적
- Proxy는 session refresh 역할일 뿐 목표 security boundary가 아니다

## 8. Assets / Content Inventory

### 8.1 Static assets

- `public/apple-icon.png`, `public/favicon.ico`, `public/manifest.json`, web app manifest icon
- `src/app/apple-icon.png`가 public asset과 중복 존재
- static asset은 Next `public`/metadata route 체계로 유지 가능

### 8.2 Mutable assets

- album image upload는 Supabase Storage `images` bucket 사용
- public URL을 반환해 DB `imgUrl`에 저장하는 흐름
- 5 MB 제한과 MIME prefix 검사 존재
- `next.config.mjs` remote pattern은 `assets.oioibawige.com`만 명시하고 image optimization은 비활성
- `.env` 계열에는 `NEXT_PUBLIC_ASSETS_URL`이 있으나 현재 upload action은 Supabase public URL 사용

Storage provider 선택은 architecture 11의 책임이다. M1에서 기능 보존을 위해 Supabase Storage를
임시 유지할 수 있지만, 이를 최종 provider 결정으로 간주하지 않는다. container filesystem을
mutable asset 영구 저장소로 사용하지 않는다.

## 9. Environment Inventory

`.env*` 파일은 모두 gitignored이며 tracked secret은 확인되지 않았다. 값은 조사/문서에 기록하지
않고 key만 분류한다.

| 범주 | 현재 key | M1 처리 |
|---|---|---|
| DB | `DATABASE_URL`, `DATABASE_DIRECT_URL` | 유지, server runtime/build/migration lifecycle 분리 |
| Cloudflare DB | `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB` | 제거 |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | M1 임시 유지, M5/asset 결정 후 정리 |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN` | Next SDK/build 기준으로 재분류 |
| Cloudflare deploy | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ENV` | 제거 |
| Product/client | `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_ASSETS_URL` | 실제 client exposure와 image portability 재검토 |
| Feature flag | `FF_DEV_CAREON`, fallback `NEXT_PUBLIC_FF_DEV_CAREON` | server/client ownership 재검토 |

현재 env schema/startup validation은 없다. M1에서는 필요한 Node runtime key의 최소 검증을
도입할지 결정하고, 전체 env architecture 정착은 M8에서 수행한다. 같은 Docker image를 환경별로
재사용해야 하는 값은 `NEXT_PUBLIC_*` build-time 값에 의존하지 않는다.

## 10. Test / Quality Inventory

- Vitest + jsdom + React Testing Library setup
- unit test 5개
  - admin editor hook
  - in-app browser hook
  - lyrics editor hook
  - LRC parser
  - shared utils
- coverage 대상은 shared hooks/utils와 feature `use*` 파일
- Playwright config/E2E 없음
- PostgreSQL integration test infrastructure 없음
- k6 load/stress/spike scripts와 staging target 존재
- ESLint/Next config와 Husky/lint-staged 존재
- Steiger는 아직 dependency/script에 없음

M1에서는 기존 unit test 파일을 유지한다. 테스트 실행은 M1 implementation 변경의 검증 단계에서
별도 수행하며, 이 M0 문서 작성 중에는 실행하지 않았다. DB/Auth/runtime 회귀를 보호할 integration
또는 smoke test가 없다는 점을 M1 위험으로 본다.

## 11. Deployment / Operations Inventory

현재 GitHub Actions:

- staging branch push → `vinext deploy --env staging`
- `v*` tag → production `vinext deploy`
- pnpm 10, Node 22, Wrangler type generation
- Cloudflare credentials/Hyperdrive/Supabase/Sentry/GTM env 주입
- Slack start/success/failure notification

현재 존재하지 않는 목표 배포 자산:

- Dockerfile
- Docker Compose
- Caddyfile
- GHCR image build/push workflow
- OCI deploy workflow/runbook implementation
- standalone process/container health check
- PostgreSQL backup/restore 검증 자동화 또는 절차
- previous image rollback 절차

이 항목들은 M9 책임이다. M1에서는 standalone build/boot 가능 상태까지만 만든다. 기존 Cloudflare
workflow는 새 OCI 배포가 준비되기 전까지 운영 영향이 있으므로 실제 제거 시점을 배포 전환 계획과
조율한다.

## 12. 유지 / 이동 / 제거 Matrix

### 유지

- Next.js 16 App Router routes와 URL
- React 19, TypeScript, pnpm, Tailwind/shadcn 계열 UI 자산
- PostgreSQL, Drizzle schema/migration, postgres driver
- 제품 query/mutation 동작과 Supabase Storage upload 동작
- `@sentry/nextjs` 기반 observability 코드
- Vitest/RTL unit test 자산
- sitemap, robots, metadata, static assets

### 이동/교체

- Hyperdrive DB bootstrap → Node process DB singleton/pool
- Server Action 내부 application logic → Service
- client mutation Server Action → Route Handler + ky
- shared DB query/command → `src/server/repositories`와 `src/server/services`
- Drizzle row client props → Zod DTO contract
- Supabase Auth → Auth.js/RequestContext/CASL
- Vite Sentry source map upload → Next.js Sentry integration
- Cloudflare deployment → Docker/GHCR/Caddy/OCI

### 제거

- Vinext package/scripts/worker entry
- application runtime의 Vite config/plugins
- Wrangler runtime/deploy/type generation 결합
- Cloudflare Worker/Hyperdrive/Images/Assets bindings
- `cloudflare:workers` application import
- Next Data Cache 기반 `updateTag`/`revalidatePath` application consistency
- Cloudflare 전용 Sentry dependency/configuration

### 결정 필요

- M2 전 URL locale 전략
- architecture 11의 uploaded asset provider
- M1 동안 Supabase Auth/Storage를 보존할 정확한 compatibility 기간
- Node DB pool 크기와 OCI/PostgreSQL connection settings
- supported Node/browser runtime 하한
- `NEXT_PUBLIC_APP_ENV`와 feature flag lifecycle
- `images.unoptimized`와 remote asset policy

## 13. M1 착수 순서와 검증 입력

권장 변경 순서:

1. package scripts와 Next config를 Next 16/Turbopack/standalone 기준으로 전환
2. Cloudflare binding 없는 Node DB bootstrap 추가
3. `cloudflare:workers`, Vinext worker, Vite/Cloudflare build 설정 제거
4. `updateTag`/`revalidatePath` 결합을 M1 기능 보존 범위에서 최소화
5. Sentry를 Next.js build/runtime 경로로 정리
6. ignored generated type/build artifact와 tsconfig include 정리
7. 공개 viewer/mock/admin의 기본 render 및 interaction 확인
8. `.next/standalone/server.js` boot 확인

M1 검증은 architecture 12의 DoD를 따르되 다음을 명시적으로 확인한다.

- zero Vinext application runtime dependency
- zero Vite application runtime dependency
- zero Cloudflare application runtime dependency
- 기존 14개 route URL 유지
- public DB read 동작
- admin auth/session과 기본 CRUD interaction 동작
- album image upload compatibility 또는 명시적 temporary limitation
- sitemap/robots/metadata 동작
- Sentry startup이 Node runtime을 crash시키지 않음
- standalone server boot

## 14. M0 완료 판정

Runbook M0의 routes, Vinext/Vite, Cloudflare runtime, DB access, Server Actions, auth, assets, env,
tests, deployment files를 식별하고 후속 phase를 분류했다. 실행 검증 결과가 아니라 정적 baseline
inventory이므로, 실제 runtime에서 새 사실이 발견되면 이 문서를 evidence와 함께 갱신한다.
