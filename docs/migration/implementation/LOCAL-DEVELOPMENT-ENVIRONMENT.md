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
- 신뢰할 수 있는 로컬 데이터 복원 기준이 없고 `db:push`가 README의 공식 절차였다.
- 기존 Drizzle schema가 실제 운영 DB보다 강한 nullability와 작은 정수 타입을 선언했다.
- 저장소의 `Song_slug_key`는 운영 DB에서 확인되지 않았다.

### 안전장치

`db:migrate`, `db:pull`, `db:studio`는 DB hostname이 다음 중 하나가 아니면 연결 전에 실패한다.

```text
localhost
127.0.0.1
postgres
```

`drizzle-kit push` script는 제거했다. 이 가드는 편의 안전장치이며 운영 credential 관리와 네트워크 격리를 대체하지 않는다.

### DB 도구 입력 (2026-10-23)

호스트의 `db:migrate`, `db:pull`, `db:studio`는 process의 `DATABASE_URL` 또는 명시한 env 파일 한 개를
사용한다. Web 파일을 자동 탐색하지 않는다. 기존 앱 파일을 선택할 때도 DB URL만 읽고 나머지 키는
실행 환경으로 복사하지 않는다. 예를 들어 다음처럼 파일을 직접 선택한다.

```bash
pnpm db:migrate --env-file apps/console/.env.local
pnpm db:pull --env-file apps/console/.env.local
pnpm db:studio --env-file apps/console/.env.local
```

작업에 필요한 권한이 있는 로컬 URL을 선택한다. process와 선택 파일의 값이 다르거나 파일에 값이
없으면 중단하며 credential을 출력하지 않는다. `--env-file=경로`도 허용한다. 이 세 명령은 대상 변경을
우회하는 `--url`·`--config` 등 다른 인자를 받지 않는다. URI는 postgres/postgresql protocol과 위 local
host만 허용하고 query/fragment를 거절한다. guard가 확인한 URL을 같은 실행 환경에 전달하며
Drizzle Kit가 다른 env 파일로 다시 덮어쓰지 않게 한다.

Compose·Console launcher·격리 테스트가 이미 process URL을 명시하면 기존 명령 그대로 사용한다.
개인 env·credential·볼륨은 자동 이관하거나 바꾸지 않는다. `db:generate`는 DB 입력을 사용하지 않고
기존 생성 옵션을 전달한다. [Drizzle generate의 필수 입력](https://orm.drizzle.team/docs/drizzle-kit-generate)은
schema와 dialect이며 이 명령으로 DB에 접속하거나 migration을 적용하지 않는다.

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

### Console MFA 로컬 확인 (P05 이후)

Console은 호스트의 별도 Next 프로세스와 Compose PostgreSQL을 사용한다. Docker Desktop/daemon을
먼저 실행하고 저장소 루트에서 의존성을 설치한다. `next` 컨테이너는 Console 실행에 필요하지 않다.

```bash
pnpm install --frozen-lockfile
```

`apps/console/.env.local`이 없으면 [Console env 예제](../../../apps/console/.env.example)를 복사한다.
예제의 주석을 따라 `openssl rand -base64 32`를 두 번 실행해 서로 다른 서명/암호화 키를 채운다.
기존 파일과 등록 후의 암호화 키는 보존한다. 최초 QR 등록을 확인할 때만
`CONSOLE_MFA_ENROLLMENT_ENABLED=true`로 설정한다. Web env 파일을 복사하지 않는다.

Console 이미지 업로드에는 `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`ASSETS_PUBLIC_BASE_URL`을 모두 채운다. 기존 Web `.env`에 값이 있다면 이 다섯 값만 옮기고,
Console DB/Auth/MFA 설정은 보존한다. Console에도 현재 공용 프로젝트의 `NEXT_PUBLIC_SENTRY_DSN`을 명시하며
`NEXT_PUBLIC_APP_ENV=local`에서는 전송하지 않는다. 메일은 현재 Console consumer가 없어 요구하지 않는다.

준비 후 매번 다음 명령 하나로 실행한다.

```bash
pnpm dev:console:local
```

스크립트는 Console env의 대상/키/Origin과 R2 설정 다섯 항목을 먼저 검사하고 Compose PostgreSQL을 health까지 기다린다.
고정된 Compose 개발용 bootstrap credential로 guarded `db:migrate`를 실행한 뒤 Console dev 서버를
3001에서 시작한다. migration은 미적용분만 반영하며 기존 데이터와 키를 초기화하지 않는다.
앱의 `DATABASE_URL`도 `127.0.0.1:5432/oioibawige`로 제한한다. 환경변수/credential을 출력하지 않는다.
Docker 연결 실패나 env/migration 실패 시 다음 단계를 실행하지 않는다.

`http://127.0.0.1:3001/admin-login`에서 다음을 확인한다(Origin 설정과 같은 hostname 사용).

1. 기존 로컬 ACTIVE ADMIN 이메일/비밀번호로 **인증기 등록 → QR 생성**.
2. 인증기 앱으로 QR 스캔 → 6자리 입력 → **등록 확인**. 이 단계는 세션을 발급하지 않는다.
3. **로그인으로 돌아가기** → 이메일/비밀번호 → **다음** → 다음 OTP로 **로그인**.
   등록에 사용한 OTP는 이미 소모됐으므로 코드가 바뀔 때까지 기다린다.
4. 확인 후 등록 설정을 `false`로 바꾸고 dev 서버를 재시작한다. 기존 OTP 로그인은 유지된다.

`Ctrl+C`는 Console을 종료하며 PostgreSQL과 데이터는 보존한다. Docker 중단은 `down`을 사용한다.
이 명령은 계정이나 seed를 생성하지 않는다. 관리자 계정이 없다면 별도로 승인된 로컬 계정 준비가
필요하다. 실패 5회 후에는 계정별 5분 window 제한이 적용될 수 있다. 공개 운영은 P06 범위다.

### 최초 실행

기존 `apps/web/.env.local`이 있으면 덮어쓰지 않는다. 처음 만드는 경우:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Web은 비로그인 공개 조회 앱이므로 DB와 앱별 공개 설정만 준비한다. Supabase Auth·R2 업로드·메일 설정을 요구하지 않는다. 기존 개인 env 파일은 덮어쓰지 않는다.

개발 이미지는 root·Web·Console·config·contracts·server의 manifest로 전체 workspace를 frozen install한다.
소스 bind mount 후에도 각 workspace의 node_modules는 전용 volume에서 유지한다. `next`는 Web 개발
서버이며 Console은 위의 별도 local launcher를 사용한다. 실행 환경은 명시적 local이다.

```bash
docker compose -f compose.dev.yml build next
docker compose -f compose.dev.yml up -d postgres
docker compose -f compose.dev.yml up -d next
docker compose -f compose.dev.yml exec next pnpm db:migrate
```

Compose는 PostgreSQL과 Next만 실행한다. migration은 실행 중인 Next 컨테이너에서 개발자가 명시적으로 실행한다. 빈 DB에서는 앱 페이지를 사용하기 전에 migration 성공을 확인한다.

### 운영 데이터 dump의 로컬 복원

`.local/`에 전달받은 PostgreSQL custom dump가 있는 경우에만 전체 개발 데이터를 복원할 수 있다. `.local/`은 Git에서 제외되며 운영 DB에 연결하지 않는다.

```bash
docker compose -f compose.dev.yml up -d postgres
docker compose -f compose.dev.yml up -d next
docker compose -f compose.dev.yml exec next pnpm db:migrate
pnpm db:restore-local
```

기본 경로는 `.local/oioibawige_20260829_030417.dump`이며 다른 파일은 인자로 지정한다.

```bash
pnpm db:restore-local -- .local/another.dump
```

복원 명령은 dump의 schema/extension/constraint를 실행하지 않고 Album/Song 행과 sequence만 로컬 migration 결과에 넣는다. 따라서 로컬 canonical schema는 항상 Drizzle migration이 만들고, dump는 승인된 로컬 데이터 snapshot으로만 사용한다. dump에 포함된 운영 sequence 값은 로컬 개발 DB에만 적용된다.

저장소는 임의로 선별하거나 작성한 seed 데이터를 제공하지 않는다. 전체 데이터가 필요한 개발자는 전달받은 `.local/` dump를 명시적으로 복원하고, dump가 없으면 schema만 생성된 빈 로컬 DB를 사용한다.

복원 대상 테이블이 비어 있지 않으면 중복 삽입을 막기 위해 명령이 실패한다. 다시 복원하려면 로컬 volume을 초기화한 후 migration을 재실행한다.

### 상태와 로그

```bash
docker compose -f compose.dev.yml ps -a
docker compose -f compose.dev.yml logs -f next
```

브라우저에서 `http://localhost:3000`을 연다. 소스는 bind mount되어 있어 코드 변경에 image rebuild가 필요하지 않다.

### 의존성 변경

실행 중인 `next` 컨테이너에서 `pnpm install`, `pnpm add`, `pnpm remove`를 실행하지 않는다.
`/app`은 host bind mount이고 컨테이너는 root로 실행되므로, 이 명령은 host 작업 트리에
root 소유 파일을 만들 수 있다. 의존성 변경은 host에서 수행하고 lockfile을 검토한다.

```bash
pnpm --filter @oioi-bwg/web add <package>
pnpm install --frozen-lockfile
```

컨테이너의 dependency volume을 갱신해야 할 경우에는 DB volume을 삭제하지 말고, `next`
컨테이너와 여섯 의존성 volume만 재생성한다. 대상은 `node_modules`, `web_node_modules`,
`console_node_modules`, `config_node_modules`, `contracts_node_modules`, `server_node_modules`다.
현재 Compose project와 volume의 정확한 이름을 확인하며 `postgres_data`와 `next_cache`는 보존한다.
아래 `<PROJECT>`는 `docker compose ls`에서 확인한 실제 프로젝트명으로 대체한다.
새 volume은 image의 설치 내용을 복사하지만 기존 volume은 image rebuild만으로 갱신되지 않는다.
[Docker volume의 초기 내용 복사](https://docs.docker.com/engine/storage/volumes/#mounting-a-volume-over-existing-data)를 따른다.

```bash
docker compose -f compose.dev.yml stop next
docker compose -f compose.dev.yml rm -sf next
docker compose ls
docker volume ls --filter 'label=com.docker.compose.project=<PROJECT>' --format '{{.Name}}'
docker volume rm '<PROJECT>_node_modules' '<PROJECT>_web_node_modules' \
  '<PROJECT>_console_node_modules' '<PROJECT>_config_node_modules' \
  '<PROJECT>_contracts_node_modules' '<PROJECT>_server_node_modules'
docker compose -f compose.dev.yml up -d --build next
```

`Dockerfile.dev`는 `NPM_CONFIG_STORE_DIR=/pnpm/store`로 pnpm store를 컨테이너 내부에
명시적으로 고정한다. 따라서 위 절차 이외의 실수로 install을 실행해도 project root에
`.pnpm-store`가 생기지 않는다.

### 종료와 reset

컨테이너만 종료하고 DB를 보존한다.

```bash
docker compose -f compose.dev.yml down
```

로컬 DB와 dependency/cache volume까지 제거하고 처음부터 재현한다.

```bash
docker compose -f compose.dev.yml down -v
docker compose -f compose.dev.yml up -d postgres
docker compose -f compose.dev.yml up -d next
docker compose -f compose.dev.yml exec next pnpm db:migrate
pnpm db:restore-local
```

마지막 복원 명령은 승인된 `.local/` dump가 있을 때만 실행한다.

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
- local custom dump 복원: Album 7건, Song 26건, sequence 7/104 확인
- Next query: `/`와 `/albums/algorithm-blossom` HTTP 200 및 복원 데이터 렌더링
- Playwright Chromium: 앨범 이미지와 화면 렌더링 확인
- source bind mount: 변경 후 image rebuild 없이 요청 성공
- clean rebuild: `down -v` 후 migration/dump restore/query 동일 재현
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
