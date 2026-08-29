---
title: "M3 Server Foundation Result"
document_id: "M3-SERVER-FOUNDATION-RESULT"
version: "1.0"
status: "active"
authority: "result"
updated_at: "2026-08-29"
depends_on:
  - "M3-PREFLIGHT"
  - "M2-HANDOFF"
---

# M3 Server Foundation Result

## 결과

애플리케이션 DB 접근을 `shared`와 `feature`에서 제거하고 다음 단방향 경계로 통일했다.

```text
RSC / route-local Server Action
              ↓
        server service
              ↓
      domain repository
              ↓
     Drizzle DB executor
              ↓
        PostgreSQL 17
```

`src/app`은 service만 호출하며 Drizzle과 repository를 알지 않는다. `features`, `entities`,
`shared`에는 PostgreSQL/Drizzle persistence import가 남아 있지 않다.

## 이동 및 책임 분리

### Database

- `src/server/db/index.ts`: `server-only` DB singleton과 `Database`, `Transaction`,
  `DbExecutor` 정의
- `src/server/db/schema.ts`: 운영에서 확인한 Album/Song persistence schema와 relation 유지
- direct PostgreSQL 연결의 connection 상한 `10`, idle timeout `20초`, connect timeout `10초` 명시
- `Song_albumId_idx`와 `ON DELETE CASCADE` FK 유지

`drizzle.config.ts`도 새 server schema 경로를 사용한다. `db:generate` 결과 schema 변경은 없었다.

### Repository

- `album-repository.ts`: Album read/write SQL과 relation query
- `song-repository.ts`: Song read/write SQL과 relation query
- 모든 함수는 내부에서 singleton을 획득하지 않고 `DbExecutor`를 첫 인자로 받는다.
- repository가 transaction을 시작하거나 application/HTTP 규칙을 판단하지 않는다.

### Service

- `album-service.ts`: 공개/관리자 조회, nullable Song 정규화, Album write use case
- `song-service.ts`: 공개/관리자 조회, sitemap projection, nullable legacy row 정규화,
  Song write use case
- 공개 조회에서는 화면에 안전하게 표현할 수 없는 nullable legacy Song을 제외한다.
- 관리자 조회에서는 nullable legacy 값을 빈 문자열·빈 배열·기본 boolean/order로 정규화해
  관리자가 복구할 수 있게 한다.

현재 mutation은 모두 단일 SQL statement다. 헌법의 "단순 write에는 transaction을 강제하지
않는다" 원칙에 따라 의식적인 transaction wrapper를 추가하지 않았다. 향후 여러 repository
operation이 하나의 atomic use case를 이루면 service가 `db.transaction()`을 열고 같은 repository
함수에 `tx`를 명시적으로 전달한다.

## Delivery adapter

기존 feature Server Action에 섞여 있던 Zod/LRC 입력 변환과 DB mutation을 분리했다.

- `app/(admin)/admin/_lib/manage-content-actions.ts`: route-local 입력 adapter
- `app/(admin)/admin/edit/_lib/save-song-data.ts`: 가사 저장 입력 adapter
- adapter는 입력을 검증한 뒤 service를 호출한다.
- client feature는 action 함수의 타입만 소유하고 app에서 주입받는다.
- Supabase Storage 이미지 업로드는 DB persistence가 아니므로 기존 feature action에 남겼다.
  Auth/Storage boundary의 최종 정리는 M5 범위다.

RSC page와 sitemap은 localhost HTTP를 우회하지 않고 service를 직접 호출한다. M4에서 client
server-state 경로를 `TanStack Query → ky → Route Handler → Service`로 교체한다.

## 제거한 항목

- `src/shared/api/db/drizzle/{index,schema,queries,commands}.ts`
- feature 내부의 DB mutation 및 manage-lyrics DB Server Action
- Drizzle persistence type을 client component가 직접 import하던 경로
- 신뢰할 수 없는 임의 2 Album/2 Song seed와 `db:seed` script

로컬 데이터는 사용자가 전달한 `.local` custom dump를 `pnpm db:restore-local`로 명시적으로
복원한다. 저장소가 임의 데이터를 정하거나 `docker compose up`에서 자동 주입하지 않는다.

## 검증

2026-08-29 로컬 PostgreSQL 17의 복원 데이터 Album 7건/Song 26건을 사용했다.

- `pnpm type-check`: PASS
- `pnpm test:harness`: PASS — 7 tests
- `pnpm lint`: PASS — 0 errors, 장문 함수 warning 5건
- `pnpm lint:fsd`: PASS
- `pnpm test:unit:run`: PASS — 5 files, 21 tests
- `pnpm format:check`: PASS
- `pnpm build`: PASS — Next.js 16.3.3 production build, 19 static/dynamic routes generated
- `pnpm db:generate`: PASS — schema changes 없음
- HTTP 200: `/`, `/albums/algorithm-blossom`, `/songs/gomin-jungdok`, `/admin/albums`,
  `/admin/edit/gomin-jungdok`
- source scan: `app/features/entities/shared`의 Drizzle/Postgres import 0건
- source scan: `app`의 repository/db 직접 import 0건

## Production impact

이번 단계는 code boundary 이동이며 production DB에 연결하거나 변경하지 않았다. schema migration
파일도 생성되지 않았다.

후속 확인 항목:

1. 운영 `Song.slug` unique/index 존재 여부를 read-only로 확인한다.
2. 운영 `Song_albumId_idx` 적용 여부는 query plan과 부하를 확인한 별도 migration으로 결정한다.
3. M4에서 Route Handler, HTTP contract, ky, TanStack Query cache lifecycle을 도입한다.
4. M5에서 Supabase Auth/Storage, RequestContext, authorization 경계를 정리한다.
