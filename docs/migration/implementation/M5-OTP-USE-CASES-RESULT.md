# M5 OTP Use Case 결과

## 완료 범위

- `requestOtp(email, ipAddress)`를 추가했다.
- 이메일을 canonicalize하고 6자리 OTP를 CSPRNG로 생성한다.
- OTP는 `AUTH_SECRET` 기반 HMAC만 저장하고 원문은 내부 이메일 발송 경계로만 전달한다.
- 5분 TTL, 60초 resend cooldown, Email 시간당 5회, IP 시간당 20회 제한을 적용한다.
- 새 OTP 발급 시 기존 PENDING challenge를 무효화한다.
- `verifyOtp(challengeId, otp)`를 추가했다.
- 만료 확인, 실패 횟수 원자 증가, 5회 초과 차단, 성공 시 VERIFIED 전이를 적용한다.
- cooldown은 transaction 내 최신 challenge row lock으로, 시도/성공 전이는 조건부 단일 UPDATE로 경쟁 요청을 방어한다.

## 보안 경계

- OTP 원문은 DB·로그·HTTP 응답에 기록하지 않는다.
- 이 단계에서는 외부 메일 호출을 하지 않는다.
- Account/Profile/PasswordCredential은 생성하지 않는다.
- OCI Email Delivery와 local/test mail sink는 후속 PR에서 연결한다.

## 검증

- `pnpm type-check`
- `pnpm test:unit:run` (14 files, 48 tests)
- `pnpm lint` (기존 max-lines 경고 5건)
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`

production DB에는 연결하거나 변경하지 않았다.
