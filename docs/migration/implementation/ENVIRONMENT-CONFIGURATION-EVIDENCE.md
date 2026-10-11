---
title: "환경변수·CI/CD 보안 및 OCI 실행 확인 증적"
kind: migration-evidence
status: active
source_commit: 7cb3a6d424fc7255449c30786e10a3282884c6b6
observed_at: "2026-10-11"
created_at: "2026-10-11"
updated_at: "2026-10-11"
revision: 1
---

# 환경변수·CI/CD 보안 및 OCI 실행 확인 증적

## 1. 확인 범위와 출처

[개선 계획](ENVIRONMENT-CONFIGURATION-PLAN.md)의 근거다. 코드·설정 관찰과 사용자 실행 결과를
구분한다. 비밀 유출이나 악용이 발생했다는 판정은 아니며 운영 DB에 연결하지 않았다.

| 출처 | 기준과 확인 방법 |
| --- | --- |
| migration 코드 | `goldmayo/oioi-bwg`의 `migration_main`, 위 `source_commit` 기준 파일 확인 |
| 분석 worktree | `feature/p06-compose-recreate-contract`의 `0011723d7b9a9e25dedd2da49288f00b744b0141`; 관련 workflow·Docker·변수 consumer는 기준 commit과 동일함을 diff로 확인 |
| GitHub 설정 | 2026-10-11 Environment 및 deployment branch policy API 읽기. 비밀은 이름·참조만 확인 |
| 레거시 main | `c4bc2180740854c68136430d774d4954347beb78`의 production workflow를 GitHub API로 확인 |
| 레거시 staging | `4b299934846f4a0eed7132f58c5b1c2a481a3739`의 staging workflow를 GitHub API로 확인 |
| OCI | 사용자가 Cloud Shell에서 실행하여 제공한 Audit/command-execution 출력. 에이전트가 OCI 호출을 재실행한 것이 아님 |

원래 worktree의 사용자 수정 `console-guide-editor/P06-PLAN.md`와 개인 env 파일은 보존했다.
그 uncommitted 변경을 위 코드 기준 commit의 내용으로 간주하지 않았다.

## 2. 세 변수의 실제 사용과 정리 방향

| 변수 | 확인한 동작 | 계획에 반영할 방향 |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | Web·Console logger/Sentry, Web metadata/feature flag에서 사용 | 유지. 로컬 dev는 `local`, preview OCI prod는 `production`으로 정리 |
| `NEXT_PUBLIC_ASSETS_URL` | 앱 코드 consumer를 찾지 못했고 `compose.dev.yml`에서 주입 | Compose 주입과 안내에서 제거. 개인 env는 자동 수정하지 않음 |
| `ASSETS_PUBLIC_BASE_URL` | 서버 업로드가 R2 object key와 합쳐 공개 URL을 반환 | 서버 runtime 입력으로 유지. 기존 자산 도메인·저장된 URL의 변경은 포함하지 않음 |

근거: [Compose](../../../compose.dev.yml),
[Web feature flag](../../../apps/web/src/shared/config/feature-flag.ts),
[metadata](../../../apps/web/src/shared/config/site.ts),
[Sentry](../../../apps/web/src/shared/config/sentry.ts),
[서버 업로드](../../../packages/server/src/storage/upload-public-asset.ts).

현재 로컬 logger는 `local`, metadata는 `development`, 운영 이미지 빌드는 `staging`을 사용한다.
feature flag의 운영 `DEV_*` 강제 비활성화는 `production`일 때만 적용된다. 현재 개발 기능이
실제로 활성화됐다는 증거는 없다. `NODE_ENV`의 Next 실행 모드와 앱의 실제 환경 의미는 별개다.

`ASSETS_PUBLIC_BASE_URL`의 PUBLIC은 공개 이미지 주소라는 의미다. 비밀은 아니지만 서버 consumer만
있으므로 `NEXT_PUBLIC_`로 바꿀 필요가 없다. 공개 이미지 URL은 기존 응답을 통해 브라우저에 전달된다.
`NEXT_PUBLIC_*`는 빌드 입력이므로 운영 env 파일만 수정해서 기존 이미지가 전환됐다고 볼 수 없다.
[Next.js 공식 문서](https://nextjs.org/docs/app/guides/environment-variables).

## 3. CI/CD 보안 개선 대상

### CI-ENV-01 — 게시·배포 credential의 동일 Environment 보관

현재 `oci-development-image`에는 OCIR/Sentry 게시 credential과 OCI Run Command 개인 키가 함께 있다.
API 확인 결과 branch policy는 `migration_develop`, `refs/pull/*/merge`를 허용하고 required reviewer
규칙은 없다. [candidate job](../../../.github/workflows/verify.yml)은 같은 저장소의
`migration_main → migration_develop`으로 제한하지만 Environment의 PR ref 허용 범위는 더 넓다.

같은 저장소 PR에서 workflow를 수정할 수 있는 주체를 신뢰하는 구성이다. 일반 외부 fork PR이
이 조건만으로 비밀에 접근한다고 판정한 것은 아니다. 게시·배포 Environment 분리를 개선안으로
기록한다. 현행 [runbook §21](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)은
단일 Environment를 명시하므로 분리 구현 시 같은 P06 PR에서 계약을 개정해야 한다.

### CI-ENV-02 — OCI 개인 키의 job 전체 전달과 Action 신뢰 범위

[deploy-promotion.yml](../../../.github/workflows/deploy-promotion.yml)의 job-level env에
`OCI_CLI_KEY_CONTENT` 등이 있어 OCI 인증 전 checkout·artifact·검증 step에도 전달된다.
인증·실행 step으로 주입 범위를 줄이고, 생성 인증 파일의 권한과 정리를 확인할 대상이다.
외부 Action은 현재 tag 참조이므로 credential을 취급하는 Action의 full SHA 고정도 검토한다.
step 범위 축소만으로 같은 runner의 악성 코드에 완전히 격리됐다고 보장하지 않는다.

### CI-ENV-03 — Run Command 출력 보호의 제한

[deploy-via-run-command.sh](../../../ops/oci/deploy-via-run-command.sh)는 일부 marker가 포함된
remote output을 숨긴다. `CONSOLE_MFA_ENCRYPTION_KEY`는 목록에 없으며 변수 이름 없이 출력된
원문·변환 값은 검출하지 못한다. `agent_message`도 별도 보호 없이 출력한다.
`CONSOLE_AUTH_SECRET=`은 기존 `AUTH_SECRET=` substring 검사에 걸리므로 그것까지 누락됐다고
판정하지 않는다. 오류 출력은 다른 정규식 경로를 사용하므로 양쪽 경로를 확인해야 한다.

원격 명령이 secret을 출력하면 CI 후처리 전에 OCI 실행 결과에 남을 수 있다. 원격 출력부터
금지하고 CI에 상태·exit code·정해진 안전한 진단만 전달하는 개선 대상이다. Vault에서 읽은 값은
GitHub에 등록한 Secrets의 자동 마스킹으로 보호된다고 가정할 수 없다.

### CI-ENV-04 — prod 이미지의 staging 빌드 입력

[Dockerfile](../../../Dockerfile) 기본값과 [verify.yml](../../../.github/workflows/verify.yml)의
candidate build arg는 `NEXT_PUBLIC_APP_ENV=staging`이다. 실제 대상은 prod인데 `production` 전용
feature flag 보호 분기가 성립하지 않고 Sentry도 staging으로 분류한다. `production` 입력의
새 candidate로 검증해야 하며 환경 이름만 바꾸는 것으로 해결하지 않는다.

### CI-ENV-05 — 레거시 Worker의 DB credential 빌드 주입

[main production workflow](https://github.com/goldmayo/oioi-bwg/blob/c4bc2180740854c68136430d774d4954347beb78/.github/workflows/deploy.yml),
[staging workflow](https://github.com/goldmayo/oioi-bwg/blob/4b299934846f4a0eed7132f58c5b1c2a481a3739/.github/workflows/deploy-staging.yml)는
빌드·배포 step에 `DATABASE_URL`, `DATABASE_DIRECT_URL`, Hyperdrive 연결 문자열을 전달한다.
실제 비밀 값이나 최근 실행 여부는 확인하지 않았다. 빌드 코드·플러그인의 credential 접근 범위가
넓은 경로이며 P06의 Worker 전환·데이터 확인 후 workflow와 비밀 접근을 제거할 대상이다.

### CI-ENV-06 — 로컬 Docker build context의 제외 범위

[.dockerignore](../../../.dockerignore)는 개인 `.env*`, dump, log 등을 제외하지만 `.local/` 전체를
제외하지 않는다. [Dockerfile](../../../Dockerfile)의 `COPY . .`로 로컬 설정·증적이 builder context에
들어갈 여지가 있다. 수동 로컬 빌드의 `.local/` 제외와 context 검증을 추가할 대상이다.
비밀 파일이 실제 이미지·cache에 들어갔다는 결과는 확인하지 않았다.

유지할 보호: OCI 경로는 runtime DB/Auth/R2 비밀을 host의 Vault 주입으로 획득한다.
Sentry 게시 토큰은 BuildKit secret으로 전달하고 runtime 비밀을 Docker build arg로 넣지 않는다.
CI의 smoke 전용 Auth 값과 임시 PostgreSQL URL은 테스트 입력이며 운영 비밀로 분류하지 않는다.
[GitHub 보안 지침](https://docs.github.com/en/actions/reference/security/secure-use),
[Docker build secret 지침](https://docs.docker.com/build/building/secrets/).

## 4. 사용자 제공 OCI Audit/Run Command 증적

Audit 조회 범위는 `ap-osaka-1`, 2026-10-05 **16:01:00Z~16:12:00Z**다.
2026-10-11 대화에서 사용자가 다음 결과를 제공했다.

| 작업 | 실행 principal | 제공된 결과 |
| --- | --- | --- |
| Docker 이미지 게시·manifest 조회 | `oioi-github-ci` | `uploaddockerimage` 3건 HTTP 201, manifest 조회 HTTP 200 |
| VM 조회·명령 생성·실행 결과 조회 | `github-deploy` | `GetInstance`, `CreateInstanceAgentCommand`, `GetInstanceAgentCommandExecution` HTTP 200 |
| 해당 명령 최종 실행 결과 | 아래 command/instance 조회 | `state: SUCCEEDED`, `exitCode: 0` |

Audit의 표시 이름 `oioi github-deploy`는 앞서 확인한 `github-deploy`와 principal OCID가 같다.
게시 principal은 `ocid1.user.oc1..aaaaaaaagp4krqbnha7whqquvxu3pfcxmkqm3ctnzu33qhri3i4b2u4vhjua`,
Run Command principal은 `ocid1.user.oc1..aaaaaaaa7fyaikz2wysgcui6wzujf6uv6xfmmwkw6kksxqnp6vzbncwvctta`다.

사용자가 조회한 대상과 최소 결과:

```text
command: ocid1.instanceagentcommand.oc1.ap-osaka-1.amaaaaaahcgbyoaaeybvrrloxgzv64c2r34zd222afh6q5bmnbopvuktlg2q
instance: ocid1.instance.oc1.ap-osaka-1.anvwsljrhcgbyoacqa6id2hr257tlu26cfjd7x7yywnai7hh37kkytix57cq
query: data.{state:"lifecycle-state",exitCode:content."exit-code"}
result: {"exitCode":0,"state":"SUCCEEDED"}
```

실행한 명령은 `oci instance-agent command-execution get --region ap-osaka-1`에 위 command/instance와
query를 지정한 읽기 조회다. 사용자 제공 출력으로 해당 과거 명령의 VM 실행 완료를 확인했다.
HTTP 200만으로 exit 0을 추론하지 않았다. 명령 본문·당시 배포 SHA·digest는 이 출력에 없어
현재 소스와 같은 배포 또는 특정 release의 정상성까지 판정하지 않는다.

**새 Console repository push/pull, 두 Console secret의 VM 읽기, 변경된 IAM의 새 Run Command,
컨테이너 metadata 차단은 아직 검증되지 않았다.** 기존 명령의 성공으로 P06-B0를 완료 처리하지 않는다.
