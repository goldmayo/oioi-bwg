# Local Docker Development Environment

## 목적

이 문서는 OCI 운영 환경과 연결 형태는 같지만 데이터와 credential은 완전히 격리된 로컬 개발환경의 기준이다.

```text
Local                              Production OCI
Next.js development container     Caddy -> Next.js standalone container
  -> postgres:5432                  -> postgres:5432
  -> local PostgreSQL 17            -> production PostgreSQL 17
```

- Database: 로컬 Docker PostgreSQL
- Auth: 기존 원격 Supabase Auth
- Assets: `assets.oioibawige.com`
- 운영 DB 연결 및 변경: 금지

## Analysis

### 발견한 문제

- `drizzle.config.ts`가 제거된 `src/libs/db/drizzle/schema.ts`를 가리켰다.
- Drizzle 명령은 Supabase 시절의 `DATABASE_DIRECT_URL`에 의존했다.
- 기존 migration은 주석 처리된 `Song` 단일 테이블뿐이라 빈 DB를 재현할 수 없었다.
- `db:seed`의 기준 구현이 없고 `db:push`가 README의 공식 절차였다.
- 기존 Drizzle schema가 실제 운영 DB보다 강한 nullability와 작은 정수 타입을 선언했다.
- 저장소의 `Song_slug_key`는 운영 DB에서 확인되지 않았다.

### 안전장치

`db:migrate`, `db:seed`, `db:pull`, `db:studio`는 DB hostname이 다음 중 하나가 아니면 연결 전에 실패한다.

```text
localhost
127.0.0.1
postgres
```

`drizzle-kit push` script는 제거했다. 이 가드는 편의 안전장치이며 운영 credential 관리와 네트워크 격리를 대체하지 않는다.

## Schema decision

### 기준

운영 DB에서 확인한 schema를 persistence canonical 기준으로 선택했다. 운영의 nullable legacy 컬럼을 UI가 직접 소비하지 않도록 공개 조회는 불완전한 행을 제외하고, 관리자 조회는 편집 가능한 기본값으로 정규화한다.

| 항목 | 분류 | 결정 |
| --- | --- | --- |
| `Album.slug` unique 누락 | accidental mismatch | `Album_slug_key` 복원 |
| `Song.id` integer | accidental mismatch | `bigserial`/`bigint`로 변경 |
| `Song.order` integer | accidental mismatch | nullable `bigint`로 변경 |
| Song의 여러 `.notNull()` | legacy Supabase schema artifact | 운영과 동일하게 nullable |
| Song timestamp timezone | accidental mismatch | nullable `timestamptz` |
| `Song_slug_key` | repo-only, production 미확인 | canonical baseline에서 제거 |
| `Song.albumId` FK | production-confirmed | `Song_albumId_fkey`, cascade 유지 |
| `Song.albumId` index | future migration candidate | 로컬 canonical에는 추가, 운영 적용은 별도 검토 |
| RLS/policy | intentional removal | migration에 추가하지 않음 |
| `pg_stat_statements` | operations concern | application migration에 추가하지 않음 |

운영 정보에 timestamp fractional precision이 포함되지 않았으므로 현재 애플리케이션의 `precision: 3`은 유지했다. 운영의 `datetime_precision`은 추후 read-only 점검 대상으로 남긴다.

### Migration baseline

`drizzle/0000_long_matthew_murdock.sql`은 빈 PostgreSQL 전용 baseline이다. 이미 `Album`, `Song`이 존재하는 운영 DB에 직접 실행하면 안 된다. 운영에 migration history를 도입할 때는 실제 schema 재확인과 baseline reconciliation을 별도 작업으로 수행한다.

## Local development workflow

### 최초 실행

기존 `.env.local`이 있으면 덮어쓰지 않는다. 처음 만드는 경우:

```bash
cp .env.example .env.local
```

`.env.local`에 Supabase Auth 공개 환경변수를 채운 뒤 실행한다.

```bash
docker compose -f compose.dev.yml up -d --build
```

`postgres` healthcheck가 통과하면 일회성 `migrate` 서비스가 migration을 적용하고, 성공한 뒤 `next`가 시작한다.

### Seed

```bash
docker compose -f compose.dev.yml exec next pnpm db:seed
```

Album은 unique slug upsert를 사용한다. 운영에 없는 Song slug unique constraint에 의존하지 않기 위해 Song은 slug 조회 후 update/insert한다. 반복 실행해도 fixture 수가 늘어나지 않는다.

### 운영 데이터 dump의 로컬 복원

`.local/`에 전달받은 PostgreSQL custom dump가 있는 경우에만 전체 개발 데이터를 복원할 수 있다. `.local/`은 Git에서 제외되며 운영 DB에 연결하지 않는다.

```bash
docker compose -f compose.dev.yml up -d
pnpm db:restore-local
```

기본 경로는 `.local/oioibawige_20260829_030417.dump`이며 다른 파일은 인자로 지정한다.

```bash
pnpm db:restore-local -- .local/another.dump
```

복원 명령은 dump의 schema/extension/constraint를 실행하지 않고 Album/Song 행과 sequence만 로컬 migration 결과에 넣는다. 따라서 로컬 canonical schema는 항상 Drizzle migration이 만들고, dump는 데이터 fixture로만 사용한다. dump에 포함된 운영 sequence 값은 로컬 개발 DB에만 적용된다.

복원 대상 테이블이 비어 있지 않으면 중복 삽입을 막기 위해 명령이 실패한다. 다시 복원하려면 로컬 volume을 초기화한 후 migration을 재실행한다.

### 상태와 로그

```bash
docker compose -f compose.dev.yml ps -a
docker compose -f compose.dev.yml logs -f next
```

브라우저에서 `http://localhost:3000`을 연다. 소스는 bind mount되어 있어 코드 변경에 image rebuild가 필요하지 않다.

### 종료와 reset

컨테이너만 종료하고 DB를 보존한다.

```bash
docker compose -f compose.dev.yml down
```

로컬 DB와 dependency/cache volume까지 제거하고 처음부터 재현한다.

```bash
docker compose -f compose.dev.yml down -v
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml exec next pnpm db:seed
```

`down -v`는 로컬 개발 데이터와 cache를 복구 불가능하게 삭제한다. 운영 volume에는 사용할 수 없다.

## Verification

2026-08-29에 다음을 실제 Docker Desktop/WSL 환경에서 확인했다.

- PostgreSQL 17 healthcheck: healthy
- Next.js 16.3.3 dev server: `127.0.0.1:3000`
- PostgreSQL host publish: `127.0.0.1:5432`
- Next runtime DB hostname: `postgres`
- 빈 volume migration: 성공, Drizzle migration 1건 기록
- schema: 20 columns, PK/FK/unique/default/nullability/type 확인
- FK: `Song.albumId -> Album.id ON DELETE CASCADE`
- cascade write path: transaction 안에서 parent 삭제 후 child 0건 확인, rollback
- index: `Song_albumId_idx`
- seed 2회 실행: Album 2건, Song 2건 유지
- local custom dump 복원: Album 7건, Song 26건, sequence 7/104 확인
- Next query: `/`와 `/albums/algorithm-blossom` HTTP 200 및 fixture 렌더링
- Playwright Chromium: 앨범 이미지와 화면 렌더링 확인
- source bind mount: 변경 후 image rebuild 없이 요청 성공
- clean rebuild: `down -v` 후 migration/seed/query 동일 재현
- remote-host guard: 기존 Supabase pooler hostname을 연결 전에 거부
- typecheck, ESLint, FSD harness, unit tests: 통과

ESLint에는 M2에서 식별된 장문 함수 warning 4건이 남아 있으며 이번 로컬 환경 작업의 오류는 아니다.

## Production impact

이번 작업의 production 직접 영향은 **0**이다.

- production DB에 연결하지 않았다.
- production migration을 실행하지 않았다.
- production credential/IP/hostname을 추가하지 않았다.
- Supabase Auth 구조를 변경하지 않았다.

추후 운영 작업 후보:

1. read-only로 `Song.slug` unique constraint와 timestamp precision을 재확인한다.
2. `Song_albumId_idx` 추가 여부를 실행 계획과 운영 부하 기준으로 결정한다.
3. 운영 DB의 현재 schema를 migration baseline과 reconcile한 뒤 migration history를 도입한다.
