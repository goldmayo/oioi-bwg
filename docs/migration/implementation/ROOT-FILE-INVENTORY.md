---
title: "저장소 루트 파일의 소비자와 배치 근거"
kind: migration-evidence
status: completed
source_commit: 1a5be78eddd12e0c83bfe17d7839dbfa017526dc
created_at: "2026-10-23"
---

# 루트 파일 점검

사용자가 요청한 루트 파일 점검과 `config/tsconfig.json` 이관의 근거다. 기준은 위 커밋이며,
`tsconfig.config.json` 행과 이관 설명은 이번 후속 변경을 반영한다. 이전 정상화의 완료 판정이나
운영 배포 상태를 다시 정의하지 않는다. 실행 계획·검증은 [PLAN](MONOREPO-CONFIGURATION-PLAN.md)의
루트 파일 후속 절과 [RESULT](MONOREPO-CONFIGURATION-RESULT.md)의 같은 절이 소유한다.

`git ls-files`·실제 디스크 목록과 package script, hook, CI, Docker/Compose, host installer,
타입 검사·harness를 대조했다. 시작 시 루트 추적 파일은 **29개**, 이관 후 **30개**다.
비추적 생성 파일 두 개는 별도로 기재한다. 디렉터리 내부 파일은 이번 목록에 포함하지 않는다.
“루트 유지”는 언제나 기술적 강제를 뜻하지 않는다. 자동 탐색, 명시적 경로 계약, 사람이 찾는
관례를 아래에서 구분한다. 아래 소스 경로는 저장소 루트 기준이다.

## workspace와 저장소 전체 정책

| 파일                  | 실제 역할·소비자                                                                       | 루트 배치 근거와 이동 가능성                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`        | pnpm root 명령·개발 도구 의존성, lint-staged와 Husky prepare를 정의한다.               | 저장소 실행 진입점이다. 하위 앱 manifest와 역할이 다르며 현재 root install·CI·Docker가 이 경로를 사용한다.                                                                                                 |
| `pnpm-workspace.yaml` | `apps/*`·`packages/*`와 의존성 install script 제외 정책을 정의한다.                    | pnpm이 workspace 경계를 인식하는 루트 표식이다. 단순히 config 폴더로 옮길 파일이 아니다.                                                                                                                   |
| `pnpm-lock.yaml`      | root와 각 workspace의 해석된 의존성을 고정한다. CI/Docker가 frozen install에 사용한다. | 현재 shared workspace lockfile이다. manifest들과 함께 install 입력으로 소비하며 임의 이동하면 install 계약을 바꾼다.                                                                                       |
| `turbo.json`          | root task graph·cache 입력·출력과 env 전달을 정의한다.                                 | root `turbo run`의 설정 진입점이다. 앱 설정을 복제하지 않고 저장소 전체 작업 관계를 정의하므로 유지한다.                                                                                                   |
| `.gitignore`          | env·산출물·개인 상태의 Git 추적 제외 범위를 정의한다.                                  | Git이 해당 디렉터리 아래에 자동 적용한다. 하위로 옮기면 적용 범위가 줄어든다.                                                                                                                              |
| `.prettierrc`         | 공통 포맷과 Tailwind 정렬 plugin을 정의한다.                                           | Prettier가 검사 파일에서 상위로 탐색한다. 루트에서 전 workspace에 동일한 기본값을 적용한다.                                                                                                                |
| `.prettierignore`     | 생성물·이력 문서·lockfile 등 포맷 제외 대상을 정의한다.                                | 현재 root `prettier --check .`·lint-staged 실행의 기본 ignore 파일이다. 이동 시 명시적 ignore 경로와 적용 범위 검토가 필요하다.                                                                            |
| `.commitlintrc.json`  | Conventional Commit 규칙을 설정한다.                                                   | `.husky/commit-msg`가 실행하는 commitlint의 자동 탐색 파일이다. 한글 요약 등 추가 규칙의 기준은 AGENTS.md다.                                                                                               |
| `.gitmessage`         | 사람이 작성할 커밋의 제목·본문 예시다.                                                 | Git 자동 탐색 파일은 아니다. 현재 checkout의 `.git/config`에 `commit.template=.gitmessage`가 설정되어 있다. 다른 clone에도 자동 적용된다고 가정하면 안 된다. 옮길 수 있지만 각 clone의 설정도 바꿔야 한다. |

## 타입·정적 분석·테스트 진입점

공통 규칙 본체는 `packages/config`가 소유한다. 아래 파일은 소비자의 실행 경계다.
루트 파일을 모두 공통 preset으로 합치면 include·cwd·alias·수집 범위를 구분하기 어려워진다.

| 파일                        | 실제 역할·소비자                                                                                              | 루트 배치 근거와 이동 가능성                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`             | `type-check:repo`의 첫 tsc 실행이 운영용 `.mts`를 NodeNext로 검사한다. 앱은 제외한다.                         | 기본 tsc/도구 진입점이자 root Node 프로그램이다. 모든 앱을 묶는 범용 tsconfig가 아니며 이번 이관으로 덮어쓰지 않는다.                                                                                                 |
| `tsconfig.config.json`      | `type-check:config`가 root·앱·package의 설정 entry 23개를 ESNext/Bundler, strict/noEmit으로 검사한다.         | 기존 `config/tsconfig.json`을 사용자의 요청으로 옮겼다. `-p`로 명시해서 읽으므로 기술적으로 루트만 가능한 파일은 아니다. 검사 대상인 root 설정들 가까이에 두되 NodeNext 프로그램과 분리한다.                          |
| `eslint.config.ts`          | root `lint:repo`와 lint-staged가 Node/app/Worker/server/contracts 공통 factory를 조합한다.                    | ESLint flat config의 root 자동 탐색 entry다. 앱별 cwd 진입점은 별도로 유지하며 규칙 구현은 공통 package에 있다.                                                                                                       |
| `steiger.config.ts`         | 공통 FSD factory를 `./apps/*/src` 범위로 조합한 root entry다. 타입 검사·Turbo 입력에 포함된다.                | 저장소에서 직접 Steiger를 실행할 때의 entry다. 일반 `lint:fsd`는 각 앱의 `--config steiger.config.ts`를 사용하므로 root 파일이 그 명령에 반드시 필요한 것은 아니다. 별도 정리 시 직접 실행 흐름을 먼저 판단해야 한다. |
| `drizzle.config.ts`         | guard를 거친 root Drizzle generate/pull/studio가 자동 탐색한다. 공통 schema와 migration 출력 경로를 정의한다. | CLI cwd가 루트이고 schema/out도 루트 기준이므로 유지한다. migrate는 별도 guarded runner이며 DB 연결·운영 변경은 파일 점검과 별개다.                                                                                   |
| `vitest.config.ts`          | root `test:unit`·`test:coverage`의 자동 탐색 entry다. workspace projects와 전체 source coverage를 모은다.     | 저장소 전체 테스트·coverage 조합 경계다. Turbo unit 실행은 각 workspace config도 사용하므로 root 설정 하나로 전 실행을 대체하지 않는다.                                                                               |
| `vitest.ops.config.ts`      | `test:ops`가 `--config`로 선택하고 Node에서 `tests/ops`를 실행한다.                                           | 저장소 배포·이미지·운영 도구 검증을 앱 unit과 격리한다. 루트는 현재 경로 계약이며 명시적 호출이므로 이동 자체는 가능하다.                                                                                             |
| `vitest.postgres.config.ts` | guarded PG runner가 `--config`로 선택한다. root/서버 DB 테스트와 Web adapter 프로젝트를 직렬 조합한다.        | cross-workspace 통합 검증의 실행 root다. 경로 이동은 runner와 include/extends/root를 함께 바꿔야 하며 일반 unit과 합칠 이유는 없다.                                                                                   |

## Docker와 운영 입력 예제

| 파일                              | 실제 역할·소비자                                                                                                 | 루트 배치 근거와 이동 가능성                                                                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                      | CI가 두 Next 앱의 standalone image를 생성하는 build/runner target을 사용한다.                                    | Docker 기본 파일명이자 현재 root build context의 entry다. workspace manifest·공통 소스를 함께 COPY한다. 파일만 옮기는 것은 가능하지만 CI의 경로를 바꿔야 하며 build context는 공통 소스를 포함하도록 유지해야 한다. |
| `Dockerfile.dev`                  | `compose.dev.yml`이 파일명을 명시한다. source bind mount와 workspace별 dependency volume의 개발 환경을 준비한다. | 개발과 운영 image의 목적을 분리한다. 루트 강제는 아니지만 Compose의 `dockerfile`과 COPY 입력 계약을 함께 관리하기 좋다.                                                                                             |
| `.dockerignore`                   | root context에서 개인 env·node_modules·Git·캐시·문서 등을 Docker 전송 대상에서 제외한다.                         | Docker가 build context 루트에서 찾는다. Dockerfile 위치만 바꿔도 context가 같으면 이 파일의 기준은 루트다.                                                                                                          |
| `compose.dev.yml`                 | root 개발 명령·DB 복원·로컬 Console launcher가 `-f`로 선택한다.                                                  | PostgreSQL과 Web 개발 서비스를 저장소 차원에서 조합한다. 자동 기본 파일명은 아니며 이동하면 호출 경로와 상대 build/env/volume 경로를 조정해야 한다.                                                                 |
| `compose.oci-development.yml`     | host installer가 runtime 폴더에 복사하고 배포 helper가 명시적으로 선택한다.                                      | 두 앱 운영 image 실행 자산이다. 소스의 루트 위치는 installer·문서·검증의 계약이며 기술적 자동 탐색 요구는 아니다. 점검·보존은 실제 배포를 뜻하지 않는다.                                                            |
| `app.env.oci-development.example` | host installer가 공개 runtime 입력 파일이 없을 때 초기 예제로 복사한다.                                          | 앱의 `.env.local`이 아니다. root 경로는 installer의 명시적 참조이며 이동 시 설치·rollback 흐름을 검토해야 한다.                                                                                                     |
| `.env.oci-secrets.example`        | host installer가 보호된 runtime secret 파일이 없을 때 초기 예제로 복사한다.                                      | 값이 아닌 입력 형식의 예제다. 공개 입력과 분리하며 현재 installer가 참조하는 root 경로를 유지한다.                                                                                                                  |
| `.env.oci-development.example`    | 이전 단일 앱 `release.env` 형식의 호환 예제다. 현재 paired installer의 두 초기 예제와 구분한다.                  | 현재 앱·일반 CI의 필수 자동 탐색 파일이 아니다. legacy/rollback 문맥을 보존하기 위해 남아 있으며 삭제·이동은 호환 범위를 별도로 판단할 수 있다.                                                                     |

## 안내·이력·수동 도구

| 파일               | 실제 역할·소비자                                                                                                       | 루트 배치 근거와 이동 가능성                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`        | 저장소 소개, 개발 진입점, workspace·보류 범위 안내다.                                                                  | GitHub와 개발자가 처음 찾는 저장소 안내다. 긴 실행 이력·아키텍처 본문을 모두 넣는 용도는 아니다.                                                                                            |
| `AGENTS.md`        | 저장소 전체 자동화 에이전트의 실행 규칙과 active architecture 링크다.                                                  | root에 두어 저장소 전 범위의 규칙임을 나타낸다. 하위에만 두면 전체 적용 범위가 달라진다.                                                                                                    |
| `CHANGELOG.md`     | 기존 tag/release별 변경 이력을 보존한다.                                                                               | 사람이 찾기 쉬운 root 관례다. release-it 제거 후 현재 build·install이 이 파일을 자동 생성하거나 소비하지는 않는다. 이동할 기술적 장애는 작지만 이력 링크·사용 흐름 검토가 필요하다.         |
| `skills-lock.json` | 기록된 세 외부 skill의 source·hash로 설치 출처를 추적한다. 수동 작성된 모든 repository skill을 나열하는 파일은 아니다. | pnpm lockfile이나 앱 runtime 입력이 아니다. skill 설치 도구의 프로젝트 메타데이터로 보존한다. 현재 package/CI의 직접 참조는 없으며 임의 이동 시 해당 도구의 경로 계약을 먼저 확인해야 한다. |
| `create_issues.sh` | `gh issue create` 세 번을 수행하는 이전 수동 발행 도구다.                                                              | root에 있어야 할 기술적 이유나 package/CI 자동 consumer는 확인되지 않았다. `scripts/` 이동 또는 이력 보관 후보지만 이번 요청은 점검과 TS 설정 이동이므로 보존한다. 실행하지 않았다.         |

## 비추적 생성 파일과 이번 이관

디스크에 보이는 root `next-env.d.ts`와 `tsconfig.tsbuildinfo`는 Git 비추적·ignore 대상이다.
이전 root Next/type-check 실행의 잔여 산출물로 볼 수 있으나 생성 시점·작성 프로세스는 확인하지 않았다.
현재 Next 앱의 선언·빌드 캐시는 각 앱이 소유한다. 이번에 삭제하거나 이동하지 않았다.

`config/`에는 추적 파일이 `tsconfig.json` 하나뿐이었다. 새 `tsconfig.config.json`의 include에서
이전 디렉터리 기준 `../`만 제거했으며 preset·옵션은 유지했다. `package.json` 호출, Turbo의
`globalDependencies`, 두 architecture harness 소비자를 함께 수정했다. 기존 root `tsconfig.json`과
`packages/config` preset은 별개이며 그대로다. 과거 RESULT의 이전 경로는 당시 증거로 보존한다.

루트에 `next.config.ts`, `sentry*.config.ts`, `components.json`이 없는 것은 누락이 아니다.
각 Next/shadcn consumer의 자동 탐색 entry는 `apps/web`·`apps/console`에 있다. 이들을 루트로
되돌리지 않는다. 현재 APP_ENV 계약과 기존 외부 리소스 이름도 이관의 변경 대상이 아니다.

## 사용자 승인 후 배치 정리 — 저장소 도구

위 표는 최초 점검 시점의 배치 근거다. 사용자가 Before/After 정리안을 승인한 뒤 다음 경로로 이관했다.
이 절이 아래 대상의 현재 경로를 소유하며 당시 소비자·판정은 위 표에 보존한다.

| 이전 경로                   | 현재 경로                            | 보존한 계약                                            |
| --------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `config/tsconfig.json`      | `tsconfig.config.json`               | 검사 entry 23개·compilerOptions·NodeNext 프로그램 분리 |
| `vitest.ops.config.ts`      | `tests/ops/vitest.config.ts`         | repo root에서 같은 ops 파일 수집·Node 환경·timeout     |
| `vitest.postgres.config.ts` | `tests/integration/vitest.config.ts` | 같은 직렬 PG 프로젝트·Web adapter alias 격리·repo root |
| `create_issues.sh`          | `scripts/manual/create_issues.sh`    | byte 불변·명시적 수동 실행만 허용                      |

두 Vitest config는 `type-check:config`가 소유하며 Node 테스트 타입 프로그램에서 제외한다.
실제 테스트의 타입 소유권은 그대로다. root 단위/coverage 조합 설정은 유지한다.
k6는 성능 테스트로 `tests/k6/{common,load,stress,spike}.js`에 유지한다. root 세 명령이 이 경로를
가리킴을 확인했으며 script·입력/외부 hostname·CI 실행 범위를 바꾸지 않았다.
이번 단위 후 root 추적 파일은 27개다. 운영 자산과 앱 Dockerfile은 후속 단위다.
