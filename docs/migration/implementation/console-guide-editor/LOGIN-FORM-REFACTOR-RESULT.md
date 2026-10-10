---
title: "Console 로그인 폼 책임 분리와 흐름 주석 결과"
kind: migration-result
status: completed
source_commit: 9a2f24ca87a8ce386a810977751e37fc0a33124c
created_at: "2026-10-10"
---

# 로그인 폼 리팩터링 결과

사용자의 코드 정리/인증 흐름 주석 요청에 따라 `9e1e6ba`에서 분기했다.
기존 [P05-D 계획](P05-D-PLAN.md)의 RHF/local memory와 입력/QR 폐기 계약을 유지한다.
사용자가 수정한 등록/로그인 복귀 버튼의 두 스타일을 보존했다. 별도 열린 로컬 실행 PR은 합치지 않았다.

LoginForm은 296줄에서 118줄로 줄이고 요청·상태·검증·폐기를 auth model hook으로 옮겼다.
입력은 CredentialsFields/OtpField로 명시하며 필드 이름별 삼항식과 filter/map을 제거했다.
confirm 상태가 QR/version을 함께 소유한다. 로그인/등록 단계, 서버 요청/세션 발급 시점,
공통 폐기 경로, HTTP 취소와 Action의 늦은 결과, 이전 finally와 새 요청 경계를 주석으로 설명했다.
새 framework/저장소/의존성과 Auth.js·서버 인가·limiter·DB schema 변경은 없다.

- 기본 여섯 검사 모두 통과: type-check, harness(18건), lint, FSD, unit(452건), format.
  workspace type-check/lint/unit은 Console 재실행과 나머지 세 workspace cache, repo 검사도 통과했다.
- 새 UI 테스트는 등록 완료의 version 전달/입력 폐기, pagehide 후 늦은 QR 응답 무시,
  제한 안내/OTP 폐기를 확인한다. 기존 SSR/hydration·최종 credentials 제출 테스트도 유지했다.
  초기 matcher 타입 오류로 type-check/build가 실패해 기존 assertion 방식으로 보완한 뒤 통과했다.
- local Compose URL과 SENTRY_SOURCE_MAPS_ENABLED=false를 명시한
  `pnpm build --env-mode=loose --force`: 두 앱 cache 없이 통과.
- `pnpm test:integration:admin:local`: 실제 PostgreSQL/Auth.js/브라우저/CLI 전체 통과.
  QR 해독·동시 setup/confirm·등록 후 다음 OTP 로그인·reset/재등록·옛 JWT 회수와
  두 앱 관리 CRUD/가사 편집/401 초안 보존을 확인했다. 증거 `/tmp/oioi-p04-smoke-NttvAN`.
  정리 후 잔여 connection/advisory lock 0, 임시 DB 삭제 완료다.
- `git diff --check` 통과. QR/인증 입력이 없는 [로그인](LOGIN-FORM-LOGIN.png)/
  [등록 완료](LOGIN-FORM-ENROLLED.png) 화면을 확인했다. 코드 pre-commit ESLint/Prettier도 통과했다.

push hook/CI는 직접 검사와 구분해 PR에 기록한다. production credential/운영 seed를 사용하지 않았다.
새 PR 병합, 열린 로컬 실행 PR 병합과 P06/배포는 포함하지 않는다.
