---
title: "M1 Runtime Normalization Implementation Plan"
document_id: "M1-RUNTIME-NORMALIZATION"
version: "1.0"
status: "active"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "00"
  - "01"
  - "06"
  - "07"
  - "09"
  - "11"
  - "12"
  - "M0-INVENTORY"
tags:
  - "migration"
  - "nextjs"
  - "runtime"
  - "standalone"
---

# M1 Runtime Normalization Implementation Plan

## 1. 이 문서의 사용법

이 문서는 Vinext/Vite/Cloudflare Workers runtime을 Next.js 16 Node standalone runtime으로
바꾸는 작업 지시서다. 프로젝트를 처음 본 개발자도 위에서 아래로 체크하며 실행할 수 있도록
작성했다.

작업자는 다음 세 규칙을 먼저 이해해야 한다.

1. 체크박스를 건너뛰지 않는다.
2. 한 단계의 검증이 실패하면 다음 단계로 넘어가지 않는다.
3. 이 문서에 없는 architecture 개선을 M1에 끼워 넣지 않는다.

M1의 성공은 “코드가 더 예뻐짐”이 아니다.

```text
Vinext/Vite/Cloudflare runtime 제거
→ Next.js 16 + Turbopack으로 install/lint/test/build 성공
→ Next Node runtime에서 기존 주요 화면과 interaction 동작
→ .next/standalone/server.js로 boot
```

## 2. 절대 범위

### 2.1 M1에서 한다

- 기본 dev/build/start 명령을 Next.js 16으로 전환
- `output: "standalone"` 활성화
- application runtime의 Vinext/Vite/Cloudflare dependency 제거
- Hyperdrive DB binding을 `DATABASE_URL` 기반 Node DB client로 교체
- Cloudflare 전용 worker/config/type 제거
- Vite 전용 Sentry build integration 제거
- Next Data Cache 기반 application consistency 제거
- 기존 route URL과 mock/temporary product path 보존
- Next dev/build/standalone runtime 검증

### 2.2 M1에서 하지 않는다

- FSD 디렉터리 전면 이동: M2
- Repository/Service/transaction/DTO 구조 완성: M3
- Route Handler + ky + TanStack Query 전환: M4
- Supabase Auth를 Auth.js/CASL로 교체: M5
- UI/component 대규모 리팩터링: M6
- 전체 test infrastructure 구축: M7
- storage provider 최종 선정: M8 이전 architecture 11 결정
- Docker/Caddy/OCI production deploy 완성: M9
- DB data copy 또는 data migration 재수행

M1에서 Server Action과 Supabase Auth/Storage는 기존 interaction 보존을 위한 temporary path로
남을 수 있다. 남아 있다는 사실을 “최종 architecture로 승인됨”으로 해석하지 않는다.

## 3. 시작 전 준비

### 3.1 브랜치 순서

M0 PR과 Next.js 16 latest 변경이 `migration_develop`에 merge된 뒤 시작한다.

```bash
git switch migration_develop
git pull --ff-only
git switch -c migration_m1-runtime-normalization
```

주의:

- M0 branch 위에서 M1 branch를 이어 만들지 않는다.
- branch 이름은 반드시 `migration_` 접두사를 사용한다.
- M1 PR의 base branch는 `migration_develop`이다.
- production/staging deployment workflow는 이 PR에서 실행하지 않는다.

### 3.2 작업 트리 확인

```bash
git status --short --branch
git log -1 --oneline --decorate
node --version
pnpm --version
```

기대 결과:

- branch: `migration_m1-runtime-normalization`
- 시작 시 작업 트리 clean
- Node.js: Next.js 16.3.3 요구사항인 `>=20.9.0`
- package manager: pnpm

clean이 아니면 누가 만든 변경인지 확인하기 전까지 진행하지 않는다. 다른 사람의 변경을
`git reset --hard`, `git checkout --`, `git clean`으로 지우지 않는다.

### 3.3 baseline 확인

```bash
node -p "require('./node_modules/next/package.json').version"
pnpm list next eslint-config-next --depth 0
git ls-files 'src/app/**/page.tsx' | wc -l
git ls-files 'src/app/**/route.ts' | wc -l
```

기대 결과:

- `next`: `16.3.3`
- `eslint-config-next`: `16.3.3`
- page: 14
- Route Handler: 0

버전이나 route count가 다르면 M0 이후 변경이 생긴 것이다. 숫자를 억지로 맞추지 말고
`M0-INVENTORY.md`와 현재 코드를 다시 비교한다.

### 3.4 secret 취급

- `.env*` 값을 문서, commit, PR description, 터미널 캡처에 붙이지 않는다.
- `DATABASE_URL`은 application runtime 연결 문자열이다.
- `DATABASE_DIRECT_URL`은 Drizzle Kit용 direct connection으로 유지한다.
- M1에서는 `CLOUDFLARE_*` 값을 새 코드의 fallback으로 사용하지 않는다.
- 실제 production DB를 local verification 대상으로 사용하지 않는다.

## 4. 전체 작업 지도

| 순서 | Checkpoint | 핵심 결과 | 실패하면 |
|---:|---|---|---|
| 0 | Baseline | clean branch와 version 확인 | 작업 시작 금지 |
| 1 | Node DB | `cloudflare:workers` 없이 DB client 생성 | runtime 제거 금지 |
| 2 | Next config/scripts | Next/Turbopack/standalone이 기본값 | dependency 삭제 금지 |
| 3 | Runtime removal | Vinext/Worker/Vite/Wrangler 직접 의존 0 | cache/Sentry 후속 금지 |
| 4 | Cache cleanup | Next Data Cache consistency 호출 0 | 최종 검증 금지 |
| 5 | Sentry/runtime cleanup | Cloudflare/Vite observability 잔재 0 | 최종 검증 금지 |
| 6 | Static gates | install/typecheck/lint/unit/build 성공 | boot 금지 |
| 7 | Runtime smoke | dev/standalone 주요 화면과 interaction 확인 | M1 완료 금지 |
| 8 | Handoff | evidence와 temporary debt 기록 | PR merge 금지 |

## 5. Checkpoint 1 — Node DB Bootstrap

### 5.1 목적

현재 `src/shared/api/db/drizzle/index.ts`는 `cloudflare:workers`의 `env.DB`와 Hyperdrive를
가정한다. 이를 먼저 제거하지 않고 Vinext/Cloudflare package를 삭제하면 모든 DB-backed RSC가
import 단계에서 실패한다.

M1의 DB 목표는 다음뿐이다.

```text
DATABASE_URL
→ postgres.js process-level singleton
→ Drizzle
```

Repository/Service로 파일을 옮기지 않는다. 그 작업은 M3다.

### 5.2 수정 파일

- `src/shared/api/db/drizzle/index.ts`

### 5.3 삭제할 내용

- `import { env } from "cloudflare:workers"`
- `env.DB.connectionString`
- `Hyperdrive` type
- Vinext/Cloudflare/Miniflare 설명 주석
- Hyperdrive 전용 `prepare: false`
- 근거 없이 고정된 Cloudflare 권장 `max: 5`
- DB singleton 용도의 React `cache()`

React `cache()`는 request-level memoization 도구이지 process-level DB connection singleton이
아니다.

### 5.4 목표 구현 형태

다음은 책임과 흐름의 기준 예시다. 이름은 현재 import 호환성을 위해 `getDb()`를 유지한다.

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as typeof globalThis & {
  __oioiDb?: Db;
};

export function getDb(): Db {
  if (!globalForDb.__oioiDb) {
    globalForDb.__oioiDb = createDb();
  }

  return globalForDb.__oioiDb;
}
```

구현 시 주의:

- global key는 프로젝트 전용 이름을 사용한다.
- `DATABASE_URL!` non-null assertion만 두지 말고 읽을 수 있는 startup/runtime error를 만든다.
- M1에서 pool size, prepare mode, idle timeout을 임의 최적화하지 않는다.
- query/command 함수 signature를 바꾸지 않는다.
- schema와 migration을 수정하지 않는다.

### 5.5 정적 확인

```bash
rg -n 'cloudflare:workers|Hyperdrive|CLOUDFLARE_HYPERDRIVE|react.*cache' \
  src/shared/api/db/drizzle/index.ts
rg -n 'DATABASE_URL' src/shared/api/db/drizzle/index.ts
```

기대 결과:

- 첫 명령: 결과 0건
- 둘째 명령: `DATABASE_URL` validation 1개 이상

### 5.6 Checkpoint 1 완료 조건

- [ ] DB bootstrap에서 Cloudflare import가 사라짐
- [ ] `getDb()` public signature 유지
- [ ] process-level singleton 존재
- [ ] `DATABASE_URL` 누락 오류가 명시적임
- [ ] schema/migration 변경 없음

추천 commit:

```text
refactor(migration): Node runtime용 Drizzle client로 전환
```

## 6. Checkpoint 2 — Next.js 기본 Runtime과 Standalone 설정

### 6.1 package scripts

`package.json` scripts를 다음 책임으로 정리한다.

최소 목표:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node .next/standalone/server.js",
    "lint": "eslint",
    "type-check": "tsc --noEmit",
    "test:unit": "vitest",
    "test:unit:run": "vitest run"
  }
}
```

규칙:

- Next.js 16은 `next dev`와 `next build`에서 Turbopack이 기본이므로 `--turbopack`을 의식적으로
  중복 추가하지 않는다.
- `dev:next`, `build:next`, `start:next` 같은 과도기 alias는 기본 script 전환 후 제거한다.
- `start`는 M1 DoD와 동일하게 standalone server를 실행한다.
- `next start`는 `output: "standalone"`의 최종 boot 명령으로 사용하지 않는다.
- `build:staging`, `build:prod`가 env file 주입만을 위해 존재한다면 제거한다. 환경별 runtime
  configuration은 M8/M9에서 정리한다.
- `deploy*` Cloudflare script는 Checkpoint 3에서 제거한다.
- k6와 DB 관리 script는 이번 변경 이유가 없으므로 유지한다.

### 6.2 next.config.mjs

최소 목표 형태:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactCompiler: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.oioibawige.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
```

반드시 수행:

- top-level `output: "standalone"` 추가
- `experimental.cacheComponents` 제거
- `experimental.staleTimes` 제거
- `experimental.instrumentationHook` 제거
- Cloudflare/R2/serverless 전용이라고 단정하는 낡은 주석 제거

설명:

- Next.js 16.3.3의 installed config type에서 `cacheComponents`는 top-level option이며 기본값은
  `false`다. 이 프로젝트는 Next Data Cache를 application cache로 사용하지 않으므로 켜지 않는다.
- `staleTimes`는 현재 product evidence 없이 정한 magic value이므로 제거한다.
- `instrumentation.ts`는 현재 Next runtime에서 config flag 없이 발견된다. 존재하는 파일 자체는
  유지하고 Cloudflare 주석만 후속 정리한다.
- `serverExternalPackages: ["postgres"]`는 첫 standalone build에서 필요 여부를 확인한다. build가
  성공하면 M1에서는 유지해도 된다. 이유 없이 제거하고 bundling 문제를 만들지 않는다.
- image provider 최종 결정은 M1이 아니다. 현재 behavior 보존을 위해 설정을 유지한다.

### 6.3 tsconfig.json

Checkpoint 3의 worker file 삭제와 함께 다음 include를 제거한다.

- `worker`
- `worker-configuration.d.ts`

유지:

- `src`
- `next-env.d.ts`
- `**/*.mts`

`next-env.d.ts`는 generated/ignored file이므로 직접 작성하거나 commit하지 않는다.

### 6.4 Checkpoint 2 확인

```bash
node -e "const p=require('./package.json'); console.log(p.scripts.dev, p.scripts.build, p.scripts.start, p.scripts['type-check'])"
rg -n 'output|cacheComponents|staleTimes|instrumentationHook' next.config.mjs
```

기대 결과:

- `next dev`
- `next build`
- `node .next/standalone/server.js`
- `tsc --noEmit`
- config에는 `output: "standalone"`만 있고 제거 대상 option은 없음

### 6.5 Checkpoint 2 완료 조건

- [ ] Next 명령이 기본 script
- [ ] Turbopack이 기본 bundler
- [ ] standalone output 설정됨
- [ ] Next Data Cache/stale time 실험 설정 제거됨
- [ ] Wrangler type generation이 typecheck에서 제거됨

추천 commit:

```text
build(migration): Next standalone runtime을 기본값으로 설정
```

## 7. Checkpoint 3 — Vinext/Vite/Cloudflare Runtime 제거

### 7.1 삭제 전 usage 검색

아래 명령을 먼저 실행하고 결과를 PR evidence로 남긴다.

```bash
rg -n 'vinext|cloudflare:workers|@cloudflare/vite-plugin|wrangler|\.vinext|_vinext' \
  package.json src worker vite.config.ts wrangler.jsonc tsconfig.json .github
```

검색 결과가 M0 Inventory와 다르면 새 usage를 먼저 분류한다.

### 7.2 package 제거

application runtime/build에서 직접 사용하지 않을 package:

```bash
pnpm remove @sentry/cloudflare
pnpm remove -D \
  @cloudflare/vite-plugin \
  @sentry/vite-plugin \
  @vitejs/plugin-rsc \
  env-cmd \
  react-server-dom-webpack \
  rollup-plugin-visualizer \
  vinext \
  vite \
  wrangler
```

주의:

- `vitest`는 내부 dependency로 Vite를 설치할 수 있다. lockfile에 transitive `vite`가 남는 것은
  application runtime dependency가 남았다는 뜻이 아니다.
- 판정 기준은 `package.json` direct dependency, application config, application import, 실행
  script다.
- `@sentry/nextjs`는 제거하지 않는다.
- Supabase package는 M1에서 제거하지 않는다.
- `postgres`, `drizzle-orm`, `drizzle-kit`은 제거하지 않는다.

### 7.3 파일 제거

다음 파일은 M1에서 삭제한다.

- `vite.config.ts`
- `wrangler.jsonc`
- `worker/index.ts`
- `worker-configuration.d.ts`

`worker/`가 비면 디렉터리도 사라진다.

### 7.4 `.gitignore` 정리

현재 ignore 중 다음은 더 이상 새 runtime artifact가 아니다.

- `/.vinext/`
- `/.wrangler/`
- `/dist/`가 Vite build만을 위한 항목인지 확인

원칙:

- 이미 로컬에 남은 ignored artifact를 M1 코드 작업 중 강제로 삭제할 필요는 없다.
- ignore rule을 지워도 로컬 artifact가 tracked로 바뀌지 않았는지 `git status`로 확인한다.
- `/dist/`를 다른 tool이 사용하면 유지한다.

### 7.5 GitHub Actions 처리

현재 두 workflow는 Cloudflare production/staging deploy를 수행한다.

- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy.yml`

M1의 목표는 application runtime normalization이고 M9 배포 구현은 아직 없다. 따라서 무조건
새 OCI workflow를 만들지 않는다.

선택 기준:

1. `migration_develop` merge가 staging/production deploy를 trigger하지 않는 현재 구조라면 기존
   workflow를 M9 전까지 legacy deployment file로 보존할 수 있다.
2. workflow가 package에서 제거된 `vinext`를 실행해 실패할 위험이 있으면 workflow를 disabled
   상태로 명확히 전환하거나 별도 운영 PR에서 제거한다.
3. staging branch push와 `v*` tag trigger를 임의 실행하지 않는다.

M1 PR에는 “Cloudflare workflow 보존/비활성/삭제 중 무엇을 선택했는지”와 이유를 반드시 적는다.
애매하게 깨진 workflow를 active 상태로 남기지 않는다.

### 7.6 제거 확인

```bash
rg -n 'vinext|cloudflare:workers|@cloudflare/vite-plugin|wrangler|\.vinext|_vinext' \
  package.json src tsconfig.json next.config.mjs .github
pnpm list vinext wrangler @cloudflare/vite-plugin --depth 0
```

기대 결과:

- application/package/config/script: 0건
- legacy workflow를 의도적으로 보존했다면 `.github` 결과만 허용하고 PR에 예외 기록
- `pnpm list ... --depth 0`: direct dependency 없음

### 7.7 Checkpoint 3 완료 조건

- [ ] Vinext direct dependency/import/script 0
- [ ] Vite application config/direct dependency 0
- [ ] Cloudflare Worker binding/import/type 0
- [ ] worker/vite/wrangler file 제거
- [ ] lockfile이 pnpm으로 갱신됨
- [ ] deployment workflow 처리 결정 기록

추천 commit:

```text
chore(migration): Vinext와 Cloudflare runtime 제거
```

## 8. Checkpoint 4 — Next Data Cache Consistency 제거

### 8.1 제거 대상

architecture 07에 따라 application data consistency 용도로 다음 API를 사용하지 않는다.

```text
unstable_cache
use cache
cacheTag
revalidateTag
updateTag
revalidatePath
```

현재 직접 대상:

- `src/shared/api/db/drizzle/commands.ts`
- `src/features/manage-content/actions.ts`
- `src/features/manage-lyrics/actions.ts`
- `src/features/auth/actions.ts`
- `next.config.mjs`

### 8.2 persistence에서 cache 책임 제거

`src/shared/api/db/drizzle/commands.ts`에서:

- `next/cache` import 삭제
- `updateTag()` 삭제
- `revalidatePath()` 삭제
- cache invalidation을 설명하는 주석 삭제
- DB write 결과와 현재 function signature는 가능한 한 유지

Repository/Service 구조를 새로 만들지 않는다. M1에서는 persistence가 cache를 모르게 만드는
최소 변경만 한다.

### 8.3 temporary Server Action 처리

Server Action의 DB write 자체는 보존한다. `next/cache` 호출을 삭제한 뒤 UI가 새 데이터를 다시
읽어야 하는 지점을 확인한다.

현재 action consumer:

- `AlbumFormDialog.tsx`
- `SongFormDialog.tsx`
- `AlbumManagerClient.tsx`
- `SongManagerClient.tsx`
- `useAdminEditor.ts`
- `LoginForm.tsx`
- `SidebarWrapper.tsx`

M4의 TanStack Query 전환 전 temporary 원칙:

- action 성공 후 dialog close/toast만으로 충분하고 다음 navigation에서 새 RSC를 읽으면 추가하지 않음
- 현재 화면의 RSC data가 즉시 갱신되어야 하면 client에서 `router.refresh()`를 명시적으로 호출
- `router.refresh()`는 temporary compatibility이며 M4에서 Query invalidation으로 교체할 TODO와
  삭제 phase를 남김
- DB command 안에서 router/cache를 조작하지 않음
- 모든 action 성공에 무조건 root refresh를 넣지 않음

Auth의 sign-in/sign-out은 이미 `redirect()`를 사용하므로 `revalidatePath()` 삭제 후 cookie/redirect
동작을 smoke test한다. 불필요한 `router.refresh()`를 먼저 추가하지 않는다.

### 8.4 검색 확인

```bash
rg -n 'unstable_cache|use cache|cacheTag|revalidateTag|updateTag|revalidatePath' \
  src next.config.mjs
```

기대 결과: 0건.

문자열이 architecture 설명 주석에만 남아도 실제 코드와 혼동되므로 낡은 주석을 제거한다.

### 8.5 Checkpoint 4 완료 조건

- [ ] persistence에서 Next cache import 0
- [ ] application source에서 금지 cache API 0
- [ ] 필요한 화면만 temporary `router.refresh()` 적용
- [ ] temporary refresh의 M4 삭제 시점 기록
- [ ] Server Action product behavior 보존

추천 commit:

```text
refactor(migration): Next Data Cache invalidation 제거
```

## 9. Checkpoint 5 — Sentry와 Runtime 잔재 정리

### 9.1 유지할 것

- `@sentry/nextjs`
- `src/instrumentation.ts`
- `sentry.server.config.ts`
- client/edge config는 실제 Next/Sentry 16.3 integration에서 로드되는지 검증 후 정리
- `onRequestError`를 통한 request error capture

### 9.2 제거/수정할 것

- `@sentry/cloudflare`
- `@sentry/vite-plugin`
- Vite source map upload config
- Cloudflare Worker crash/I/O limitation을 전제로 한 낡은 주석
- Cloudflare 때문에 무조건 tracing을 껐다는 설명
- 사용되지 않는 edge config는 실제 import/Next convention 확인 후 제거 여부 결정

M1에서 observability architecture를 새로 만들지 않는다. 기존 `@sentry/nextjs` 기능을 Next Node
runtime에서 crash 없이 유지하는 것이 목표다.

### 9.3 runtime-specific import 전체 검색

```bash
rg -n \
  'cloudflare:workers|@sentry/cloudflare|@sentry/vite-plugin|Hyperdrive|Miniflare|workerd|vinext|wrangler' \
  src package.json next.config.mjs tsconfig.json sentry*.ts
```

기대 결과: 0건.

legacy docs, changelog, M0 Inventory의 역사 기록은 삭제 대상 검색과 분리한다. 과거 상태를 설명하는
문서를 “zero runtime dependency” 숫자에 포함하지 않는다.

### 9.4 Checkpoint 5 완료 조건

- [ ] Sentry application SDK는 `@sentry/nextjs` 하나
- [ ] Vite Sentry build plugin 제거
- [ ] runtime code의 Cloudflare 전용 설명/import 0
- [ ] source map upload가 필요하면 Next/Sentry 방식으로만 설정
- [ ] secret을 `NEXT_PUBLIC_*`로 새로 노출하지 않음

추천 commit:

```text
refactor(migration): Sentry를 Next Node runtime 기준으로 정리
```

## 10. Checkpoint 6 — 정적 Quality Gates

이 절부터는 구현 작업에서 실제로 실행한다. 하나라도 실패하면 원인을 고치기 전까지 다음 명령을
성공으로 간주하지 않는다.

### 10.1 install

```bash
pnpm install --frozen-lockfile
```

통과 기준:

- exit code 0
- lockfile 변경 없음
- Vinext/Cloudflare direct peer warning이 더 이상 없음

Vitest가 transitive Vite를 설치하는 것은 허용된다. direct application peer warning과 구분한다.

### 10.2 typecheck

```bash
pnpm type-check
```

통과 기준:

- Wrangler type generation 없이 `tsc --noEmit` 성공
- `Hyperdrive`, `Fetcher`, worker binding type reference 0

### 10.3 lint

```bash
pnpm lint
```

통과 기준: exit code 0. 자동 fix를 먼저 실행하지 않는다. 실패 내용을 읽고 필요한 파일만 수정한다.

### 10.4 unit test

```bash
pnpm test:unit:run
```

통과 기준: 기존 5개 test file 전체 성공.

### 10.5 build

```bash
pnpm build
```

통과 기준:

- Next.js 16.3.3 build 성공
- Turbopack build
- `.next/standalone/server.js` 존재
- worker/Vinext bundle이 생성되지 않음
- build 중 DB/Auth/Sentry import crash 없음

확인:

```bash
test -f .next/standalone/server.js
test ! -d .vinext
```

주의:

- 이전 작업에서 남은 ignored `.vinext`가 있으면 두 번째 명령이 실패할 수 있다. 이때 source/config
  dependency와 과거 local artifact를 구분한다.
- build를 통과시키려고 DB/Auth를 fake success로 바꾸지 않는다.
- production secret을 local build에 넣지 않는다.

## 11. Checkpoint 7 — Runtime Smoke Test

### 11.1 dev runtime

터미널 A:

```bash
pnpm dev
```

터미널 B:

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/robots.txt
curl -I http://localhost:3000/sitemap.xml
```

브라우저에서 확인:

- `/`
- `/chants`
- 실제 존재하는 `/albums/[slug]`
- 실제 존재하는 `/songs/[slug]`
- `/more`, `/more/notice`, `/more/policy`, `/more/report`, `/more/updates`
- `/admin`
- `/admin/albums`
- `/admin/songs`
- 실제 존재하는 `/admin/edit/[slug]`

각 route에 대해 기록:

| Route | HTTP/화면 | console error | server error | 결과 |
|---|---|---|---|---|
| `/` |  |  |  | PASS/FAIL |

동일 표에 14개 route를 모두 추가한다. DB fixture가 없어 dynamic slug를 확인할 수 없으면 PASS로
쓰지 말고 `BLOCKED: fixture 없음`으로 기록한다.

### 11.2 interaction smoke

최소 확인:

- anonymous public navigation
- admin sign-in 실패 메시지
- authorized admin sign-in과 redirect
- album create/update/delete
- song create/update/delete
- lyrics save
- album image upload
- sign-out과 redirect

실제 data를 바꾸는 smoke test는 production DB에서 하지 않는다. 전용 local/staging fixture를
사용하고 생성한 test data를 기록한다.

### 11.3 standalone runtime

Next standalone 산출물은 서버 코드와 필요한 node_modules만 `.next/standalone`에 포함한다. 로컬에서
직접 `server.js`를 실행할 때는 `public`과 `.next/static`을 standalone 내부에 먼저 staging한다.
Docker image에서도 동일한 파일 복사를 image build 단계에 포함해야 한다.

```bash
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/
```

build 후 터미널 A:

```bash
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js
```

터미널 B:

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/robots.txt
curl -I http://127.0.0.1:3000/sitemap.xml
```

standalone에서도 dev와 같은 핵심 viewer/admin smoke를 반복한다. dev 성공을 standalone 성공으로
대체하지 않는다.

### 11.4 runtime process 종료

foreground process는 `Ctrl-C`로 정상 종료한다. port를 점유한 process를 무차별 `killall node`로
종료하지 않는다.

## 12. 실패별 진단표

| 증상 | 먼저 확인 | 하지 말 것 |
|---|---|---|
| `cloudflare:workers` resolve 실패 | DB index/worker 잔재 검색 | package alias로 가짜 module 만들기 |
| `Hyperdrive` type 없음 | tsconfig와 generated worker type 제거 | global dummy type 추가 |
| `DATABASE_URL is required` | local test DB env 존재 여부 | production URL 복사 |
| connection 폭증 | DB singleton/HMR global 확인 | 임의로 pool size만 크게 변경 |
| `next start` standalone warning | `pnpm start` script 확인 | warning 무시 |
| `.next/standalone/server.js` 없음 | `output: "standalone"` 위치 | generated file commit |
| `use cache`/cacheComponents build 문제 | config와 directive 검색 | cache를 다시 켜서 우회 |
| mutation 후 화면 stale | 해당 consumer에만 temporary refresh | DB command에서 root revalidation 복구 |
| Sentry build crash | Vite/Cloudflare plugin 잔재 | error capture 전체 삭제 |
| static route가 DB를 요구 | sitemap/metadata build 실행 확인 | fake production data 하드코딩 |
| image host 오류 | 실제 URL host와 remote pattern | 모든 host wildcard 허용 |
| Vinext peer warning | direct dependency와 lock importer 확인 | transitive Vite까지 무조건 제거 |

같은 실패를 세 번 임시 수정으로 덮지 않는다. architecture와 충돌하거나 M1 범위를 넘는 해결만
가능하면 작업을 멈추고 blocker를 기록한다.

## 13. 변경 금지선

M1 PR에서 다음 diff가 보이면 제거하거나 별도 phase로 돌린다.

- `src/pages` 신규 생성
- `src/server` 전체 framework 선설계
- generic Repository/DI/container/decorator
- 모든 page를 client component로 변경
- DB row/contract 대규모 재설계
- Auth.js/CASL 동시 도입
- TanStack Query/ky/Route Handler 전면 도입
- Docker/Caddy/Compose 완성
- unrelated UI style 변경
- 기존 route URL 변경
- production DB migration

## 14. Commit과 PR 구성

한 PR 안에서 다음 순서의 작은 commit을 권장한다.

1. `refactor(migration): Node runtime용 Drizzle client로 전환`
2. `build(migration): Next standalone runtime을 기본값으로 설정`
3. `chore(migration): Vinext와 Cloudflare runtime 제거`
4. `refactor(migration): Next Data Cache invalidation 제거`
5. `refactor(migration): Sentry를 Next Node runtime 기준으로 정리`
6. `docs(migration): M1 검증 결과 기록`

각 commit은 가능하면 한 책임만 가진다. 그러나 중간 commit이 repository를 완전히 buildable하게
만들기 위해 거대한 compatibility framework를 추가하지 않는다. 최종 PR head에서 모든 gate가
통과해야 한다.

PR 제목 예시:

```text
refactor(migration): Next.js standalone runtime으로 전환
```

PR 본문 필수 항목:

- base/head branch
- 제거한 runtime dependency
- DB bootstrap 변경
- cache consistency temporary 처리
- Cloudflare deployment workflow 처리 결정
- install/typecheck/lint/test/build 결과
- 14개 route smoke 결과
- admin CRUD/auth/upload smoke 결과
- standalone boot 명령과 결과
- 남은 temporary path와 담당 phase

## 15. M1 Evidence Template

M1 구현자는 이 section을 복사해 별도 결과 문서 또는 PR에 채운다.

```md
## Environment

- commit:
- Node:
- pnpm:
- Next:
- database target: local / isolated staging

## Static gates

- [ ] pnpm install --frozen-lockfile
- [ ] pnpm type-check
- [ ] pnpm lint
- [ ] pnpm test:unit:run
- [ ] pnpm build
- [ ] .next/standalone/server.js exists

## Zero dependency search

- [ ] Vinext direct runtime: 0
- [ ] Vite direct application runtime: 0
- [ ] Cloudflare direct application runtime: 0
- [ ] Next Data Cache consistency API: 0

## Runtime smoke

- [ ] 14 routes classified PASS/FAIL/BLOCKED
- [ ] public viewer
- [ ] admin auth
- [ ] album CRUD
- [ ] song CRUD
- [ ] lyrics save
- [ ] image upload
- [ ] sign-out
- [ ] standalone boot

## Temporary path

- Supabase Auth: remove in M5
- Supabase Storage: decide in architecture 11, implement by M8
- Server Actions: replace in M4
- router.refresh compatibility: replace in M4
- shared DB query/command location: move in M3

## Blockers / deviations

- none / details
```

## 16. 최종 DoD

아래가 모두 체크되어야 M1 완료다.

### Runtime

- [ ] Next.js 16.3.3 App Router 사용
- [ ] `next dev`와 `next build`가 Turbopack 경로
- [ ] `output: "standalone"`
- [ ] `.next/standalone/server.js` 실행 성공

### Removal

- [ ] Vinext application runtime dependency 0
- [ ] Vite application runtime dependency 0
- [ ] Cloudflare application runtime dependency 0
- [ ] Worker/Hyperdrive binding 0
- [ ] Next Data Cache application consistency API 0

### Quality

- [ ] frozen install 성공
- [ ] typecheck 성공
- [ ] lint 성공
- [ ] unit test 성공
- [ ] production build 성공

### Product smoke

- [ ] viewer/mock/admin route가 crash 없이 render
- [ ] 기존 public navigation 동작
- [ ] temporary DB path 동작 또는 명시적 blocker 기록
- [ ] temporary Auth path 동작 또는 명시적 blocker 기록
- [ ] admin 기본 interaction 동작
- [ ] sitemap/robots/metadata 동작
- [ ] Sentry가 Node startup을 crash시키지 않음

### Handoff

- [ ] M2로 route/FSD 구조 개선을 넘김
- [ ] M3로 Service/Repository/DB lifecycle 정착을 넘김
- [ ] M4로 Route Handler/ky/Query/cache consistency를 넘김
- [ ] M5로 Auth.js/RequestContext/CASL을 넘김
- [ ] M8/M9로 env/assets/deployment를 넘김
- [ ] temporary compatibility에 삭제 phase가 기록됨

하나라도 미완료면 M1을 완료로 표시하지 않는다. `BLOCKED`는 `PASS`가 아니며, blocker의 원인과
재현 명령을 남긴다.
