---
title: "Console 로컬 실행 편의 기능 결과"
kind: migration-result
status: completed
source_commit: 03a6697
created_at: "2026-10-10"
---

# Console 로컬 실행 결과

사용자의 env 주석/단일 실행 명령 요청으로 `9e1e6ba`에서 분기했다. 시작 시 사용자 Console
env 두 파일은 비어 있었다. `.env.local`에 주석과 서로 다른 개발용 키를 생성하고 0600으로
보관했다. Git ignore를 확인했으며 이 파일과 실제 키는 커밋하거나 출력하지 않았다.

`pnpm dev:console:local`은 Console env 검사 → Compose PostgreSQL health 대기 → 고정된
로컬 bootstrap URL로 guarded migration → Console dev 순서다. 기존 데이터/키와 계정을
초기화하지 않으며 잘못된 대상/키/Origin은 실행 전에 거절한다. 반복 사용법의 canonical home은
[로컬 개발환경 문서](../LOCAL-DEVELOPMENT-ENVIRONMENT.md#console-mfa-로컬-확인-p05-이후)다.
Auth/Domain 정책, app runtime과 DB schema 변경은 없다.

- 기본 여섯 검사 모두 통과: type-check, harness(18건), lint, FSD, unit(449건), format.
  workspace type-check/lint/unit은 Console 재실행 및 나머지 세 workspace cache였다.
  별도 repo type-check/lint도 통과했다. app runtime/build 변화가 없어 build는 추가 실행하지 않았다.
- `pnpm test:ops`: 70건 통과(새 16건). 잘못된 DB 대상/Origin/키 거절과 오류의 credential 미노출.
- 실제 `pnpm dev:console:local`: Compose PostgreSQL healthy → 미적용 migration 4건 적용 →
  dev 실행 성공. 실제 DB의 admin_mfa 생성과 기존 ACTIVE ADMIN 1건 보존을 확인했다.
- Playwright로 health 200, 로그인/등록 입력 화면 및 브라우저 오류 없음을 확인했다.
  QR 생성/물리 인증기 등록은 이번 편의 기능 검증에서 실행하지 않았다.
- Ctrl+C 종료 후 3001 listener 없음, PostgreSQL 보존과 `git diff --check` 통과.
  이번 next dev가 생성한 AGENTS/CLAUDE 파일만 정리했다.

코드 pre-commit ESLint/Prettier는 통과했다. push hook은 직접 검사와 구분해 PR에 기록한다.
Docker daemon 자체 시작, production 연결/배포와 P06은 포함하지 않는다.
