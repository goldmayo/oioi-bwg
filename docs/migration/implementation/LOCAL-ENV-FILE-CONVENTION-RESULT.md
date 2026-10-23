---
title: "앱 환경 파일 템플릿과 개인 설정 정리 결과"
kind: migration-result
status: completed
source_commit: 90e00f19d18fde3cb173c0c4bbaa8c07f807f7f9
created_at: "2026-10-24"
revision: 2
---

# 앱 환경 파일 템플릿과 개인 설정 정리 결과

최초 정리는 [#222](https://github.com/goldmayo/oioi-bwg/pull/222)의 결과다. 이후 사용자의 단일 파일
관리 요청에 따른 변경은 아래 후속 단위에 기록한다. 현재 규칙은 로컬 개발환경 안내를 따른다.

## 범위와 완료 조건

사용자 요청에 따라 Web·Console의 env 템플릿과 개인 파일의 그룹 순서·한글 주석을 맞춘다.
`.env.example`의 모든 값은 빈칸이며 실제 값은 개인 `.env` 또는 `.env.local`에서 관리한다.
개인 파일별 변수와 실제 적용 값은 보존하고 동일 값의 중복 선언만 정리하는 것이 완료 조건이다.
관리 규칙은 [로컬 개발환경](LOCAL-DEVELOPMENT-ENVIRONMENT.md#환경-파일의-역할과-작성-순서)이 소유한다.

최신 local/origin `migration_main`의 위 기준에서 시작했다. #199는 기존 head의 Draft로 유지했다.
환경변수 전체 조사와 운영 입력 부록은 조사 시점의 스냅샷으로 보존한다. 후속 관측 정책 공통화와
의존 관계가 없으며 이번 PR에 runtime 코드·CI 구조·운영 설정 변경을 포함하지 않는다.

## 변경 결과

- 두 템플릿은 실행 환경 → DB → 앱별 인증·업로드 → 관측·분석 순서로 해당 그룹만 둔다.
  Web에서 실제 읽는 선택 입력 GTM ID도 빈 항목으로 표시한다. 기본값·입력 조건은 주석과 개발 안내에 둔다.
- 개인 Web `.env`의 13개 키와 `.env.local`의 DB는 각각 원래 파일에 유지했다.
  인증·메일·R2·에셋·Sentry 등의 값은 삭제하거나 다른 파일로 옮기지 않았다.
- Console `.env.local`의 12개 고유 키와 적용 값은 그대로다. 값이 동일함을 확인한
  `R2_ENDPOINT`·`R2_BUCKET`·`ASSETS_PUBLIC_BASE_URL`의 중복 선언 세 개만 제거했다.
- 정리 전 개인 파일은 ignored `.local/env-layout/` 아래에 원본으로 보관했다.
  개인 파일은 `0600`, 백업 디렉터리는 `0700`이며 값·백업·검증 스크립트는 추적하지 않는다.
- README와 로컬 개발 안내는 빈 템플릿 복사 후 직접 입력할 값, Next 우선순위,
  현재 Compose·Console 실행기의 `.env.local` 직접 입력 제약을 설명한다.

## 실제 검증

| 명령/범위 | 결과 |
| --- | --- |
| `node .local/env-layout/format-existing.mjs` | 개인 파일별 key set·dotenv 적용 값 보존, 템플릿 전 항목 빈 값, Console 동일 중복 정리, Git ignore 확인 |
| `node .local/env-layout/verify.mjs` | 설치 Next 16.4.1 환경 로더의 앱별 development·production·test 6경로 통과. 정리 전 백업의 적용 값과 비교 |
| Console `validateLocalConsoleEnvironment` 직접 호출 | 통과. launcher main·DB migration·앱 서버를 실행하지 않음 |
| `git diff --check` | 통과 |

Web은 development·production에서 `.env.local`과 `.env`를, test에서는 `.env`를 읽었다.
Console은 development·production에서 `.env.local`을 읽고 test에서는 개인 파일을 제외했다.
`.env.example`은 어느 경로에서도 자동 로드되지 않았다. 시크릿 값은 출력하지 않았다.
필수 push hook의 실제 명령·결과와 최종 head의 CI·리뷰·squash 결과는 같은 PR 본문에 기록한다.

개인 파일 로딩 검증은 앱 실행·DB 연결·R2 업로드·Sentry/GTM 전송 검증이 아니다.
#199·F/www·운영/Worker 배포·실제 외부 전송·메일/계정 재활성화·UI-03은 계속 보류한다.

## 후속 단위 — Web 입력 범위 명시와 .env.local 통일

기준은 #222 squash `cd2b7ca2db123cd02734dbddceaea421468f96db`이며 최신 local/origin과 깨끗한
작업 트리를 확인했다. 사용자가 Next 로드 순서를 확인하고 `.env`/`.env.local` 중 하나로 관리하도록
요청한 후속 단위다. 앞 단위의 파일 분할 보존 결과를 삭제하지 않고 변경 근거를 여기에 남긴다.

- 일반 Web 입력은 필수 APP_ENV·DB와 선택 Sentry DSN·GTM의 4개다. TypeScript resolver로 Web
  진입점의 저장소 내 의존성 143파일을 추적했고 공용 server의 메일·R2·가입 서비스 import가 없음을 확인했다.
- 두 템플릿에 Sentry 게시 입력 5개와 `OIOI_EPHEMERAL_BUILD`를 선택 빌드 그룹으로 추가했다.
  Web은 일반 4개+빌드 6개, Console은 일반 12개+빌드 6개이며 모든 값은 빈칸이다.
  Next 제공 `NEXT_RUNTIME`과 실행 모드 `NODE_ENV`는 사용자 배포 입력과 구분한다.
- 공식 문서와 설치 Next 16.4.1의 `@next/env` 구현을 대조했다. 키마다 process와 파일 우선순위가
  적용되며 `.env.local`에 없는 키는 `.env`에서 채울 수 있다. test는 `.env.local`을 제외한다.
- 앱별 개인 입력을 `.env.local` 하나로 통일했다. 기존 Console launcher·Compose 경로와 일치한다.
  active Runtime v1.12·인덱스·로컬 안내·README를 함께 갱신했다. 프레임워크 로더를 수정하지 않았다.
- Web의 기존 고유 키 14개 값 전부를 `.env.local`에 보존했다. 기존에 없던 APP_ENV=local과 빈 GTM
  항목을 추가해 16개 키가 됐다. 그중 현재 Web 미사용 12개는 보존 설정으로 주석을 구분했다.
  통합 전 `.env` 원본은 ignored `.local/env-layout/`에 백업했고 자동 로드 위치에서는 정리했다.
  Console의 고유 키 12개 값은 유지했다. 빌드 전용 빈 입력을 기존 개인 파일에 억지로 추가하지 않았다.

| 명령/범위 | 실제 결과 |
| --- | --- |
| `node .local/env-layout/audit-web.mjs` | 저장소 내 143파일·공용 server 11파일 도달 경로 확인. 미해석 동적 import 없음. 동적 Sentry 입력 5개 대조 |
| `node .local/env-layout/consolidate.mjs` | Web 기존 14개 값·Console 기존 12개 값·원본 백업 보존, 템플릿 10/18개 값 전부 빈칸, 개인 파일 ignore·0600 확인 |
| `node .local/env-layout/verify-single.mjs` | 실제 파일 6경로와 가짜 입력 우선순위 fixture 4경로 통과. 두 앱 APP_ENV=local 검증·Sentry 비활성·Console 입력 검증 통과 |
| 추적 diff의 개인 값 대조 | 인증·MFA·R2·DSN 8개 값의 유입 없음. 실제 값 출력 없음 |
| `git diff --check` | 통과 |

우선순위 fixture는 process 덮어쓰기, 모드별 local 파일, `.env.local`과 `.env`의 키별 우선순위,
하위 파일 fallback, test의 `.env.local` 제외를 확인했다. 실제 두 앱은 development·production에서
`.env.local`만 읽고 test에서는 개인 파일을 읽지 않았다. DB·앱 서버·SDK 전송을 실행하지 않았다.
필수 hook·최종 CI·리뷰·squash 결과는 후속 PR 본문에 기록한다. 운영 주입·배포와 #199 보류는 그대로다.
