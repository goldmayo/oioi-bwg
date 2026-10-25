---
title: "환경변수 운영·CI·도구·테스트 입력 목록"
kind: migration-evidence
status: active
source_commit: 4822abb30c544ea86c6dab47f79267a4f18dcdd0
observed_at: "2026-10-23"
created_at: "2026-10-23"
revision: 1
---

# 환경변수 운영·CI·도구·테스트 입력 목록

[제품/Worker 목록과 조사 방법](ENVIRONMENT-VARIABLE-INVENTORY.md)의 부록이다. 같은 고정 commit을 관찰했다.
이 표는 앱의 `.env.local`에 전부 채워야 할 목록이 아니다. 단계 내부 전달·생성·삭제 전용 입력도 구분한다.
앱 변수의 의미는 본문을 따르며, 여기서는 앱 밖의 consumer를 기록한다.

## 1. OCI host 설정과 Compose

[deploy wrapper][deploy]는 보호된 `deploy.conf`를 `set -a; source`하여 Python child에 export한다.
[materializer][materializer]가 공개 파일+Vault 매핑을 검증하고 앱별 temporary env를 만들며
[paired release][paired]가 Web·Console Compose 입력을 생성한다. 파일의 KEY=VALUE와 프로세스 env를 혼동하지 않는다.

| 변수 | 실제 소비·기본값/생성 |
| --- | --- |
| `IMAGE_REPOSITORY`, `CONSOLE_IMAGE_REPOSITORY` | deploy.conf→paired candidate의 앱별 repository와 일치 검사. CI에서도 같은 이름으로 생성. |
| `POSTGRES_NETWORK` | 기존 Docker network 이름. paired config 필수, Compose interpolation 필수. |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER` | materializer가 동적 `os.environ[key]`로 읽는 네 좌표. port 범위 검사, user는 oioi_app만 허용. |
| `DB_APP_PASSWORD` | Vault 매핑 파일의 이름. 읽은 값을 URL encoding해 DATABASE_URL로 합친 뒤 출력 env에서는 제거. 앱의 별도 env consumer는 없다. |
| `APP_BIND_ADDRESS` | paired config 필수이며 127.0.0.1만 허용. Compose 자체 기본도 127.0.0.1. |
| `APP_PORT`, `CONSOLE_PORT` | paired config 필수, 범위 및 서로 다른 값 검사. Compose 기본 3000/3001. container 내부 PORT와 구분. |
| `SMOKE_PATHS`, `CONSOLE_SMOKE_PATHS` | paired config 필수. 앱별 /healthz·/readyz 뒤 추가 HTTP 경로를 검사. |
| `REQUIRED_RUNTIME_KEYS` | materializer의 추가 필수 키 목록. paired Web 기본 DATABASE_URL AUTH_SECRET, Console은 코드가 세 필수 secret/DB 이름으로 교체. |
| `WEB_IMAGE`, `CONSOLE_IMAGE` | paired release가 repository@digest로 생성→Compose가 사용. 사용자 mutable tag 전환 입력이 아니다. |
| `WEB_ENV_FILE`, `CONSOLE_ENV_FILE` | paired release가 snapshot 또는 runtime의 web.env/console.env로 생성. Compose 기본 /srv/oioibawige/web.env·console.env. raw env 파일로 읽는다. |
| `APP_IMAGE`, `APP_ENV_FILE` | **단일 앱 복구 경로**에서만 이전 deploy.conf·Compose와 함께 생성/사용. 현재 paired 서비스의 새 입력이 아니다. [legacy 예제][legacy] 보존. |
| `OCI_REGION`, `OCI_METRIC_COMPARTMENT_OCID`, `OCI_COMPUTE_INSTANCE_OCID` | deploy.conf를 읽는 filesystem metric script의 필수 region·metric compartment·instance dimension. [metric][metric]은 OCI 호출 경로지만 이번 조사에서 실행하지 않았다. |
| `OIOI_DEPLOY_CONFIG` | metric script가 읽을 보호된 설정 파일 경로. 기본 /etc/oioibawige/deploy.conf. |
| `OIOI_RUNTIME_ROOT`, `OIOI_CONFIG_ROOT` | deploy/preflight/paired/probe의 경로 선택. 기본 /srv/oioibawige, /etc/oioibawige. |
| `OIOI_STATE_DIR`, `OIOI_COMPOSE_FILE` | paired/deploy 경로 선택. 기본 runtime/deploy, runtime/compose.oci-development.yml. |
| `M9_DEPLOY_TEST_MODE` | deploy wrapper에서 정확히 1이면 root/보호 파일 검사의 테스트 경로. 제품 feature flag가 아니다. 기본 0. |
| `OCI_DEPLOYMENT_ID` | [Run Command probe][probe] 기록값. 누락 시 manual-probe. OCI 자격증명이나 앱 환경값이 아니다. |

현재 [Compose][compose]는 두 서비스에 NODE_ENV=production, HOSTNAME=0.0.0.0, PORT=3000을 주입한다.
public/secret 매핑의 앱 변수는 본문 §2·§3·§6 참조. DB_APP_PASSWORD의 매핑 값은 password가 아니라 secret OCID다.

## 2. GitHub 등록 입력 — Vars 8개 / Secrets 8개

아래는 **추적 workflow가 참조하는 이름**이다. 실제 등록 여부·값·유효성·현재 권한을 조회한 결과가 아니다.
[candidate workflow][candidate-ci]와 [deploy workflow][deploy-ci]는 oci-development-image Environment를 지정한다.

| 종류 | 이름 | consumer |
| --- | --- | --- |
| Vars | `OCIR_REGISTRY`, `OCIR_NAMESPACE` | Web/Console repository URL 구성, registry login 대상. B0 수동 도구도 같은 env 이름을 읽는다. |
| Vars | `OCIR_REPOSITORY`, `OCIR_CONSOLE_REPOSITORY` | 앱별 repository 이름. 둘의 최종 repository는 달라야 한다. |
| Vars | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Promotion의 양 앱 build 입력; required 검사. |
| Vars | `NEXT_PUBLIC_GTM_ID` | Web candidate build 입력. required 배열에는 없으며 Console candidate에는 전달하지 않는다. |
| Secrets | `SENTRY_AUTH_TOKEN` | candidate required 검사·BuildKit secret. runtime env 파일에 쓰지 않는다. |
| Secrets | `OCIR_USERNAME`, `OCIR_AUTH_TOKEN` | docker/login-action 입력. 앱 환경변수가 아니다. |
| Secrets | `OCI_CLI_USER`, `OCI_CLI_TENANCY`, `OCI_CLI_FINGERPRINT`, `OCI_CLI_KEY_CONTENT` | deploy job env의 API key credential. auth action/OCI CLI 경로가 소비. |
| Secrets | `SLACK_DEPLOY_WEBHOOK_URL` | candidate/deploy 알림 step의 curl URL. Worker용 SLACK_SENTRY_WEBHOOK_URL과 별개. |

`OCI_CLI_REGION`과 `OCI_COMPUTE_COMPARTMENT_OCID`/`OCI_COMPUTE_INSTANCE_OCID`도 deploy job env지만
위 Vars/Secrets 참조가 아니라 workflow 상수다. 식별자 원문은 이 문서에 복제하지 않는다.
[B0 CI 도구][b0]는 OCI_CLI_KEY_CONTENT를 temporary key 파일로 옮기고 child env에서 원문을 제거한 뒤
`OCI_CLI_KEY_FILE` 경로를 생성한다. B0는 수동 증명용 경로이며 완료된 B0를 재실행하지 않는다.

GitHub의 `${{ github.token }}`은 Action input/context 경로이며 저장소 자체의 `process.env.GITHUB_TOKEN` consumer는 아니다.
같은 이유로 Terraform 변수나 candidate JSON 필드를 모두 새 환경변수로 세지 않는다.

## 3. CI job/step 내부 전달

| 이름 | 생성/소비 경로 |
| --- | --- |
| `VERIFICATION_NEEDS` | verify job이 toJSON(needs)를 env로 전달→[scope script][scope]가 전체 결과 검사. |
| `VERIFY_RESULT`, `CANDIDATE_RESULT` | Promotion 최종 shell gate가 success인지 검사. CANDIDATE_RESULT는 Slack payload에도 사용. |
| `SOURCE_SHA`, `SOURCE_TREE` | source 검증 output→deploy candidate identity 검사. SHA는 B0·Slack에도 사용. |
| `IMAGE_REPOSITORY`, `CONSOLE_IMAGE_REPOSITORY` | Vars 조합→build tag·candidate 검증·baseline 선택. host에서도 동명 설정을 별도로 확인. |
| `IMAGE_DIGEST`, `CONSOLE_IMAGE_DIGEST` | build 또는 reuse output→공동 smoke·candidate/알림. Web쪽은 IMAGE_DIGEST로 명명. |
| `WEB_BUILD_SOURCE_SHA`, `CONSOLE_BUILD_SOURCE_SHA` | 선택된 이미지의 실제 source SHA→[공동 smoke][pair-smoke]의 label/proof 대조. Python의 app.upper() 동적 이름 포함. |
| `IMAGE_PLAN_FILE` | step의 temporary JSON 경로→[baseline][baseline]이 기록, [promotion][promotion]이 읽음. |
| `BASELINE_DIR`, `BASELINE_ARTIFACT_ID`, `BASELINE_RUN_ID`, `BASELINE_RUN_ATTEMPT` | 다운로드한 과거 성공 증거의 디렉터리/identity→baseline selector. |
| `PAIR_SMOKE_FILE` | step env로 지정한 경로→공동 smoke가 기록, promotion이 읽음. |
| `CANDIDATE_FILE`, `CANDIDATE_RUN_ID`, `CANDIDATE_RUN_ATTEMPT` | deploy candidate JSON 경로와 검증 run identity→workflow inline Node가 읽음. |
| `WEB_IMAGE_DIGEST`, `CONSOLE_IMAGE_DIGEST`, `CANDIDATE_PAYLOAD` | deploy step env→검증 shell 및 Run Command wrapper의 argv로 전달. 후자의 내부 동명 shell 변수는 위치 인자로 다시 생성됨. |
| `CANDIDATE_DIR`, `CANDIDATE_ARTIFACT_ID`, `OCI_COMMAND_ID`, `DEPLOY_EXIT_CODE` | 성공한 deploy receipt 생성 입력. exit code는 0일 때만 성공 증거 기록. |
| `PHASE`, `PUBLISH_RESULT`, `CONSOLE_PUBLISH_RESULT`, `CANDIDATE_RESULT`, `DEPLOY_RESULT` | [Slack payload generator][slack]의 단계/결과 표시. |
| `DEPLOYMENT_BLOCKED` | Slack generator가 읽는 선택 분기지만 현재 workflow의 env 주입은 없다. |
| `RUN_URL`, `SOURCE_SHA`, `IMAGE_DIGEST`, `CONSOLE_IMAGE_DIGEST`, `DEPLOY_EXIT_CODE` | Slack generator의 링크/source/digest/상태 입력. |

배포/알림 코드를 실행해서 확인한 결과가 아닌 source/전달 대조다. 이 PR의 migration_main 문서 CI는
Promotion·deploy·알림 경로의 실행을 요청하지 않는다.

## 4. 컨테이너·프레임워크·도구 입력

| 변수 | 실제 사용 |
| --- | --- |
| `NODE_VERSION` | 두 앱 Dockerfile의 base/runtime FROM을 선택하는 ARG. 기본 22.16.0-bookworm-slim. 앱 runtime env로 자동 전달되지 않는다. |
| `BUILD_APP` | Docker build ARG. all/web/console만 허용; 앱별 기본 web/console. CI 검증은 all, candidate는 해당 앱. |
| `NODE_ENV` | Next/도구 실행 모드. Docker production, 개발 Compose development, PG runner test. Turbo build env/hash에도 포함. 직접 제품 코드의 배포 환경 추론에는 쓰지 않는다. |
| `NEXT_TELEMETRY_DISABLED` | Docker builder/runtime에서 1. Next의 telemetry 입력. |
| `NPM_CONFIG_STORE_DIR` | 운영/개발 이미지의 pnpm store 선택 입력. /pnpm/store. |
| `HOSTNAME`, `PORT` | standalone server 입력. 이미지/OCI Compose는 0.0.0.0:3000, host Console start는 127.0.0.1:3001. |
| `HUSKY` | 개발 Dockerfile에서 install 단계 0. 이 작업의 commit/push에서 hook을 우회하기 위해 설정하지 않는다. |
| `NODE_OPTIONS` | 두 앱 package lint:fsd가 기존 값을 보존하며 --import tsx를 붙여 Steiger 실행. |
| `TURBO_SCM_BASE`, `TURBO_SCM_HEAD` | pre-push 및 release selector/harness가 Turbo affected 기준을 전달. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | 개발 Compose의 로컬 PG17 초기 입력. 코드의 개발 전용 좌표이며 운영 credential 아님. |
| `POSTGRES_HOST_AUTH_METHOD` | CI PostgreSQL service의 trust 설정. 위 DB/user도 해당 격리 service별로 지정한다. |
| `PATH` | 일반 child 상속/fixture mock binary 선택; operator와 metadata service는 고정 경로를 전달. B0 scratch proof 이미지의 PATH도 실행 차단용 고정값이다. |
| `TMPDIR` | paired Run Command 테스트가 temporary 출력 위치를 격리하는 tool 입력. |
| `XDG_CONFIG_HOME`, `XDG_DATA_HOME` | HTTPS/retirement proxy smoke에서 Caddy 설정/데이터를 임시 디렉터리로 격리. |
| `PYTHONOPTIMIZE` | metadata guard 테스트가 1을 주입해 Python 최적화로 assert가 제거되어도 명시적 guard가 거절하는지 확인. 제품 feature flag가 아니다. |
| `SUDO_UID`, `SUDO_USER` | host Console operator가 실행 주체를 검사. 일반 앱 설정이 아니다. |
| `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` | Turbo/scope 회귀가 상속 Git 변수를 흉내 낸다. scope/harness의 깨끗한 child는 GIT_ 접두사 전체를 제거한다. |
| `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM` | scope/Turbo 테스트가 외부 Git 설정을 배제하기 위해 주입. |

[Docker][docker], [개발 Docker][dev-docker], [package scripts][web-package], [Console scripts][console-package],
[개발 Compose][dev-compose], [Turbo][turbo], [scope][scope], [operator][operator], [metadata service][metadata-service] 참조.
`BASH_SOURCE`/`EUID`는 shell 내장 변수다. 스크립트에서 읽지만 앱 env 파일에 설정할 환경변수로 분류하지 않는다.

GitHub runner가 제공하며 코드에서 사용하는 이름:
`GITHUB_WORKSPACE`(module 경로), `GITHUB_EVENT_NAME`/`GITHUB_EVENT_PATH`(scope 판정),
`GITHUB_RUN_ID`/`GITHUB_RUN_ATTEMPT`(증거 identity), `GITHUB_SHA`(배포 기록/알림),
`GITHUB_OUTPUT`(step 출력), `GITHUB_STEP_SUMMARY`(결과 표시), `GITHUB_ACTIONS`(격리 host 설치 fixture guard).
문맥 객체의 github.* 전체를 환경변수로 세지 않는다.

### Console Auth.js의 간접 소비

설치된 next-auth 5.0.0-beta.32의 lib/env.js와 @auth/core 0.41.3의 lib/utils/env.js도 대조했다.
이는 추적 소스 29개 밖의 dependency 동작이며 repository consumer와 구분한다. 버전 근거는 [lockfile][lockfile]이다.

| 이름 | 현재 Console에서의 의미 |
| --- | --- |
| `AUTH_URL`, `NEXTAUTH_URL` | adapter의 URL 입력. 앱이 AUTH_URL을 CONSOLE_ORIGIN으로 먼저 설정하므로 NEXTAUTH_URL fallback은 선택되지 않는다. |
| `AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_SECRET_1`, `AUTH_SECRET_2`, `AUTH_SECRET_3` | 라이브러리의 fallback/회전 입력. 앱의 유효한 CONSOLE_AUTH_SECRET을 config.secret에 명시하므로 이를 대체하지 않는다. |
| `AUTH_REDIRECT_PROXY_URL` | core가 config.redirectProxyUrl 기본값으로 읽는다. 추적 예제·주입은 없으며 현재 Credentials만 사용하므로 OAuth 기능 활성의 근거가 아니다. |
| `AUTH_TRUST_HOST`, `VERCEL`, `CF_PAGES`, `NODE_ENV` | core의 trustHost 추론 후보. 앱은 trustHost:true를 명시하므로 그 fallback 분기에 의존하지 않는다. |
| `AUTH_CREDENTIALS_ID`, `AUTH_CREDENTIALS_SECRET`, `AUTH_CREDENTIALS_ISSUER`, `AUTH_CREDENTIALS_KEY` | provider ID로 조합해 조회하지만 Credentials provider에는 OAuth/email 설정으로 적용되지 않는다. 구성할 제품 필수 키가 아니다. |

Next/OCI/AWS/Node SDK가 지원하는 모든 표준 env를 여기서 재열거하지 않는다. 저장소가 명시하지 않은
자동 credential chain, proxy, telemetry/debug 옵션이 외부 환경에 존재하는지는 이번 source 조사로 확정할 수 없다.
현재 R2 client는 endpoint/credential을 명시하고, 휴면 메일은 Instance Principal을 명시한다.

## 5. 테스트·smoke 전용 입력

| 이름 | consumer / 생성 책임 |
| --- | --- |
| `M7_TEST_POSTGRES_ADMIN_URL` | [PG runner][pg-runner]가 --local 없을 때 읽는 관리자 URL. localhost/127.0.0.1의 postgres maintenance DB만 허용. --local은 Compose 전용 URL 사용. child에서는 관리자 변수 제거. |
| `M7_TEST_POSTGRES_VERIFICATION_URL` | runner가 만든 격리 DB 관리자 URL→foundation/브라우저 fixture 검증. DATABASE_URL은 제한된 runtime role URL로 별도 전달. |
| `M9_TEST_ADMIN_ROLE`, `M9_TEST_DRIZZLE_SCHEMA_OWNER`, `M9_TEST_POSTGRES_MIGRATOR_URL` | runner 생성→foundation의 소유권/권한/migration 검증. |
| `M9_TEST_PUBLIC_SCHEMA_OWNER`, `M9_TEST_RUNTIME_APP_ROLE`, `M9_TEST_RUNTIME_MIGRATOR_ROLE` | 위와 동일. 운영 앱 변수 아님. |
| `P04_ARTIFACT_DIR`, `P04_SCREENSHOT_PATH` | admin browser/standalone smoke의 artifact 디렉터리·선택 screenshot 경로. |
| `P06_CADDY_BINARY`, `P06_KEEP_ARTIFACTS` | HTTPS smoke의 필수 inspected Caddy 경로·true이면 artifact 보존. |
| `P06_HTTPS_ORIGIN`, `P06_TLS_KEY_PIN` | admin smoke의 선택 TLS origin·browser certificate SPKI pin. |
| `BASE_URL`, `K6_WEB_DASHBOARD` | k6 파일은 __ENV.BASE_URL을 읽고 기존 staging hostname을 기본값으로 둔다. root 세 package script는 같은 URL과 dashboard=true를 전달한다. 성능 테스트 입력이며 실행하지 않았다. |
| `DB_TOOL_RESULT`, `DB_TOOL_EXIT_CODE`, `UNRELATED_FILE_VALUE` | local-database-tools fixture가 만든 가짜 CLI의 결과 위치·종료코드·불필요한 파일 값 전파 방지 확인. |
| `INSTALL_TEST_ROOT`, `INSTALL_TEST_REPOSITORY` | host-assets fixture가 경로/권한 검사와 복사한 installer의 repository_root를 임시 경로로 대체. |
| `HOST_TEST_ROOT`, `HOST_TEST_REPOSITORY` | root-only CI 설치 fixture의 가짜 command 기록·복사된 installer 경로 선택. |
| `STATE`, `TRANSACTION`, `NO_COUNTER`, `NFT_FAIL` | metadata guard fixture의 상태/transaction 기록·nft 실패/계수 유무. |
| `HOST_STATUS`, `HTTP_STATUS`, `NETWORK_MODE` | 같은 fixture의 가짜 host/HTTP 응답·Docker network mode. |
| `MOCK_ROOT`, `MOCK_FAILURE` | paired candidate smoke/runtime/deploy fixture의 임시 상태·실패 선택. |
| `MOCK_ERROR`, `MOCK_DELAY`, `MOCK_STATE`, `MOCK_EXIT` | runtime/Run Command fixture의 오류·polling·상태·exit code. |
| `MOCK_VAULT_FAIL`, `MOCK_WEB_AUTH`, `MOCK_SMOKE_FAIL`, `MOCK_PULL_FAIL` | paired deploy fixture의 Vault/키 충돌/smoke/pull 실패 사례. |
| `MOCK_CONFIG_FAIL`, `MOCK_FAIL_ALL`, `MOCK_FAIL_APP`, `MOCK_FAIL_DIGEST` | paired deploy fixture의 Compose config·전체/특정 앱·digest 실패 사례. |

근거: [PG integration][pg-test], [admin smoke][admin-smoke], [HTTPS smoke][https-smoke],
[standalone smoke][standalone-smoke], [k6][k6], [root scripts][root-package], [DB fixture][db-test],
[host fixture][host-test], [root install fixture][root-test], [metadata fixture][metadata-test],
[candidate fixture][candidate-test], [paired deploy fixture][paired-test], [runtime fixture][runtime-test], [Run Command fixture][command-test].
NODE_ENV/NEXT_PUBLIC_APP_ENV/DSN/Console/R2 등 제품 변수의 vi.stubEnv·fixture 입력은 본문과 같은 이름이다.
테스트의 `SENTRY_SECRET`/`SLACK_WEBHOOK_URL`/`ENDPOINT_URL`은 일반 상수이며 Worker binding 이름이 아니다.

## 6. 환경변수로 분류하지 않은 인프라 입력

[Terraform variables][tf]의 region, tenancy_ocid, compartment_ocid, compute_compartment_ocid,
secret_compartment_ocid, compute_instance_ocid, resource_prefix, iam_identity_domain_name,
ocir_repository_name, backup_bucket_name, runtime_secret_ocids, cpu_alarm_threshold, memory_alarm_threshold,
filesystem_warning_threshold, filesystem_critical_threshold, freeform_tags, console_ocir_repository_name,
console_auth_secret_ocid, console_mfa_secret_ocid는 **Terraform input 19개**다.
추적 실행 코드에 TF_VAR_* export/조회는 없다. 값은 tfvars/Resource Manager 같은 별도 경로의 입력이며
그 경로의 실제 등록 상태는 조사하지 않았다. Terraform provider가 외부에서 받을 수 있는 모든 OCI env를
앱의 필수 환경변수로 추정하지 않는다. 보호된 operator JSON·candidate JSON·Caddy 고정 host도 같은 원칙으로 구분한다.

<!-- 아래 링크는 현재 HEAD가 아닌 조사 기준 commit에 고정한다. -->
[deploy]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/deploy-release.sh#L28
[materializer]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/materialize-runtime-env.py#L37
[paired]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/paired-release.py#L18
[legacy]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/env/legacy/release.env.example
[metric]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/publish-filesystem-metric.sh#L6
[probe]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/run-command-probe.sh#L7
[compose]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/compose.yml
[candidate-ci]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/.github/workflows/verify.yml#L400
[deploy-ci]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/.github/workflows/deploy-promotion.yml#L32
[b0]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/b0-ci-probe.py#L64
[scope]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/verification-scope.mjs#L81
[pair-smoke]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/smoke-paired-candidate.sh
[baseline]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/release-baseline.mjs#L248
[promotion]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/promotion.mjs#L170
[slack]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/slack-deploy-payload.py
[docker]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/Dockerfile
[dev-docker]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/docker/Dockerfile.dev
[web-package]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/web/package.json
[console-package]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/apps/console/package.json
[dev-compose]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/compose.dev.yml
[turbo]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/turbo.json
[operator]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/console-operator.py
[metadata-service]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/ops/oci/metadata/oioi-metadata-guard.service
[lockfile]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/pnpm-lock.yaml
[pg-runner]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/scripts/run-postgres-integration-tests.ts#L8
[pg-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/integration/m7-foundation.postgres.test.ts#L28
[admin-smoke]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/admin-migration-smoke.mjs#L29
[https-smoke]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/console-https-smoke.mjs#L14
[standalone-smoke]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/console-standalone-smoke.mjs#L69
[k6]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/k6/load.js#L35
[root-package]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/package.json
[db-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/local-database-tools.test.ts#L37
[host-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/host-assets.test.ts#L19
[root-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/host-install-root-fixture.py#L18
[metadata-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/metadata-guard.test.ts#L49
[candidate-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/paired-candidate-smoke.test.ts#L17
[paired-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/paired-deploy-fixture.py#L60
[runtime-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/runtime-env-fixture.py#L52
[command-test]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/tests/ops/paired-run-command.test.ts#L43
[tf]: https://github.com/goldmayo/oioi-bwg/blob/4822abb30c544ea86c6dab47f79267a4f18dcdd0/infra/oci/variables.tf
