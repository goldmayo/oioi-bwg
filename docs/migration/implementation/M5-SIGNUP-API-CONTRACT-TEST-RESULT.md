# M5 회원가입 API 계약 테스트 결과

## 완료 범위

- OTP 발급, OTP 검증, 회원가입 완료 Route Handler의 request validation, success response DTO,
  expected `AppError` HTTP 변환을 테스트했다.
- OTP 발급과 회원가입 완료는 리소스 생성 endpoint이므로 성공 status를 `201`로 명시했다.
- 테스트는 service를 boundary mock으로 사용한다. OTP 원문과 persistence row를 HTTP 테스트에 노출하지
  않는다.

## DOMAIN 추적성

- `AUTH-T001`: 유효한 OTP 검증 후 회원가입 완료 API의 생성 response
- `AUTH-002`: Email → OTP → OTP 검증 → Password/Nickname → Account 생성의 세 HTTP 경계
- `AUTH-003`: 회원가입 완료 요청의 password contract

## 검증

- `pnpm type-check`
- 회원가입 API Route Handler test 9개
- `pnpm lint` (기존 max-lines warning 5건, error 없음)
- `pnpm lint:fsd`
- `pnpm format:check`

## 후속 범위

- 실제 PostgreSQL 17을 사용하는 회원가입 통합 테스트는 isolated test database lifecycle이 마련된 뒤
  별도 checkpoint로 추가한다. 현재 Vitest 설정은 local development DB와 분리된 test database를
  제공하지 않는다.
- OCI Compute 배포 후 Instance Principal 기반 실제 제출·수신 smoke는 M9 배포 checkpoint에서 수행한다.
