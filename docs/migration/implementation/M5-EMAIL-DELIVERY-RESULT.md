# M5 이메일 발송 경계 결과

## 완료 범위

- OCI Email Delivery HTTPS Submission API 호출을 `src/server/email/oci-email-delivery.ts`에 추가했다.
- OCI TypeScript SDK의 Instance Principal builder만 사용하며 private key·SMTP credential은 사용하지 않는다.
- 회원가입 인증 메일 본문은 `sendSignupVerificationEmail()`으로 분리했다.
- local/test 환경은 외부 발송 없는 dev 경로를 사용한다.
- production에서 dev 경로를 명시해도 실패하도록 차단했다.
- OCI region, compartment OCID, approved sender 환경변수 계약을 `.env.example`에 추가했다.

## 보류 범위

- `requestOtp()`와 실제 이메일 발송 연결
- 회원가입 Route Handler/Server Action
- OCI Dynamic Group과 IAM policy의 운영 설정
- production credential 및 DB 설정

## 검증

- `pnpm type-check`
- `pnpm test:unit:run` (16 files, 50 tests)
- `pnpm lint` (기존 max-lines 경고 5건)
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`

운영 OCI/DB에는 연결하거나 호출하지 않았다.
