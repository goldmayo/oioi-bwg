# M5 회원가입 OTP API 결과

## 완료 범위

- `POST /api/auth/signup/otp`에서 이메일 OTP를 발급하고 회원가입 전용 OCI/dev 메일 함수를 호출한다.
- `POST /api/auth/signup/otp/verify`에서 challengeId와 6자리 OTP를 검증한다.
- Route Handler boundary에서 Zod 입력 검증과 기존 AppError HTTP 변환을 적용한다.
- 메일 발송 실패 시 해당 PENDING challenge를 무효화한다.
- OTP 원문은 응답·로그에 포함하지 않는다.

## 보류 범위

- `completeSignup()`과 Account/Profile/PasswordCredential 생성
- 이미 등록된 이메일 정책의 최종 UX
- trusted proxy 목록의 운영 설정

## 검증

- `pnpm type-check`
- `pnpm test:unit:run`
- `pnpm lint`
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`

실제 OCI 호출과 production DB 변경은 수행하지 않았다.
