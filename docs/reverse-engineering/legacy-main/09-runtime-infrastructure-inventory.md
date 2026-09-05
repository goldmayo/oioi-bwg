---
title: Legacy Main Runtime / Infrastructure Inventory
document_id: RE-MAIN-009
version: 0.1.0
status: draft
authority: plan
source:
  repository: goldmayo/oioi-bwg
  branch: main
  commit: 4b299934846f4a0eed7132f58c5b1c2a481a3739
---

## Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-09-05 | Codex | main runtime·Cloudflare·DB·cache·환경·test·deployment inventory 작성 |

# Legacy Main Runtime / Infrastructure Inventory

## 1. Runtime / Build

| 항목 | 확인 내용 | 상태 |
|---|---|---|
| React | `react` 19.2.5 | `confirmed` |
| Next.js | `next` 16.1.6 dependency 및 App Router | `confirmed` |
| Vinext | `vinext` 0.0.43, dev/build/deploy script | `confirmed` |
| Vite | `vite` 8.0.2, `vite.config.ts` | `confirmed` |
| Cloudflare Vite plugin | `@cloudflare/vite-plugin`, RSC/SSR child environment | `confirmed` |
| Worker entry | `worker/index.ts` | `confirmed` |
| Runtime target | Cloudflare Workers via Vinext | `confirmed` |
| Node.js compatibility | Wrangler `nodejs_compat` flag enabled | `confirmed` |

주요 script는 `vinext dev`, `vinext build`, `vinext deploy`, `wrangler dev`다. `next dev/build/start` script도 존재하지만 기본 dev/build/deploy 경로는 vinext다.

## 2. Cloudflare

- Worker name: `oioibawige`, staging name: `oioibawige-staging` — `confirmed`
- `wrangler.jsonc` main: `./worker/index.ts` — `confirmed`
- compatibility flags: `nodejs_compat`, `no_handle_cross_request_promise_resolution` — `confirmed`
- Hyperdrive binding: `DB` — `confirmed`
- Assets binding: `ASSETS`, directory `.vinext/client` — `confirmed`
- Images binding: `IMAGES` — `confirmed`
- Production/staging custom domain route — `confirmed`
- Worker에서 `_vinext/image`를 직접 처리하고 나머지는 vinext handler에 위임 — `confirmed`
- 실제 binding이 해당 production resource를 가리키는지는 `unknown`

## 3. Database / Supabase

| 항목 | 경로/내용 | 상태 |
|---|---|---|
| ORM | `drizzle-orm/postgres-js` | `confirmed` |
| DB connection | `env.DB.connectionString` 우선, `DATABASE_URL` fallback | `confirmed` |
| Hyperdrive | `DB` binding을 Postgres connection proxy로 사용 | `confirmed` |
| Supabase browser client | `@supabase/ssr` browser client | `confirmed` |
| Supabase server client | cookies 기반 server client | `confirmed` |
| Supabase DB provider | 실제 DB가 Supabase Postgres인지 | `unknown` |
| RLS/policy | policy SQL 파일 또는 실행 code | `unknown` — main tree에서 확인되지 않음 |

## 4. Storage / Assets / External

- Album upload는 Supabase Storage `images` bucket, `album-covers/{timestamp}-{uuid}.{ext}` key — `confirmed`
- Next image optimization은 unoptimized 설정이며 R2 hostname remote pattern이 config에 존재 — `confirmed`
- Worker image optimization은 Cloudflare Images `IMAGES` binding — `confirmed`
- main application code에 직접 R2 SDK/API 호출 없음 — `confirmed`
- YouTube player와 Google Tag Manager script — `confirmed`

## 5. Environment variables

| 변수 | 사용 위치 | 노출 범위 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase browser/server/middleware client | public prefix |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 동일 | public prefix |
| `NEXT_PUBLIC_GTM_ID` | RootLayout | public prefix |
| `NEXT_PUBLIC_APP_ENV` | site/feature flag/Vite mode | public prefix |
| `DATABASE_URL` | Drizzle fallback | server/runtime |
| `DATABASE_DIRECT_URL` | `drizzle.config.ts` | tooling/server config |
| `SENTRY_AUTH_TOKEN` | Vite Sentry plugin | build secret |
| `FF_DEV_CAREON`, `NEXT_PUBLIC_FF_DEV_CAREON` | feature flag | mixed by prefix |

실제 값은 기록하지 않는다. `.env` 파일의 production 값과 Cloudflare secret 값은 `unknown`이다.

## 6. Cache

| 기능 | 근거 | 상태 |
|---|---|---|
| `use cache` | album detail, robots, sitemap | `confirmed` |
| `updateTag` | Song command 및 content action | `confirmed` |
| `revalidatePath` | content/auth/lyrics action | `confirmed` |
| `revalidateTag` | main tree search에서 확인되지 않음 | `confirmed` — 없음 |
| `unstable_cache` | main tree search에서 확인되지 않음 | `confirmed` — 없음 |
| `router.refresh` | explicit call 확인되지 않음; manager는 `window.location.reload` 사용 | `confirmed` |
| Explicit fetch cache option | relevant app data path에서 확인되지 않음 | `confirmed` — 없음 |
| Runtime effective cache behavior | Vinext/Next runtime의 최종 cache semantics | `unknown` |

## 7. Testing

- Vitest unit setup: `vitest.config.ts`, `vitest.setup.ts` — `confirmed`
- Test files: lyrics editor hook, in-app browser hook, lyrics parser, utils — `confirmed`
- k6 load/stress/spike scripts under `tests/k6` — `confirmed`
- Playwright/Jest/RTL test configuration — main tree에서 별도 확인되지 않음
- test DB 및 integration DB — `unknown`
- test mocking 방식 — 개별 test 확인 범위 외 상세는 `unknown`

## 8. CI/CD / Deployment

- `.github/workflows/deploy.yml`, `deploy-staging.yml` — `confirmed`
- `wrangler types` 후 vinext build/deploy — `confirmed`
- staging/prod env-cmd script — `confirmed`
- Wrangler deploy target 및 custom domains — `confirmed`
- Docker configuration — main tree에서 확인되지 않음
- 실제 배포 성공 상태와 runtime binding — `unknown`

## 9. Baseline limitations

- 이 문서는 production DB introspection이나 Cloudflare dashboard 조회 결과가 아니다.
- Supabase Auth/Storage와 PostgreSQL/Hyperdrive가 동일 project/resource인지 확인할 수 없다.
- 실제 RLS, secrets, binding resource, deployed Worker version은 main commit만으로 확정할 수 없다.
