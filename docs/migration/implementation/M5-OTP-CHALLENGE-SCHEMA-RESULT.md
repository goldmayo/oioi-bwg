# M5 OTP Challenge Schema 결과

## 완료 범위

- AUTH-002의 OTP challenge 상태와 만료·시도·소모 시각을 persistence schema로 추가했다.
- OTP 원문 대신 `otp_hash`만 저장하도록 계약했다.
- Challenge 상태는 `PENDING`, `VERIFIED`, `CONSUMED`, `INVALIDATED`로 제한했다.
- Email/IP rate limit을 PostgreSQL 원자 counter로 구현할 수 있는 scope·key·window 테이블을 추가했다.
- 도메인 명세의 기존 `Rate limit용 IP: Redis TTL` 결정을 PostgreSQL counter로 수정했다.
- `drizzle/0002_email_verification_challenge.sql`, `drizzle/0003_email_verification_rate_limit.sql`을 생성했다.

## 전이 책임

- `verifyOtp()`가 만료·실패 횟수·`VERIFIED` 전이를 담당한다.
- `completeSignup()`이 `VERIFIED` 확인과 최종 `CONSUMED` 전이 및 계정 생성 transaction을 담당한다.
- OTP 발급 시 Account를 선생성하지 않는다.

## 보류 범위

- OTP 발급/검증 service 구현
- OCI Email Delivery 호출
- 회원가입 완료 API와 Account/Profile/PasswordCredential transaction
- production DB migration 적용

## 검증

- `pnpm exec drizzle-kit generate --name email_verification_challenge`
- `pnpm exec drizzle-kit generate --name email_verification_rate_limit`
- `pnpm type-check`

운영 DB에는 연결하거나 변경하지 않았다.
