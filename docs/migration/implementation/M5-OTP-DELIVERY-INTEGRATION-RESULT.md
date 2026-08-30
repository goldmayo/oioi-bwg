# M5 OTP 발송 연결 결과

## 완료 범위

- `requestOtp()`가 DB transaction 종료 후 `sendSignupVerificationEmail()`을 호출한다.
- 정상 반환값은 `{ challengeId }`뿐이며 OTP plaintext는 호출자에게 반환하지 않는다.
- OCI `submitEmail` 응답의 `messageId`, `envelopeId`, `suppressedRecipients`, `opcRequestId`를 의미별로 분리한다.
- `suppressedRecipients`에 대상이 포함되면 발송 성공으로 처리하지 않고 challenge를 무효화한다.
- 명시적인 OCI 4xx 거부도 challenge를 무효화할 수 있는 확정적 실패로 분류한다.
- timeout, connection reset 등 제출 여부가 불명확한 오류는 challenge를 자동 무효화·재발급·재전송하지 않는다.
- `.env.example`은 placeholder를 유지하고, 운영값은 OCI runtime 환경변수로 관리한다.
- 운영 완료 상태는 `OCI-EMAIL-DELIVERY-RUNBOOK.md`에 기록한다.

## 검증

- 실제 OCI 네트워크 호출 없이 SDK client를 mock했다.
- `pnpm type-check`
- `pnpm test:unit:run` (16 files, 53 tests)
- `pnpm lint` (기존 max-lines 경고 5건)
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`
- `pnpm build`

production DB와 OCI runtime에는 연결하거나 변경하지 않았다.
