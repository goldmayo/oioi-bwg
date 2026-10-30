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
- Auth: Web 비로그인 공개 조회 / Console의 독립 Auth.js Credentials + TOTP MFA
- Assets: 기존 `assets.oioibawige.com` 유지, 업로드 credential은 Console consumer만 준비
- 운영 DB 연결 및 변경: 금지

현재 workspace는 Web·Console·독립 relay와 config·contracts·server다. 로컬 개발·production build·검증은
`NEXT_PUBLIC_APP_ENV=local`, VM Promotion 입력은 production이며 NODE_ENV로 대체하지 않는다.
별도 staging 환경을 운영하지 않지만 기존 외부 host/bucket 식별자는 보존한다.
Web metadata는 localhost이며 local Sentry 전송은 비활성이다. 이 문서는 실제 운영 배포 승인을 뜻하지 않는다.

현재 코드가 읽는 변수·기본값·필수 조건은 [환경변수 전체 조사](ENVIRONMENT-VARIABLE-INVENTORY.md),
운영·CI·도구·테스트 입력은 [부록](ENVIRONMENT-VARIABLE-OPERATIONS-INVENTORY.md)에서 확인한다.
개인 env 값이나 실제 운영 설정 완료 여부를 조사한 결과는 아니다.

## Analysis

아래 발견/해결과 Schema decision은 2026-08-29 최초 baseline의 이력이다. 현재 실행은 이어지는
DB 도구 입력·Local development workflow를 따른다. 과거 Supabase Auth 설명은 현재 전제에서 제외한다.

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

2026-10-26 UUID 전환부터 `migrate`에만 `--legacy-schema`와 `--uuid-map <JSON>`을 추가했다.
전자는 빈 target을 0005까지 준비하며 downgrade하지 않는다. 후자는 v2 대응표를 transaction 안에
전달한다. 둘을 함께 사용할 수 없으며 host/입력 충돌 guard는 그대로 적용한다.

Compose·Console launcher·격리 테스트가 이미 process URL을 명시하면 기존 명령 그대로 사용한다.
개인 env·credential·볼륨은 자동 이관하거나 바꾸지 않는다. `db:generate`는 DB 입력을 사용하지 않고
기존 생성 옵션을 전달한다. [Drizzle generate의 필수 입력](https://orm.drizzle.team/docs/drizzle-kit-generate)은
schema와 dialect이며 이 명령으로 DB에 접속하거나 migration을 적용하지 않는다.

## Schema decision

이 절은 최초 운영 관찰값과 로컬 baseline을 맞춘 이력이며 현재 운영 schema를 자동 canonical로 삼는
규칙이 아니다. 이후 변경은 Domain Specification·active Server/Data Access·명시적 migration과 검증을
따른다. 운영 schema 재확인·변경은 별도 승인 범위다.

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

### Node.js 런타임

호스트·개발 이미지·운영 이미지·CI는 `.nvmrc`의 Node.js 22.23.4를 기준으로 사용한다.
이 파일은 Turbo 공통 입력이므로 Node 버전 변경 시 기존 검사·빌드 캐시를 재사용하지 않는다.
2026-10-26 Node2Shell(CVE-2026-111497) 대응으로 기존 22.16.0에서 올렸다.
[공식 보안 릴리스](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)의
Brotli 디코더 수정은 npm 의존성 갱신만으로 적용되지 않는다.

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@10.15.1 --activate
node --version
```

기존 Node 프로세스는 새 버전으로 다시 시작한다. 개발 컨테이너는
`docker compose -f compose.dev.yml up -d --build --no-deps next`로 재생성하며 DB·volume은 보존한다.
운영 두 이미지는 정상 Promotion에서 재빌드·검증·배포한다. 일반 CI와 Promotion의 컨테이너 검사는
실제 Node 버전이 `.nvmrc`와 같은지 확인하고 Node·Brotli 버전을 출력한다.

### 환경 파일의 역할과 작성 순서

각 앱의 `.env.example`은 **값이 전부 빈 템플릿**이다. 2026-10-24 사용자의 단일 파일 관리 요청에 따라
실제 값은 앱별 **`.env.local` 한 파일**에 입력하며 Git에 커밋하지 않는다. Console 실행기·개발 Compose와
같은 경로를 쓰고 테스트에 개인 설정이 자동으로 섞이는 것을 줄이기 위한 저장소 규칙이다.
Next가 다른 `.env*` 파일을 지원하는 동작 자체를 바꾸는 것은 아니다.

기존 `.env`와 `.env.local`을 통합할 때는 두 파일의 실제 적용 값을 확인하고 원본을 ignored `.local/`에
백업한다. 동일 키의 값이 다르면 우선순위·사용 목적을 확인한 뒤 반영한다. 사용자가 정리한 개인 파일은
보존하며 consumer가 없다는 이유만으로 실제 값을 임의로 삭제하지 않는다.
템플릿은 현재 앱의 입력을 안내하며 개인 파일의 추가 보존 항목을 자동으로 제거하는 기준이 아니다.

두 앱은 아래 순서로 해당하는 그룹만 쓰고, 한글 주석에 공개 여부·입력 조건·변경 시 주의사항을 적는다.
동일 파일 안에서 같은 키를 반복하지 않는다. 기존 중복을 정리할 때는 실제 적용 값이 유지되는지 확인한다.

| 순서 | 그룹 | Web / Console 입력 |
| --- | --- | --- |
| 1 | 실행 환경 | `NEXT_PUBLIC_APP_ENV` |
| 2 | 데이터베이스 | `DATABASE_URL` |
| 3 | 접속·인증 | Console Origin·서명 키·MFA 키·등록 허용 설정 |
| 4 | 파일 업로드·에셋 | Console R2 5개 입력 |
| 5 | 메일 | Console용 5개 항목을 주석으로 보관. 현재 런타임 입력 아님 |
| 6 | 관측 | 앱별 `NEXT_PUBLIC_SENTRY_DSN` |
| 7 | 분석 | Web의 선택 입력 `NEXT_PUBLIC_GTM_ID` |

현재 Web의 공개 기능과 해당 저장소 내 의존성을 따라 읽는 일반 앱 입력은 아래 네 개다.
값이 env 파일에 존재한다는 사실과 현재 Web이 그 값을 소비한다는 사실을 구분한다.

| 변수 | 필요 조건·소비 위치 |
| --- | --- |
| `NEXT_PUBLIC_APP_ENV` | 필수. `next.config.ts` → `shared/config/app-env.ts`가 dev/build 진입에서 검증 |
| `DATABASE_URL` | 공개 조회·readyz에 필수. `@oioi-bwg/server/db`가 DB 획득 시 읽음 |
| `NEXT_PUBLIC_SENTRY_DSN` | 선택. `shared/config/sentry.ts`가 해석하며 local에서는 비활성 |
| `NEXT_PUBLIC_GTM_ID` | 선택. root layout이 값이 있을 때만 GTM을 로드 |

로컬 템플릿은 Web의 일반 입력 4개와 Console의 일반 입력 12개만 선언한다. Console의 메일 설정
5개는 사용자 요청에 따라 빈 값의 주석으로 보관한다. 개인 파일에 보관한 메일 값도 주석 상태를 유지하며
실제 메일 기능 연결·전송은 별도 범위다.

이 목록이 Web 코드 전체의 유일한 환경 접근이라는 뜻은 아니다. Sentry 게시·캐시 제어 등의 CI 전용
입력은 로컬 템플릿에 넣지 않고 기존 CI·Docker와 [운영 입력 부록](ENVIRONMENT-VARIABLE-OPERATIONS-INVENTORY.md)에서 관리한다.
`NEXT_RUNTIME`은 instrumentation에서 읽는 Next 제공 값이며 `NODE_ENV`와 함께 개인 배포 설정으로
입력하지 않는다.

새 개인 파일은 빈 템플릿을 복사한 뒤 다음 값을 직접 채운다. 기존 개인 파일은 복사로 덮어쓰지 않고
필요한 항목만 반영한다. 아래 DB credential은 Compose의 로컬 개발 전용 값이다.

| 키 | 호스트 로컬 입력 |
| --- | --- |
| `NEXT_PUBLIC_APP_ENV` | `local` — 로컬 production build도 동일 |
| `DATABASE_URL` | `postgresql://oioibawige:oioibawige_dev_only@127.0.0.1:5432/oioibawige` 또는 권한이 준비된 기존 로컬 URL |
| `CONSOLE_ORIGIN` | `http://127.0.0.1:3001` — 브라우저 주소와 일치 |
| `CONSOLE_MFA_ENROLLMENT_ENABLED` | 평소 `false`, 최초 등록/재등록 확인 시에만 `true` |
| Console 인증 키·R2 설정 | 아래 Console 절차대로 채우며 기존 값 보존 |
| `NEXT_PUBLIC_SENTRY_DSN` | 선택 입력. 같은 프로젝트의 DSN을 앱별로 입력하며 local 전송은 비활성 |
| `NEXT_PUBLIC_GTM_ID` | 로컬에서는 빈칸 유지. 현재 GTM 로드는 APP_ENV로 차단하지 않음 |

Next 직접 실행은 앱 루트의 `.env*`를 읽는다. [공식 로드 순서](https://nextjs.org/docs/app/guides/environment-variables#environment-variable-load-order)는
process → `.env.$NODE_ENV.local` → `.env.local` → `.env.$NODE_ENV` → `.env`이며 먼저 찾은 값이 우선한다.
파일 하나를 선택하는 방식이 아니라 키마다 값을 찾는다. `.env.local`에 없는 키는 뒤의 `.env`에서
채울 수 있으므로 파일을 분리하면 숨은 의존성이 생길 수 있다. process에 정의된 값은 파일보다 우선한다.
`NODE_ENV=test`에서는 `.env.local`을 읽지 않지만 `.env`는 읽는다. `.env.example`은 자동 로드되지 않는다.
이 파일 선택에 쓰이는 NODE_ENV와 배포 환경 계약인 NEXT_PUBLIC_APP_ENV를 구분한다.

현재 개발 Compose의 Web `env_file`과 Console 로컬 실행기는 `.env.local`을 직접 지정한다.
이 경로에서는 필요한 값을 해당 파일에 준비한다. Console 실행기는 이 파일의 값을 process보다 우선해
전달하고 APP_ENV를 local로 고정한다. DB 도구의 명시적 입력 규칙은 위의 DB 도구 입력 절을 따른다.
Next 직접 실행과 Console 실행기의 process 우선순위 차이는 위와 같으며 이번에는 launcher 동작을 바꾸지 않는다.

값을 바꾼 뒤 dev 서버를 재시작한다. `NEXT_PUBLIC_*`는 production build 때 고정되므로 기존 산출물에
runtime 파일만 바꿔 반영할 수 없다. 개인 파일은 권한 `0600`, 별도 백업 디렉터리는 `0700`으로 관리하고
실제 값·백업을 commit이나 PR 본문에 넣지 않는다. VM 설정 변경·배포는 별도 승인 범위다.

### Console MFA 로컬 확인 (P05 이후)

Console은 호스트의 별도 Next 프로세스와 Compose PostgreSQL을 사용한다. Docker Desktop/daemon을
먼저 실행하고 저장소 루트에서 의존성을 설치한다. `next` 컨테이너는 Console 실행에 필요하지 않다.

```bash
pnpm install --frozen-lockfile
```

`apps/console/.env.local`이 없으면 [Console env 예제](../../../apps/console/.env.example)를 복사한다.
예제는 모든 값이 비어 있으므로 위 표의 APP_ENV·DB·Origin·등록 허용 설정을 먼저 채운다.
주석을 따라 `openssl rand -base64 32`를 두 번 실행해 서로 다른 서명/암호화 키를 채운다.
기존 파일과 등록 후의 암호화 키는 보존한다. 최초 QR 등록을 확인할 때만
`CONSOLE_MFA_ENROLLMENT_ENABLED=true`로 설정한다. Web env 파일을 복사하지 않는다.

Console 이미지 업로드에는 `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`ASSETS_PUBLIC_BASE_URL`을 모두 채운다. 기존 Web `.env`의 값을 참고할 때도 원본은 보존하고
Console DB/Auth/MFA 설정을 덮어쓰지 않는다. 기존 버킷·접속 대상은 이름만 보고 바꾸지 않는다.
Console에도 현재 공용 프로젝트의 `NEXT_PUBLIC_SENTRY_DSN`을 필요한 경우 입력하며
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

복사만으로 설정이 끝나지 않는다. 위 표의 `NEXT_PUBLIC_APP_ENV=local`과 로컬 `DATABASE_URL`을 채운다.
Sentry DSN은 선택 입력이며 로컬 GTM ID는 비워 둔다.

Web은 비로그인 공개 조회 앱이므로 DB와 앱별 공개 설정만 준비한다. Supabase Auth·R2 업로드·메일 설정을 요구하지 않는다. 기존 개인 env 파일은 덮어쓰지 않는다.

개발 이미지는 root·Web·Console·relay·config·contracts·server의 manifest로 전체 workspace를 frozen install한다.
소스 bind mount 후에도 각 workspace의 node_modules는 전용 volume에서 유지한다. `next`는 Web 개발
서버이며 Console은 위의 별도 local launcher를 사용한다. 실행 환경은 명시적 local이다.

```bash
docker compose -f compose.dev.yml build next
docker compose -f compose.dev.yml up -d postgres
docker compose -f compose.dev.yml up -d next
docker compose -f compose.dev.yml exec next pnpm db:migrate
```

Compose는 PostgreSQL과 Next만 실행한다. migration은 실행 중인 Next 컨테이너에서 개발자가 명시적으로 실행한다. 빈 DB에서는 앱 페이지를 사용하기 전에 migration 성공을 확인한다.

### UUIDv7 전환과 legacy dump 복원

2026-10-26부터 Account·Album·Song과 FK는 UUID이며 물리 테이블/컬럼은 단수 snake_case다.
정수 ID를 가진 승인 dump를 UUID 스키마에 직접 넣지 않는다. `--legacy-schema`로 0005까지
준비 → dump 복원 → v2 대응표 생성 → 0006 적용 순서를 사용한다. 이미 UUID migration을 적용한
DB는 이 옵션으로 되돌릴 수 없다. 현재 데이터가 있는 DB/volume은 보존하고 먼저 별도 DB에서 검증한다.

다음은 **새 격리 DB** 예시다. URL은 Compose의 공개된 로컬 개발 전용 값이며 운영 입력이 아니다.
이미 같은 이름의 DB가 있으면 생성이 실패한다. 기존 DB를 삭제하는 명령은 포함하지 않는다.

```bash
docker compose -f compose.dev.yml up -d postgres
docker compose -f compose.dev.yml exec -T postgres createdb -U oioibawige oioi_m7_test_restore
UUID_RESTORE_DATABASE_URL='postgresql://oioibawige:oioibawige_dev_only@127.0.0.1:5432/oioi_m7_test_restore'
DATABASE_URL="$UUID_RESTORE_DATABASE_URL" pnpm db:migrate --legacy-schema
pnpm db:restore-local .local/oioibawige_20260829_030417.dump --database oioi_m7_test_restore
```

복원은 빈 legacy `Album/Song`에 data/sequence만 넣는다. schema·extension·constraint는
migration이 만들며, 기존 행이 있거나 UUID 스키마이면 중단한다. 다른 승인 dump는 첫 인자로 고른다.
`--database`는 같은 Compose의 `oioi_m7_test_*`만 허용한다. 생략하면 기존 로컬 `oioibawige`다.

대응표 입력은 **현재 그 DB**에서 ID/FK와 계정 메타데이터만 조회해 만든다. 이메일·해시·OTP·MFA secret은
선택하지 않는다. 기존 v1 dry-run은 v2 대신 사용하지 않으며 출력 파일은 덮어쓰지 않는다.

```bash
(umask 077; set -C
docker compose -f compose.dev.yml exec -T postgres psql -qAt -U oioibawige -d oioi_m7_test_restore > .local/uuid-source-v2.json <<'SQL'
SELECT jsonb_build_object(
  'albums', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id::text) ORDER BY id) FROM "Album"), '[]'::jsonb),
  'songs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id::text, 'albumId', "albumId"::text) ORDER BY id) FROM "Song"), '[]'::jsonb),
  'accounts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id::text, 'role', a.role, 'status', a.status, 'mfaVersion', m.version) ORDER BY a.id) FROM account a LEFT JOIN admin_mfa m ON m.account_id=a.id), '[]'::jsonb)
);
SQL
)
pnpm db:plan-uuid create .local/uuid-source-v2.json .local/uuid-map-v2.json
pnpm db:plan-uuid verify .local/uuid-source-v2.json .local/uuid-map-v2.json
DATABASE_URL="$UUID_RESTORE_DATABASE_URL" pnpm db:migrate --uuid-map .local/uuid-map-v2.json
```

기존 ACTIVE ADMIN을 재등록하는 전환은 검토한 대상마다 create 명령에
`--reset-admin-old-id '<기존 정수 ID>'`를 명시한다. 지정 대상의 credential만 제거하고 MFA를 reset/version
증가하며 Account/Profile과 다른 계정의 credential은 보존한다. 지정하지 않은 MFA가 있거나 계정 상태가
달라지면 SQL이 중단한다. 대응표를 저장해 같은 표로 재시도하며 ID를 재발급하지 않는다.

복원한 격리 DB는 자동으로 앱의 개인 env나 Console launcher 대상이 되지 않는다. 기존 개발 DB의
실제 전환도 그 DB를 기준으로 새 source/대응표를 만들고 명시적으로 적용한다. snapshot의 내용·공개 상태·
slug·이미지 URL·가사·곡 관계를 보존하며 production 데이터로 로컬을 자동 덮어쓰지 않는다.

로컬 리허설은 다음과 같이 재현한다. 기존 개발 DB를 초기화하지 않으며 임시 DB와 테스트 계정만 만들고 정리한다.
실제 dump 모드의 native backup/restore에는 로컬 Compose PostgreSQL이 필요하다.

```bash
OIOI_UUID_REHEARSAL_DUMP=.local/oioibawige_20260829_030417.dump pnpm test:integration:postgres:local
```

기본 dump는 Album 7·Song 26의 2026-08-29 snapshot이다. 현재 운영 9·26 또는 기존 개발 DB 8·26과
동일하다고 가정하지 않는다. 일반 CI는 격리 fixture로 전환/거부/rollback을 검증하며 이 private dump를 요구하지 않는다.

### P07 기존 응원법 수동 이관

UUID 전환과 P07 schema 적용을 마친 로컬 Compose DB에서만 실행한다. 기존 ACTIVE ADMIN의
UUID를 `--actor`에 지정한다. CLI는 공용 local DB guard를 통과한 URL만 사용하며 운영 입력은 지원하지 않는다.
새 계정·임의 가사를 만들거나 공개 reader를 자동 전환하지 않는다. 로컬 migration operator가
DB 권한으로 실행하는 도구이며 `--actor`로 Console 로그인·MFA 세션을 발급하지 않는다. 기존 Console
저장 경로의 MFA 검증은 유지하며 운영 적용 도구로 사용하지 않는다.

```bash
pnpm db:import-guides plan .local/p07-guide-map.json --actor '<ADMIN UUID>' --env-file apps/console/.env.local
# 대응표의 mode·sourceType·sourceUrl·안내 영상·설명을 직접 검토한 뒤 실행
pnpm db:import-guides check .local/p07-guide-map.json --actor '<ADMIN UUID>' --env-file apps/console/.env.local
pnpm db:import-guides apply .local/p07-guide-map.json --actor '<ADMIN UUID>' --env-file apps/console/.env.local
```

`plan`은 파일을 0600으로 새로 만들고 기존 파일을 덮어쓰지 않는다. 내용이 있는 가사와 기준 영상이
있는 곡만 후보로 넣고 제외한 곡 ID를 별도로 기록한다. `mode`와 `sourceType`은 미분류 null로 시작한다.
운영자가 `CONCERT / FESTIVAL`, `OFFICIAL / FANDOM`을 정하고 공식이면 원본 링크를 입력해야
`check/apply`를 통과한다. title/slug는 검토용이며 이관으로 변경하지 않는다. 검토하지 않은 항목은
이번 대응표에서 제외하고 추후 별도 검토한다. 기존 false/null flag를 팬덤으로 자동 추정하지 않는다.

생성 UUID·sourceFingerprint·referenceYoutubeId는 고정한 원본 기준이다. 원본이 달라지면 기존 표를
다시 검토하며 UUID나 fingerprint만 최신값으로 덮어 충돌을 우회하지 않는다. 승인된 JSON을 정규화해서
다시 쓰지 않고 원본 그대로 복사한다. Song의 가사·기존 flag·slug·연결 관계는 보존한다.

`check`는 이관 가능 여부만 검사한다. `apply`는 Song별 transaction으로 guide·snapshot·PUBLISH와
포인터를 함께 만든다. 파일 전체가 하나의 transaction은 아니므로 처리한 곡별 결과를 보존하고,
중간 실패 시 같은 대응표로 재확인한다. 같은 UUID·내용이 이미 이관됐으면 unchanged이며 이후 저장이나
다른 대응표가 적용됐으면 중단한다. 같은 곡을 두 모드로 자동 복제하지 않는다. 원 작성자는 미상 null,
공개 행위자는 실제 지정 ADMIN이다. 기존 편집기와 경합하면 둘 중 하나만 성공하고 다른 입력은 거절한다.

### 지정 Console 관리자 credential 재등록

전환으로 credential이 제거되고 MFA가 초기화된 **기존 ACTIVE ADMIN**만 재등록할 수 있다.
신규 Account 생성·권한 승격·기존 credential 덮어쓰기는 지원하지 않는다. 공개 가입/API bootstrap은 닫힌 상태를 유지한다.

기존 `console:mfa`와 같은 보호 operator 설정을 사용한다. config는 `scope=local-compose`, 실행자 UID,
정확한 local app-role DB URL, `extract(epoch from pg_postmaster_start_time())::text`의 인스턴스 값을 담는다.
main 로컬 DB는 `oioi_app`, 격리 DB는 runner가 준비한 대응 app role이어야 한다. config와 사유 파일은
소유자 본인·0600·단일 regular file이어야 하며 내용을 출력하거나 커밋하지 않는다.

```bash
pnpm console:bootstrap --config .local/operator.json --account-id '<새 UUID>' --expected-version '<reset 후 version 또는 none>' --reason-file .local/reason.txt --apply
```

TTY에서 이메일·새 비밀번호·비밀번호 확인을 숨김 입력한다. 비밀번호를 argv·env·파일로 전달하지 않는다.
DB 대상과 예상 version을 확인하고 한 번만 credential을 생성한다. 이후 위 Console MFA 절차로
등록 허용 → QR 등록/확인 → 다음 OTP 로그인 → 등록 허용 false 복귀를 수행한다. 키를 바꾸지 않는다.
이 로컬 절차는 운영 SSH target·migration·배포 적용 승인이 아니다.

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
컨테이너와 일곱 의존성 volume만 재생성한다. 대상은 `node_modules`, `web_node_modules`,
`console_node_modules`, `relay_node_modules`, `config_node_modules`, `contracts_node_modules`, `server_node_modules`다.
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
  '<PROJECT>_console_node_modules' '<PROJECT>_relay_node_modules' \
  '<PROJECT>_config_node_modules' \
  '<PROJECT>_contracts_node_modules' '<PROJECT>_server_node_modules'
docker compose -f compose.dev.yml up -d --build next
```

`ops/docker/Dockerfile.dev`는 `NPM_CONFIG_STORE_DIR=/pnpm/store`로 pnpm store를 컨테이너 내부에
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
```

정수 dump를 복원하려면 최신 UUID migration 전에 위 legacy-schema 복원 순서를 선택한다.
승인된 `.local/` dump가 없으면 빈 UUID 스키마만 사용한다.

`down -v`는 로컬 개발 데이터와 cache를 복구 불가능하게 삭제한다. 운영 volume에는 사용할 수 없다.

## 로컬 파형 JSON 생성·관리자 등록 (2026-10-31)

입력의 이용 범위와 등록 정책은 [Domain §20.2](../DOMAIN_SPECIFICATION.md#202-source-policy), 전환·운영 정리는 [DESIGN §6.5](console-guide-editor/DESIGN.md#65-로컬-분석json-등록-2026-10-31-개정)를 따른다. 이 명령은 앱 env/DB/로그인을 사용하지 않는 Linux/WSL 호스트 도구다. Docker의 로컬 Unix socket과 검증한 ARM64 Worker image `sha256:60276ecfe9f487ffb50c18cee030e680833c394113b2cd5e3e3e553f29d82039`가 필요하다. x86 호스트에서는 ARM64 실행 지원이 선행돼야 한다. 검증 산출물 적재는 [기존 전달 절차](../../../ops/oci/README.md#112-검증한-worker-이미지-전달)의 archive/checksum/image identity를 확인하며 실행 중 임의 pull·업데이트하지 않는다.

```bash
pnpm waveform:generate --video 'https://www.youtube.com/watch?v=pbELDkeLdho' --output .local/waveform/pbELDkeLdho.json
```

11자 ID 또는 위 canonical URL만 받는다. 이용 가능한 승인 입력으로 바꾸어 사용한다. 1GiB/swap 0·CPU 1·PID 32·120초 Rust/130초 외부 대기 한도·pipe/tmpfs·log none·앱 credential 미전달을 유지한다. 고정 `oioi-waveform-local` 이름으로 동시 분석을 막고 자기 실행 label만 정리한다. 실패/정리 미확인에는 JSON을 내보내지 않으며 기존 출력 파일은 덮어쓰지 않는다. `LOCAL_WAVEFORM_FAILED`이면 입력의 접근 가능 여부·고정 image 설치·출력 파일 중복과 해당 로컬 컨테이너 상태를 확인한다. 다른 실행의 컨테이너를 임의 삭제하지 않는다.

결과는 source/generationVersion을 포함한 기존 WaveformData JSON이다. Console의 해당 곡 편집 화면에서 **파형 JSON 등록**을 눌러 파일을 선택한다. ADMIN/MFA와 저장된 참고 영상이 필요하며, 영상 변경은 저장 후 다시 연다. 브라우저/서버가 크기·형식·source를 검사한 뒤 PostgreSQL에 등록하고 기존 조회·요청자 알림으로 연결한다. 별도 SSH/scp·Object Storage 업로드·분석기의 DB credential은 필요 없다. 기존 가사/Cue는 자동 변경하지 않는다. 실제 영상의 초반·중간·후반 anchor는 별도로 확인한다. 운영 사용은 해당 UI/API의 별도 승인 Promotion 이후이며 로컬 생성 성공만으로 운영 DB에 저장되지는 않는다.

## 현재 검사와 실행 소유권 (2026-10-23)

root `pnpm type-check`·`pnpm lint`(양 앱 FSD 포함)·`pnpm test:unit:run`은 workspace 검사를 모은다.
`pnpm test:harness`·`pnpm test:ops`·`pnpm format:check`와 repo 타입 검사는 root가 소유한다.
양 앱 local env 준비 후 `NEXT_PUBLIC_APP_ENV=local pnpm build`는 두 Next 앱을 빌드한다.
Worker는 자체 Node unit/type/lint만 연결하며 Next build·OCI runtime에는 포함하지 않는다.

`pnpm test:integration:postgres --local`은 실행 중인 Compose PG17에서 격리 DB/역할을 만들어
직렬 테스트 후 연결·lock·DB·역할을 정리한다. 서버 전용 두 테스트의 소스/타입은 packages/server,
Web foundation/HTTP 409와 operator CLI는 root 소유다. 기존 개발 데이터 reset이나 임의 seed는 하지 않는다.
root k6는 Web의 외부 대상에 수동 부하를 주는 별도 도구이며 일반 unit/verify에 포함하지 않는다.
검증 증거와 현재 보류 항목은 [정상화 RESULT](MONOREPO-CONFIGURATION-RESULT.md)를 따른다.

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

아래는 2026-08-29 최초 로컬 환경 구성 당시 영향 기록이다. 현재 인증 범위는 위의 Web/Console 구분을
따르며 Supabase Auth 보존을 현행 요구로 사용하지 않는다.

이번 작업의 production 직접 영향은 **0**이다.

- production DB에 연결하지 않았다.
- production migration을 실행하지 않았다.
- production credential/IP/hostname을 추가하지 않았다.
- Supabase Auth 구조를 변경하지 않았다.

추후 운영 작업 후보:

1. read-only로 `Song.slug` unique constraint와 timestamp precision을 재확인한다.
2. `Song_albumId_idx` 추가 여부를 실행 계획과 운영 부하 기준으로 결정한다.
3. 운영 DB의 현재 schema를 migration baseline과 reconcile한 뒤 migration history를 도입한다.

## 로컬 operator 연결 API

`CONSOLE_OPERATOR_ENABLED=true`를 Console 개인 설정에 추가하고 서버를 재시작하면
다음 경로를 평가한다. 기본은 비활성이다. Rust CLI 실행부는 후속 구현이다.

`/operator-connect`에서 기존 관리자 로그인·MFA를 확인한 뒤 CLI에 표시된 연결 코드를
직접 입력하고 승인한다. 로그인하지 않았다면 `/admin-login?next=operator`를 거쳐 같은
화면으로 돌아온다. `next`는 이 고정된 목적지만 허용하고 임의 URL을 받지 않는다.
연결 코드는 URL·storage·Query cache에 넣지 않으며 승인 응답을 받으면 폼에서 버린다.
승인 뒤 CLI로 돌아가 교환 결과를 확인한다. 승인 요청의 응답을 확인하지 못한 경우에도
CLI 상태부터 확인한다. 화면을 닫는 것은 이미 승인된 연결의 회수가 아니다.

`node apps/console/scripts/operator-connect-browser-smoke.mjs`는 실제 폼·Ky·응답 파서를
1440/390 폭의 로컬 브라우저 fixture에서 검사한다. Next Link·Sentry 어댑터와 승인 HTTP
결과만 대체하며, 실제 Auth.js·MFA·DB·Rust CLI 통합 검증을 대신하지 않는다.

빌드 후 `node apps/console/scripts/operator-connect-runtime-smoke.mjs`로 실제 standalone
앱의 비활성 404와 활성 상태의 기존 로그인 이동을 검사한다. 개인 env와 DB·R2·MFA
credential을 주입하지 않는다. 승인 페이지는 요청 시점에 flag를 평가하므로 비활성 빌드의
정적 404로 고정되지 않는다. 이 검사도 로그인 완료·승인·Rust 교환의 통합 검증과는 구분한다.

| 메서드·경로 | 입력·인증 | 응답 |
| --- | --- | --- |
| POST `/api/operator/auth/device` | `{}`; cookie·Origin 없는 CLI | deviceCode, userCode, expiresAt, intervalSeconds |
| POST `/api/operator/auth/token` | `{deviceCode}`; CLI | pending 또는 authorized·accessToken·expiresAt |
| POST `/api/operator/auth/approve` | `{userCode}`; 현재 ADMIN/MFA 세션·동일 Origin | `{approved:true}` |
| GET `/api/operator/auth/session` | bearer; cookie·Origin 금지 | accountId, expiresAt |
| POST `/api/operator/auth/revoke` | `{}`; bearer; cookie·Origin 금지 | `{revoked:true}` |

모든 응답은 `Cache-Control: no-store`다. 인증 POST 본문은 application/json·1 KiB 이하의
엄격한 계약으로 검증하며 client가 MFA version·계정·실행 명령을 지정할 수 없다.
발급은 IP당 분당 5회, polling은 IP당 분당 60회와 device당 5초에 1회, 승인은 계정당
분당 10회다. 제한 시 429와 Retry-After 초를 반환한다. 신뢰할 수 없는 IP는 공통 버킷을
사용한다. 프로세스별 최대 4096개 해시 버킷이며 재시작·다중 인스턴스 공유 제한은 아니다.
승인·교환의 일회성 및 만료는 DB에서 계속 보장한다. 비밀 원문을 URL·명령 기록에 넣지 않는다.

### 기존 곡 매칭·파형 조회·등록

다음 경로도 같은 활성화 설정과 현재 ADMIN/MFA를 재확인하는 bearer만 사용한다.
브라우저 cookie·Origin은 허용하지 않으며 일반 관리자 API에서 bearer를 받지 않는다.

| 메서드·경로 | 입력 | 응답 |
| --- | --- | --- |
| POST `/api/operator/songs/resolve` | `{videoIds:[...]}`; 1~500개 고유 ID, JSON 16 KiB 이하 | 입력 순서의 items: matched·missing·ambiguous |
| GET `/api/operator/songs/[id]/waveform` | 매칭된 song UUID | 현재 영상의 WaveformData 또는 null |
| PUT `/api/operator/songs/[id]/waveform` | 기존 WaveformData; 4 MiB 이하 | 기존 WaveformJob |

작업 파일의 곡 수는 이 API의 batch 상한과 별개다. CLI가 500개씩 나누어 조회한다.
matched는 songId·title·editorHref, ambiguous는 matchCount를 전달한다. 현재 schema에
`youtube_id` UNIQUE 제약이 없으므로 중복을 임의의 한 곡으로 축약하지 않는다. missing·ambiguous는
Console에서 확인하며 CLI가 새 곡을 만들지 않는다. 기존 schema나 운영 제약은 바꾸지 않는다.

등록은 기존 Song 잠금·현재 source 대조·JSON/Job/요청자 알림 transaction을 사용한다.
곡의 영상이 매칭 후 바뀌면 등록을 거절하고 기존 결과를 보존한다. 같은 JSON의 동시·재등록은
기존 성공 Job을 반환한다. 응답 유실은 GET 결과와 로컬 JSON을 대조하고 같은 JSON의 PUT으로
확인할 수 있다. Queue enqueue·서버 음원 fetch·가사/Cue·공개 상태 변경은 하지 않는다.
