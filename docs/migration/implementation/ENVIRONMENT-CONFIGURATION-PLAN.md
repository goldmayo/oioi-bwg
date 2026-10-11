---
title: "로컬 개발과 OCI 운영 환경변수 구성 개선 계획"
kind: migration-plan
status: draft
authority: plan
source_commit: 7cb3a6d424fc7255449c30786e10a3282884c6b6
created_at: "2026-10-11"
updated_at: "2026-10-11"
revision: 2
---

# 로컬 개발과 OCI 운영 환경변수 구성 개선 계획

## 1. 환경 구분과 범위

**dev는 로컬 WSL·Docker Compose, prod는 현재 preview를 제공하는 OCI VM이다.**
같은 VM의 Web을 향후 `www.oioibawige.com`으로 전환한다. 별도 OCI dev/staging 환경을 만들지 않는다.

`oci-development-image`, `migration_develop`, `compose.oci-development.yml`은 기존 운영 경로의
식별자다. 이름에 development가 있어도 실제 대상은 prod다. `NEXT_PUBLIC_APP_ENV=staging`도
현재 빌드 입력이며 환경의 실체를 정의하지 않는다. 이름과 동작의 정리는 검증된 전환 순서로 진행한다.

이번 문서는 환경변수 개선 **계획**이다. 개인 env 파일, Vault, 운영 DB, GitHub 설정을 변경하지 않는다.
구현은 아래 독립 PR 단위로 나누고, 운영 변경은 기존 P06의 배포·IAM·검증 경계에서 수행한다.

상위 규칙과 문서 소유권:

- [환경변수·CI/CD 확인 증적](ENVIRONMENT-CONFIGURATION-EVIDENCE.md): 변수 consumer, 보안 개선 대상, 사용자 제공 OCI 실행 결과
- [Architecture Constitution](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md)
- [Runtime §11–14](../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md): 앱 설정·빌드 입력·Vault 주입의 기준
- [Deployment Runbook](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md): Promotion 및 운영 실행 절차
- [P06 계획](console-guide-editor/P06-PLAN.md): 두 앱 운영 전환 및 레거시 제거의 소유 문서
- [로컬 개발 가이드](LOCAL-DEVELOPMENT-ENVIRONMENT.md): 구현 후 실제 실행법을 갱신할 소유 문서

## 2. 확인한 문제

관찰 기준은 위 `source_commit`의 추적 파일이다. 개인 `.env*` 파일은 변경 가능한 로컬 설정이며
저장소 계약의 근거로 삼거나 내용을 PR에 복사하지 않는다. 운영 VM의 실제 파일·DB 상태는 미검증이다.

| 위치 | 확인한 현재 동작 | 개선 필요 |
| --- | --- | --- |
| `apps/web/.env.example` | `DATABASE_URL`이 없음 | 호스트에서 Web 실행 시 필요한 DB 입력과 시작 절차 누락 |
| `compose.dev.yml` | DB명·사용자·비밀번호와 Web 연결 문자열을 고정 | 앱 파일·도구의 연결 정보와 별도 관리됨 |
| `scripts/dev-console-local.mts` | Console 앱 URL과 별개로 migration URL을 고정 | 로컬 비밀번호 변경 시 migration 연결이 어긋남 |
| `scripts/run-postgres-integration-tests.ts` | `--local` 관리자 연결 URL을 고정 | 같은 Compose DB의 credential을 따로 가정함 |
| `scripts/assert-local-database.ts` | Web env 파일을 읽고 hostname만 제한 | 앱 선택·DB명·포트·실행 목적이 불명확함 |
| `scripts/restore-local-dump.sh` | Compose의 사용자·DB명을 고정 | 연결 설정 전환 시 복원 경로도 함께 정리해야 함 |
| `NEXT_PUBLIC_APP_ENV` consumer | `local`, `development`, `staging`, `production`을 서로 다르게 해석 | 로컬 로그·metadata·feature flag·Sentry의 기준 불일치 |
| `NEXT_PUBLIC_ASSETS_URL` | 앱 코드 consumer는 찾지 못했고 로컬 Compose에서 주입 | 사용 중인 `ASSETS_PUBLIC_BASE_URL`과 역할 구분 필요 |

`packages/server/src/db/index.ts`는 서버 프로세스의 `DATABASE_URL`을 읽는다. Vault를 직접 호출하지
않으며 URL이 없으면 DB 획득 시 실패한다. `.env.example`은 템플릿이고 자동 로딩 대상이 아니다.

운영에서는 `ops/oci/deploy-release.sh`가 보호된 host 설정의 DB host/port/name/user와 Vault의
앱 비밀번호를 조합해 `DATABASE_URL`을 만들고 `/srv/oioibawige/app.env`에 원자적으로 저장한다.
현재 앱 DB 사용자는 `oioi_app`이다. 반면 로컬 Compose의 고정 비밀번호는 Vault 주입이 아니다.
연결 문자열 조립 자체보다 **입력 소유권·credential 중복·주입 대상·유출 경로**를 정리해야 한다.

## 3. 목표 구성

### 3.1 로컬 dev

| 입력 | 소유 위치 | 소비자 |
| --- | --- | --- |
| 로컬 PostgreSQL 연결 요소 | ignored `.local/postgres.env` | Compose PostgreSQL·로컬 시작 스크립트·DB 도구 |
| Web 전용 설정·로컬 키 | `apps/web/.env.local` | Web |
| Console 전용 설정·로컬 키 | `apps/console/.env.local` | Console |
| 변수 설명과 안전한 예시 | 추적되는 각 `.env.example` 및 로컬 DB 템플릿 | 개발자 |
| 격리 테스트 credential | 기존 통합 runner의 명시적 테스트 입력 | 임시 DB 테스트 |

로컬 DB 파일은 로컬 연결 요소를 한 번만 저장한다. 전체 URL을 Compose와 여러 스크립트에 복사하지
않는다. 실제 소비자가 있는 작은 함수로 URL을 조립하고 비밀번호의 특수문자를 올바르게 인코딩한다.
WSL 직접 실행은 `127.0.0.1`, Compose 안의 앱은 서비스명 `postgres`를 사용한다.

설정 파일은 WSL Linux 파일시스템에 두고 디렉터리 `0700`, 비밀 파일 `0600`을 사용한다.
원본 DB 파일 전체를 앱 컨테이너에 주입하지 않고 앱 실행에 필요한 URL만 전달한다.
앱용과 owner/migrator용 연결 목적을 구분하고, 기존 역할을 축소하거나 변경하는 작업은 별도 검증한다.
운영 owner/migrator credential은 이 로컬 파일에 가져오지 않는다.

Compose의 `--env-file`은 YAML 보간 입력이고 서비스의 `env_file`은 컨테이너 환경 입력이다.
시작 스크립트가 이를 명시적으로 지정한다. 쉘의 기존 값으로 다른 DB가 선택되거나, 개인 앱 파일의
`DATABASE_URL`을 조용히 덮어쓰지 않는다. 충돌은 변수 이름만 표시하고 중단한다.
[Docker 보간](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/),
[컨테이너 환경 주입](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).

개발자가 직접 유지하는 앱 파일은 `.env.local`로 안내한다. 기존 `.env`는 자동 삭제·이동하지 않는다.
이전 전에 중복 키를 확인하고 기존 값을 보존한다. Next.js의 `process.env` 우선순위와
`.env.development.local` 등 추가 파일의 영향도 점검한다.
[Next.js 환경변수 로딩](https://nextjs.org/docs/app/guides/environment-variables).

로컬 실행에 사용하는 앱 환경 값은 기존 consumer와 맞춰 `NEXT_PUBLIC_APP_ENV=local`로 정리한다.
`NODE_ENV`는 Next.js의 `development`/`production` 의미를 유지한다. 로컬 standalone 검증에서
`NODE_ENV=production`인 경우에도 운영 메일 보호 규칙을 해제하지 않는다.

### 3.2 OCI prod

| 입력 | 소유 위치 | 소비자 |
| --- | --- | --- |
| DB host/port/name/app user 등 host 설정 | 보호된 VM 배포 설정 | host 배포 스크립트 |
| runtime 비밀 값 | OCI Vault | VM Instance Principal을 사용하는 host 주입 과정 |
| Secret OCID 매핑 | 보호된 VM 설정 | host 주입 과정 |
| 공개 앱 설정 | 검토된 host 공개 설정 및 CI 빌드 입력 | 필요한 앱·빌드 |
| 앱별 runtime env | host가 생성하는 Web/Console별 보호된 파일 | 해당 앱만 |
| OCIR·Run Command·소스맵 게시 credential | GitHub Environment Secrets | 필요한 CI job만 |

Vault가 runtime 비밀의 SSOT다. Web/Console 앱 파일은 host가 만드는 실행용 산출물이며 Git에
저장하지 않는다. Console MFA 키와 서명 키를 Web 파일에 넣지 않는다. DB owner/migrator 비밀번호,
OCI API 개인 키도 앱 파일에 넣지 않는다. atomic write와 기존 release env 복구 계약을 유지한다.

앱별 env 분리만으로 VM 권한이 분리되는 것은 아니다. 컨테이너의 Instance Metadata 차단과
Console secret 접근 검증은 P06-B0/B2의 완료 조건을 유지한다. 현재 차단됐다고 주장하지 않는다.

`NEXT_PUBLIC_*`는 공개 빌드 입력으로 취급하고 비밀 값을 넣지 않는다. 필요한 경우만 공개 DSN·GTM
등을 제공한다. 실제 prod 빌드값 `production` 전환은 P06에서 두 앱의 새 digest와 함께 검증한다.
GitHub Environment 이름만 바꾸어 기존 이미지의 빌드값이 바뀌었다고 처리하지 않는다.

## 4. 구현 순서와 PR 경계

### ENV-1 — 앱 템플릿과 환경 의미 정리

- `NEXT_PUBLIC_ASSETS_URL`은 현재 consumer가 없으므로 Compose 주입과 안내에서 제거한다.
  `ASSETS_PUBLIC_BASE_URL`은 서버 업로드가 공개 이미지 URL을 만드는 runtime 입력으로 유지한다.
  기존 저장된 이미지 URL과 R2 버킷을 이 정리 작업에서 변경하지 않는다.
- Web·Console 변수마다 consumer, 필수/선택, 로컬/운영, 서버/브라우저, 빌드/runtime을 표시한다.
- Web의 DB 입력 누락을 설명하고, R2 업로드·OCI 메일·Sentry는 해당 기능에 필요한 선택 설정으로 나눈다.
- Web/Console 키 분리와 MFA 키 보존을 명시한다. 키를 매 실행마다 생성하지 않는다.
- `NEXT_PUBLIC_APP_ENV`의 로컬 consumer를 `local`로 맞추고 metadata 등 영향을 확인한다.
- 미사용 변수는 동적 접근·빌드·CLI까지 확인한 뒤 템플릿/주입 정리 대상으로 확정한다.
- 개인 `.env`/`.env.local`을 덮어쓰지 않고, 차이와 이전 방법은 값 없이 안내한다.

완료 조건: 템플릿의 각 변수에 실제 소비 근거가 있고, 로컬 Web·Console의 환경 해석이 일치한다.
운영 `staging` 입력의 전환은 ENV-3/P06에서 처리한다.

### ENV-2 — 로컬 DB 입력과 시작 경로 통합

- 로컬 DB 템플릿과 ignored 실제 파일을 도입하고 Compose의 credential/URL 고정값을 제거한다.
- Web·Console 시작 경로와 migration·통합 runner·dump 복원이 동일 입력을 사용하게 한다.
- DB 도구는 실행 목적에 맞는 연결을 명시하고 기존 local guard를 강화한다.
- 로컬 대상의 protocol/host/port/DB명 및 불필요한 query 옵션을 확인한다. hostname만으로
  SSH 포워딩을 통한 운영 접근까지 차단했다고 주장하지 않는다.
- 기존 `pnpm dev` 등 직접 실행의 DB 입력 계약을 문서화한다. 권장 시작 명령은 설정 확인,
  PostgreSQL health 확인, 필요한 migration, 앱 실행을 기존 절차에 맞춰 연결한다.
- 기존 파일·볼륨이 있으면 보존한다. PostgreSQL 초기화용 비밀번호 변경은 이미 생성된 역할의
  비밀번호를 바꾸지 않으므로 자동 재설정이나 `down -v`로 해결하지 않는다.
- CI의 격리 테스트 입력은 개인 로컬 파일에 의존하지 않게 유지한다. 운영 seed를 추가하지 않는다.

완료 조건: 기존 DB 볼륨과 MFA 정보를 유지하면서 호스트 Web·Console 및 Compose Web의 DB 조회가
성공한다. 특수문자 비밀번호·입력 충돌·비로컬 URL 거절·격리 테스트 DB 삭제를 확인한다.

### ENV-3 — P06 운영 주입 및 빌드 입력에 반영

새 운영 전환 계획을 만들지 않고 P06-B1/B2/F의 해당 PR에 연결한다.

- [증적 §3](ENVIRONMENT-CONFIGURATION-EVIDENCE.md#3-cicd-보안-개선-대상)의 CI-ENV-01~06을 해당 P06 변경의 검토 항목으로 연결한다.
- 이미지 게시와 운영 배포의 GitHub Environment 분리를 검토한다. 현재 runbook §21의 단일
  Environment 계약을 변경하려면 해당 P06 PR에서 runbook·workflow·보호 설정을 함께 개정한다.
  이름 변경만으로 비밀 접근 범위가 분리됐다고 처리하지 않는다.
- OCI 개인 키는 인증·실행에 필요한 step에만 전달하고 인증 파일의 권한·정리를 검증한다.
- 원격 명령부터 secret 출력이 발생하지 않게 하고, CI에는 안전한 상태·종료 코드·진단만 전달한다.
  Console MFA 키, 원문/변환 값, agent message와 양쪽 출력 스트림의 실패 경로를 검토한다.
- `.local/`을 Docker build context에서 제외하고 credential을 취급하는 Action의 SHA 고정을 검토한다.
- 앱별 env 허용 목록, 필수 값, 생성 파일 권한과 rollback 복구를 실제 host 계약에 반영한다.
- GitHub의 이미지 게시 계정과 Run Command 계정을 구분하고 runtime 비밀의 CI 유입을 금지한다.
- 두 앱 빌드의 prod 환경 값과 Sentry 동작을 확인한다. 빌드 입력 변경은 새 candidate로 검증한다.
- `oci-development-image` 이름 변경은 Secrets 재등록·보호 설정·workflow 참조 전환이 동반되므로
  P06에서 결정한다. 레거시 Worker의 `production` Environment를 확인 없이 재사용하지 않는다.
- IAM은 새 repository pull·secret 읽기·Run Command 실제 실행을 증명한 뒤 전체 ARM64 빌드로 진행한다.
  사용자 제공 기존 Run Command의 `SUCCEEDED`/exit 0은 과거 실행 증거이며 새 Console 권한의
  검증을 대체하지 않는다. [증적 §4](ENVIRONMENT-CONFIGURATION-EVIDENCE.md#4-사용자-제공-oci-auditrun-command-증적)를 따른다.
- staging/production Worker 경로 및 관련 설정의 삭제 시점은 P06 전환·데이터 확인 이후로 유지한다.

완료 조건은 P06의 실제 운영 검증을 따른다. 문서 검토나 로컬 모의 입력으로 운영 IAM·주입을
검증 완료했다고 기록하지 않는다. 운영 연결·변경은 구체적 대상과 작업에 대한 승인 범위에서만 수행한다.

## 5. 검증과 보류

구현 PR에서는 AGENTS 기본 검증을 실행하고 runtime/build 영향이 있으면 build를 추가한다.
ENV-1은 실제 환경 로더와 consumer 동작, ENV-2는 Docker Compose PostgreSQL 및 기존 격리 runner로
검증한다. 비밀 유출 검사는 성공/실패 양쪽의 stdout·stderr와 Git diff·생성 파일 권한을 포함한다.
검증 출력에 `docker compose config`, DB URL, env 전체, Vault 원문을 남기지 않는다.

이 계획 PR에서는 문서 포맷·상대 링크·diff만 직접 확인한다. Git hook 자동 검증은 별도 보고한다.
앱 기동·PostgreSQL 연결·Vault 읽기·OCI 변경은 계획 작성으로 검증한 것이 아니다.

보류 사항:

- 실제 개인 env의 이전은 기존 값을 보존하는 ENV-1/2 절차에서 진행한다.
- 로컬 app role 최소 권한의 실제 상태와 필요한 변경은 ENV-2에서 확인해 독립 변경으로 분리한다.
- GitHub Environment·배포 파일·브랜치 이름 정리와 Worker 삭제는 P06 소유다.
- MFA 암호화 키 교체, 새로운 비밀 관리 제품, 환경설정 framework/DI container는 도입하지 않는다.
