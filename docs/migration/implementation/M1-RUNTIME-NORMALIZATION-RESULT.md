---
title: "M1 Runtime Normalization Result"
document_id: "M1-RUNTIME-NORMALIZATION-RESULT"
version: "1.0"
status: "review"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M1-RUNTIME-NORMALIZATION"
tags:
  - "migration"
  - "evidence"
---

# M1 Runtime Normalization Result

## 구현 상태

`migration_m1-runtime-normalization`에서 M1 runtime 변경을 적용했다. M0 문서와 Next.js 16.3.3
변경은 현재 작업 트리에 함께 존재하며 아직 커밋/PR 병합하지 않았다.

## 적용한 변경

- Next.js 기본 명령을 `next dev`, `next build`, standalone server로 전환
- `next.config.mjs`에 `output: "standalone"` 추가
- React Compiler가 활성화된 기존 설정을 위해 `babel-plugin-react-compiler` 추가
- `cloudflare:workers`/Hyperdrive 기반 DB 초기화를 `DATABASE_URL` process-level singleton으로 전환
- DB command와 Server Action에서 `updateTag`/`revalidatePath` 제거
- `"use cache"` directive 제거
- Vinext, Vite application config, Wrangler, Worker entry/type/config 제거
- Cloudflare deployment workflow 제거
- Cloudflare/Vite Sentry 설정 제거 및 Node instrumentation으로 축소
- Next 16 route validator가 발견한 존재하지 않는 `modal` slot을 optional prop으로 수정
- TypeScript include를 Next generated type 경로에 맞춤

## 통과한 자동 검증

| 명령 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm type-check` | PASS |
| `pnpm lint` | PASS (기존 boundaries deprecation warning) |
| `pnpm test:unit:run` | PASS (5 files, 21 tests) |
| `pnpm build` | PASS (Next.js 16.3.3, Turbopack) |
| `.next/standalone/server.js` | 존재 확인 |

## standalone HTTP smoke

standalone server를 `public`과 `.next/static`을 `.next/standalone` 내부에 staging한 뒤
`HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/server.js`로 기동하고 Node `fetch`로
확인했다. `curl`은 환경에 설치되어 있지 않았다. staging 전에는 정적 CSS/JS가 404였으며,
staging 및 서버 재기동 후 정상화됐다.

| 경로 | HTTP |
|---|---:|
| `/` | 200 |
| `/more` | 200 |
| `/robots.txt` | 200 |
| `/sitemap.xml` | 200 |
| `/admin` | 200 |

## 아직 수행하지 않은 항목

- 실제 browser에서 14개 route 전체 확인
- 격리 fixture를 사용한 admin sign-in/CRUD/lyrics save/image upload mutation
- staging 또는 production 배포
- Docker/Caddy/OCI 배포 검증(M9 책임)

위 항목은 production DB에 임의 데이터를 쓰지 않기 위해 실행하지 않았다. 따라서 이 문서는
자동 검증과 기본 standalone HTTP smoke까지의 결과이며, 수동 product smoke 완료 전에는 M1 DoD를
최종 완료로 표시하지 않는다.

## 남은 temporary path

- Supabase Auth/Storage: M5/M8에서 후속 결정
- Server Action transport: M4에서 Route Handler + ky로 이동
- Service/Repository/transaction: M3에서 정착
- Query invalidation: M4에서 TanStack Query 정책으로 이동
