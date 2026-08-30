# M5 회원가입 완료 결과

## 완료 범위

- `completeSignup(challengeId, password, nickname)`을 구현했다.
- VERIFIED challenge만 소비할 수 있다.
- challenge consume과 Account/Profile/PasswordCredential 생성을 하나의 transaction으로 처리한다.
- 신규 계정은 `USER`/`ACTIVE`로 생성한다.
- Password policy와 Argon2id hash 저장을 적용했다.
- 이메일·닉네임 unique 충돌을 expected AppError로 변환한다.
- `POST /api/auth/signup/complete` Route Handler와 Zod contract를 추가했다.

## 보류 범위

- 회원가입 화면 UI
- 완료 후 자동 로그인 UX
- 관리자 role bootstrap
- FE CASL ability 전달과 Supabase Auth 제거

## 검증

- `pnpm type-check`
- `pnpm test:unit:run` (17 files, 55 tests)
- `pnpm lint` (기존 max-lines 경고 5건)
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`
- `pnpm build`

production DB에는 연결하거나 변경하지 않았다.
