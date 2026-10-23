---
title: "현재 코드의 환경변수 전체 사용 목록"
kind: migration-evidence
status: active
source_commit: 4822abb30c544ea86c6dab47f79267a4f18dcdd0
observed_at: "2026-10-23"
created_at: "2026-10-23"
revision: 1
---

# 현재 코드의 환경변수 전체 사용 목록

## 1. 조사 기준과 읽는 방법

`migration_main`과 `origin/migration_main`이 위 source_commit으로 같고 작업 트리가 깨끗함을 확인한 뒤 조사했다.
추적 파일 982개를 기준으로 앱·package·Worker·스크립트·Docker/Compose·CI·테스트·인프라를 대조했다.
개인 `.env`, `.env.local`, `.local/`과 운영 host/Vault의 실제 값·등록 상태는 읽지 않았다.
이 문서는 고정된 코드 관찰이며 실행 환경의 설정 완료나 실제 전송·배포 성공을 입증하지 않는다.

- `git ls-files`로 범위를 고정하고 `git grep`과 언어별 검색으로 참조·주입·예제를 대조했다.
- 추적 JS/TS 497개를 설치된 TypeScript parser로 분석해 property/bracket 접근을 확인했다.
  `process.env[name]`, 별칭 인자, 배열/상수 키, 환경 객체 복사와 하위 프로세스 전달은 호출부까지 따라갔다.
- Python `os.environ`, 셸 확장/간접 확장 `${!name}`·`source`·`export`, Docker ARG/ENV,
  Compose 보간, GitHub `vars`/`secrets`/step env, Wrangler binding, k6 `__ENV`도 포함했다.
- 테스트가 문자열로 생성하는 가짜 Node/Python/셸 consumer도 포함했다. enum·일반 상수·Sentry event의
  `environment` 필드·JSON 설정 필드를 process 환경변수로 세지 않았다.
- 프레임워크/SDK의 모든 내부 변수를 전수 조사한 것은 아니다. 저장소가 명시적으로 전달하는 입력과
  Console이 호출하는 설치된 Auth.js env adapter를 구분해 추가 확인했다.

**Next 앱·공통 package가 직접 읽거나 설정하는 이름은 27개, Worker binding은 2개다.**
아래 §2~§4의 합계이며 휴면 코드도 포함한다. Docker/CI/운영/테스트 입력은 별도다.
`NODE_ENV`처럼 프레임워크가 소비하는 변수까지 이 29개에 합쳐 제품 설정 개수를 부풀리지 않는다.
같은 키가 앱·CI·테스트에 다시 나와도 서로 다른 변수가 아니다.

사용법의 주 문서는 [로컬 개발 안내](LOCAL-DEVELOPMENT-ENVIRONMENT.md),
규범은 [Runtime §11~14](../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md),
관측 정책은 [Observability](../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md)다.
[기존 환경 증적](ENVIRONMENT-CONFIGURATION-EVIDENCE.md)은 10월 11일 snapshot으로 보존한다.
[정상화 결과](MONOREPO-CONFIGURATION-RESULT.md)의 완료 항목을 이번 조사로 다시 열지 않는다.

표의 **공개**는 client 노출 가능, **비밀**은 서버/도구에만 전달, **내부**는 공개 build 입력이 아닌 설정이다.
아래 source 링크는 모두 조사 commit에 고정했다.

## 2. 현재 Next 앱·공통 기반의 직접 입출력 — 22개

| 변수 | 소유·시점·구분 | 실제 해석과 누락/기본값 | 코드 근거 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | Web/Console build·공개 | `local`/`production`만 허용. Next config에서 누락·미지원 거절. local build도 local. metadata·client logger·Sentry가 helper를 공유한다. 휴면 메일도 명시적으로 읽는다. | [Web parser][w-env], [Console parser][c-env], [Next 진입점][w-next], [metadata][site], [메일][mail] |
| `NEXT_PUBLIC_SENTRY_DSN` | 두 앱 build·공개 | trim 후 production+비어 있지 않은 DSN일 때만 Sentry 활성화. local에서는 값이 있어도 비활성. 앱별 입력이며 현재 공용 프로젝트다. | [Web][w-sentry], [Console][c-sentry] |
| `NEXT_PUBLIC_GTM_ID` | Web build·공개 | truthy이면 GoogleTagManager 렌더링. trim/형식 검사나 APP_ENV 분기는 없다. Console 제품 consumer는 없다. | [Web layout][gtm] |
| `DATABASE_URL` | 두 앱이 쓰는 server DB·runtime·비밀 | 최초 `getDatabase()`에서 필수 검사 후 singleton 생성. 앱에서는 로컬 host 제한을 하지 않는다. Drizzle/로컬 도구는 별도 guard를 사용한다. | [DB][db], [Drizzle][drizzle], [로컬 loader][db-loader] |
| `CONSOLE_ORIGIN` | Console runtime·내부 | 누락 시 `http://127.0.0.1:3001`. HTTPS 또는 HTTP loopback만 허용하며 자격증명·경로·query·fragment 거절. origin/쿠키/CSRF 기준이다. launcher와 host materializer는 명시 입력을 요구한다. | [Console config][c-runtime], [launcher][launcher], [materializer][materializer] |
| `CONSOLE_AUTH_SECRET` | Console runtime·비밀 | 최소 32자, Web `AUTH_SECRET`과 같으면 거절. Auth.js에 secret을 명시적으로 전달한다. MFA 키와의 동일성도 인증 경계/launcher/host에서 검사한다. | [Console config][c-runtime], [Auth][auth], [MFA][mfa] |
| `CONSOLE_MFA_ENCRYPTION_KEY` | Console runtime·비밀 | canonical Base64 32 bytes. MFA 인증에서 Auth secret과 동일하면 거절. `/readyz`도 키 파싱을 확인한다. | [MFA][mfa], [crypto][crypto], [readyz][readyz] |
| `CONSOLE_MFA_ENROLLMENT_ENABLED` | Console runtime·내부 | 정확히 `true`일 때만 등록 허용. runtime의 누락/다른 값은 false; launcher/materializer는 true/false 입력을 검증한다. 기존 OTP 로그인과 별개다. | [Console config][c-runtime], [launcher][launcher], [materializer][materializer] |
| `AUTH_SECRET` | 공통 서버 휴면 OTP·비밀 / Console 비교 | OTP HMAC에는 필수. 현재 Web route의 로그인/메일 활성 입력은 아니다. Console은 fallback 없이 자기 secret·MFA 키와의 중복 비교에만 직접 사용한다. host Web 복구 매핑은 유지된다. | [OTP service][otp], [Console config][c-runtime], [MFA][mfa], [materializer][materializer] |
| `AUTH_URL` | Console이 생성하는 runtime 입력·내부 | `src/auth.ts` 평가 시 `getConsoleOrigin()` 결과로 덮어쓴다. 독립된 사용자 설정값으로 취급하지 않는다. Auth.js가 소비한다. | [Auth][auth] |
| `R2_ENDPOINT` | Console→공통 storage runtime·내부 | 필수 HTTPS URL, credentials/query/fragment 거절. SDK endpoint. | [storage][storage], [readyz][readyz] |
| `R2_BUCKET` | Console→공통 storage runtime·내부 | 비어 있거나 공백뿐이면 거절. 기존 bucket 이름은 그대로 사용한다. | [storage][storage] |
| `R2_ACCESS_KEY_ID` | Console→공통 storage runtime·비밀 | 필수·공백 거절. 명시적 S3 credential로 전달. Web의 현재 공개 조회에는 필요 없다. | [storage][storage] |
| `R2_SECRET_ACCESS_KEY` | Console→공통 storage runtime·비밀 | 필수·공백 거절. 위 키와 함께 전달. | [storage][storage] |
| `ASSETS_PUBLIC_BASE_URL` | Console→공통 storage runtime·내부, 결과 URL은 공개 | 필수 HTTPS URL, credentials/query/fragment 거절·마지막 slash 제거. object key와 합쳐 응답 URL 생성. `NEXT_PUBLIC_` 변수는 아니다. | [storage][storage] |
| `SENTRY_SOURCE_MAPS_ENABLED` | 두 앱 build·내부 | 정확히 `true`여야 업로드 설정 활성. 기본 false/off. runtime Sentry 활성화와 독립이다. | [Web build config][w-sbuild], [Console build config][c-sbuild] |
| `SENTRY_AUTH_TOKEN` | 두 앱 build·비밀 | 위 모드에서 trim 후 필수. Docker는 ARG/ENV 대신 BuildKit secret mount→해당 RUN의 env로 전달. Turbo passThroughEnv이며 hash 입력은 아니다. | [build config][w-sbuild], [Docker][docker], [Turbo][turbo] |
| `SENTRY_ORG` | 두 앱 build·내부 | source map 모드에서 trim 후 필수. GitHub Vars→build arg→build process. | [build config][w-sbuild], [candidate CI][candidate-ci] |
| `SENTRY_PROJECT` | 두 앱 build·내부 | 위와 동일. 현재 두 앱은 같은 project 입력을 사용한다. | [build config][c-sbuild], [candidate CI][candidate-ci] |
| `SENTRY_RELEASE` | 두 앱 build·내부 | source map 모드에서 `oioi-bwg@<소문자 40자리 SHA>` 필수. event correlation은 env 또는 SDK가 삽입한 전역 release ID를 읽는다. | [build config][w-sbuild], [Web metadata][w-release], [Console metadata][c-release] |
| `OIOI_EPHEMERAL_BUILD` | 공통 Next config build·내부 | `true`이면 Turbopack filesystem build cache를 끈다. 그 외는 켠다. Docker builder는 true로 고정한다. | [Next factory][next-factory], [Docker][docker] |
| `NEXT_RUNTIME` | Next 제공 runtime·내부 | instrumentation에서 `nodejs`일 때 server Sentry config를 import. 사용자 배포 환경값이 아니다. | [Web instrumentation][w-instrument], [Console instrumentation][c-instrument] |

APP_ENV의 직접 helper caller는 두 앱의 config 검증·Sentry config·`shared/lib/client-logger.ts`와
Web `site.ts`다. Sentry config의 caller는 각 앱의 `sentry.server.config.ts`,
`instrumentation.ts`/`instrumentation-client.ts`, `server/observability`의 server-error-reporter·
server-logger·server-sentry-reporter, Web `shared/lib/sentry/index.ts`·Console `shared/lib/sentry.ts`다.
이들은 별도 환경변수 이름을 추가하지 않고 같은 APP_ENV/DSN 해석을 소비한다.

## 3. 공통 서버 휴면 메일 consumer — 추가 5개

메일/계정 기능은 보류 상태다. 아래 코드는 남아 있지만 현재 Web 기능의 필수 설정 목록은 아니다.
`AUTH_SECRET`/`NEXT_PUBLIC_APP_ENV`는 §2에 이미 셌다. [메일 provider][mail]와 [정상화 결과](MONOREPO-CONFIGURATION-RESULT.md)를 함께 읽는다.

| 변수 | 시점·구분 | 실제 해석 |
| --- | --- | --- |
| `EMAIL_DELIVERY_MODE` | 호출 시·내부 | `dev`/`oci`. 누락 시 local→dev(no-send), production→oci. production+dev 거절. local에서 **명시적 oci는 허용**하는 코드이므로 local이라는 이유만으로 모든 메일 경로가 no-send라고 확대하지 않는다. |
| `OCI_EMAIL_REGION` | OCI client 최초 생성·내부 | 선택 입력. 있으면 SDK client regionId 설정; 없으면 provider/SDK 경로에 맡긴다. |
| `OCI_EMAIL_COMPARTMENT_OCID` | OCI 제출 시·내부 | oci 모드에서 필수. `process.env[name]`의 실제 호출 인자다. |
| `OCI_EMAIL_SENDER_ADDRESS` | OCI 제출 시·내부 | oci 모드에서 필수. 위와 동일. |
| `OCI_EMAIL_SENDER_NAME` | OCI 제출 시·내부 | 선택 입력. sender display name. |

Instance Principal provider가 IMDS에 의존하는 반면 현재 container는 metadata 접근을 차단한다.
변수 목록 존재나 과거 host 예제를 실제 발송 가능성의 증거로 삼지 않는다. 재활성화·인증 설계·실제 전송은 별도다.

## 4. 독립 Worker binding — 추가 2개

| 변수 | 구분 | 실제 소비와 주입 |
| --- | --- | --- |
| `SENTRY_WEBHOOK_SECRET` | 비밀 | relay 요청의 HMAC 서명 검사. 없으면 500. `process.env`가 아닌 Cloudflare `Env` binding. |
| `SLACK_SENTRY_WEBHOOK_URL` | 비밀 | Slack webhook URL 검사 후 POST. 없거나 잘못되면 500. 배포 알림용 `SLACK_DEPLOY_WEBHOOK_URL`과 다른 키다. |

[Worker consumer][relay]와 [Wrangler required secrets][wrangler]가 같은 두 이름을 사용한다.
payload의 `environment`는 데이터 필드이며 Worker 환경변수가 아니다. 이번 조사에서 Wrangler 배포·secret 조회·전송은 하지 않았다.

## 5. 로컬 DB·관리 도구의 별도 입력

| 변수 | 실제 소비/보호 | 근거 |
| --- | --- | --- |
| `M9_POSTGRES_ADMIN_URL` | runtime role bootstrap CLI의 필수 관리자 URL. 일반 앱 DB 입력과 분리. | [role tool][roles] |
| `M9_DB_APP_PASSWORD`, `M9_DB_MIGRATOR_PASSWORD` | 위 CLI의 필수 역할 password. 앱의 자동 입력은 아니다. | [role tool][roles] |
| `M9_PRODUCTION_CHANGE_ACK` | 원격 host면 CLI의 `--allow-production`과 정확한 ACK를 함께 요구. 코드 존재가 운영 실행 승인을 뜻하지 않는다. | [role tool][roles] |
| `DOTENV_KEY`, `DOTENV_CONFIG_PATH`, `DOTENV_CONFIG_*` | Drizzle wrapper에서 KEY와 CONFIG 접두사 전체를 제거한 뒤 PATH를 OS devNull로 설정. guard 뒤 dotenv가 두 번째 파일을 읽지 못하게 한다. `DOTENV_CONFIG_OVERRIDE`는 이 family의 테스트 사례. | [DB wrapper][db-wrapper] |

[DB loader][db-loader]는 process `DATABASE_URL` 또는 명시한 `--env-file`의 **DATABASE_URL만** 읽는다.
둘이 다르면 거절하고 postgres/localhost/127.0.0.1 host·PostgreSQL protocol·query/fragment 부재를 검사한다.
Web env를 자동 탐색하지 않는다. generate는 child에서 DATABASE_URL을 제거한다.

[Console launcher][launcher]는 `apps/console/.env.local`을 parse해 검사하고 process env 위에 덮어쓴 뒤
`NEXT_PUBLIC_APP_ENV=local`을 강제한다. 현재 로컬 migrator URL은 코드의 Compose 전용 고정값이며
별도의 `MIGRATION_DATABASE_URL`을 읽지 않는다. [복원 스크립트][restore]도 인자 dump와 고정 Compose 좌표를 사용한다.
Console MFA operator의 `databaseUrl` 등은 보호된 JSON 설정 키이며 독립 환경변수가 아니다.
[CLI adapter][mfa-execution]가 선택한 URL을 내부 `process.env.DATABASE_URL`로 설정한다.

## 6. 예제·주입과 실제 사용의 차이

| 추적 입력 | 현재 관찰 |
| --- | --- |
| [Web 예제][w-example] | DATABASE_URL, NEXT_PUBLIC_APP_ENV, NEXT_PUBLIC_SENTRY_DSN의 3개. GTM은 실제 선택 consumer가 있으나 예제에는 없다. |
| [Console 예제][c-example] | 위 3개+Console 4개+R2/asset 5개의 12개. Sentry source map 게시용 변수는 앱 로컬 예제에서 요구하지 않는다. |
| [Web host public 예제][host-public] | R2/asset·메일 입력 8개. 이전 이미지/호환 consumer를 위한 보존이며 새 Web의 활성 기능 목록과 같지 않다. 주석의 app.env는 단일 앱 경로 이력이고 현재 paired 출력은 web.env다. |
| [Web host secret 매핑][host-secret] | DB_APP_PASSWORD, AUTH_SECRET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. 값은 credential 원문이 아니라 Vault secret OCID. |
| [Console host public][console-public], [secret 매핑][console-secret] | origin/등록 flag/R2 주소와 Console auth/MFA/R2 credential 매핑. materializer의 앱별 허용 목록과 대조했다. |
| Docker·Turbo | Console Dockerfile에도 GTM ARG가 공통 builder 때문에 남아 있다. Console candidate CI는 GTM을 주입하지 않으며 Console 제품 source consumer도 없다. |
| host runtime env | NEXT_PUBLIC 키는 image build 입력이다. host env 파일 값만 바꿔 기존 client bundle이 바뀐다고 보지 않는다. |
| 과거 변수 | `NEXT_PUBLIC_ASSETS_URL`, `DATABASE_DIRECT_URL`, `DEV_*` flag, Supabase/Hyperdrive의 제품 consumer는 조사 기준의 추적 실행 코드에서 찾지 못했다. 과거 문서나 개인 파일의 존재와 구분한다. |

host Web public은 secret/CONSOLE 키를 막지만 Console처럼 모든 public 이름을 allowlist로 제한하지 않는다.
따라서 **임의 public 키를 파일에서 child에 전달할 수 있다는 사실과 현재 코드의 실제 consumer는 별개**다.
환경 객체를 통째로 상속하는 subprocess도 있으므로 모든 OS/의존성 변수의 가능한 이름을 유한 목록으로 보장하지 않는다.

운영·CI·컨테이너·테스트 전용 입력의 전체 이름은 [별도 목록](ENVIRONMENT-VARIABLE-OPERATIONS-INVENTORY.md)에 기록했다.
현재 저장소의 앱 해석은 분산돼 있다: APP_ENV/Sentry는 앱 helper, Console은 runtime helper,
DB/storage/mail은 공통 server, 로컬 도구와 host materializer는 자기 경계에서 검증한다.
단일 통합 env schema가 있다고 보고하지 않는다. 이 관찰만으로 새 schema 도입이나 보존 설정 삭제를 결정하지 않는다.

## 7. 확인 결과와 한계

이번 변경은 조사 문서와 개발 안내의 링크뿐이다. 코드·개인 env·등록 Secrets/Vars·외부 리소스는 변경하지 않는다.
정적 검색/구문 분석, 동적 키 호출부 대조, 예제·주입의 이름 대조를 수행했다.
문서만 바뀌므로 type/lint/unit/build, DB 연결, k6, SDK 전송, host probe는 실행하지 않는다.
문서 경로·포맷·diff와 최종 PR의 docs-only CI는 별도로 확인하며 CI 링크는 PR 본문에 남긴다.
`#199`는 기존 head의 Draft로 보존한다. F/www·운영/Worker 배포·실제 외부 전송·메일/계정 재활성화·UI-03은 보류다.

<!-- 아래 링크는 현재 HEAD가 아닌 조사 기준 commit에 고정한다. -->
[w-env]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/shared/config/app-env.ts#L6
[c-env]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/shared/config/app-env.ts#L6
[w-next]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/next.config.ts#L9
[site]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/shared/config/site.ts#L9
[mail]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/packages/server/src/email/oci-email-delivery.ts#L43
[w-sentry]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/shared/config/sentry.ts#L12
[c-sentry]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/shared/config/sentry.ts#L12
[gtm]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/app/layout.tsx#L46
[db]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/packages/server/src/db/index.ts#L8
[drizzle]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/drizzle.config.ts#L5
[db-loader]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/local-database-environment.ts#L27
[c-runtime]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/shared/config/console-runtime.ts#L9
[launcher]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/dev-console-local.mts#L11
[materializer]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/materialize-runtime-env.py#L37
[auth]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/auth.ts#L21
[mfa]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/server/auth/authenticate-console.ts#L7
[crypto]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/packages/server/src/auth/admin-mfa-crypto.ts
[readyz]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/app/readyz/route.ts#L12
[otp]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/packages/server/src/services/email-verification-service.ts#L34
[storage]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/packages/server/src/storage/upload-public-asset.ts#L31
[w-sbuild]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/shared/config/sentry-build.ts#L19
[c-sbuild]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/shared/config/sentry-build.ts#L19
[docker]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/Dockerfile#L30
[turbo]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/turbo.json#L60
[candidate-ci]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/.github/workflows/verify.yml#L400
[w-release]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/shared/lib/sentry-build-metadata.ts#L91
[c-release]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/shared/lib/sentry-build-metadata.ts#L91
[next-factory]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/packages/config/next.ts#L10
[w-instrument]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/src/instrumentation.ts#L18
[c-instrument]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/src/instrumentation.ts#L18
[relay]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/sentry-slack-relay/src/index.mts#L348
[wrangler]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/sentry-slack-relay/wrangler.toml#L7
[roles]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/configure-postgres-runtime-roles.ts#L274
[db-wrapper]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/run-local-database-tool.ts#L14
[restore]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/restore-local-dump.sh
[mfa-execution]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/console-mfa-execution.ts#L14
[w-example]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/.env.example
[c-example]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/.env.example
[host-public]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/env/runtime-public.env.example
[host-secret]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/env/runtime-secrets.env.example
[console-public]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/console-runtime-public.env.example
[console-secret]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/console-runtime-secrets.env.example
