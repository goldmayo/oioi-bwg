# M5 회원가입 이메일 인증 구현 계획

## 결정 사항

- 구현 기준은 `DOMAIN_SPECIFICATION.md`의 AUTH-001/AUTH-002다.
- 회원가입 흐름은 `Email → OTP 발급 → OTP 검증 → Password/Nickname 입력 → Account 생성` 순서를 유지한다.
- OTP 검증과 계정 생성을 하나의 transaction으로 묶지 않는다.
- `verifyOtp()`는 challenge를 `VERIFIED`로 전이하고, `completeSignup()`이 별도 요청에서 이를 소비한다.
- Password/Nickname은 challenge에 저장하지 않고 `completeSignup()` 요청으로만 전달한다.
- OTP 원문은 DB, 로그, HTTP 응답에 저장하거나 노출하지 않는다.
- Redis를 새로 도입하지 않는다. PostgreSQL rate limit 구현 전 `DOMAIN_SPECIFICATION.md`의 `Rate limit용 IP: Redis TTL` 결정을 수정 대상으로 먼저 표시하고 합의한다.
- 이메일 발송은 작은 server infrastructure 함수와 회원가입 전용 함수만 둔다. 범용 provider interface, adapter hierarchy, SMTP credential은 도입하지 않는다.
- production은 OCI Email Delivery HTTPS API와 Instance Principal을 사용한다. OCI private key와 SMTP credential은 애플리케이션 환경변수에 저장하지 않는다.

## 제안 PR 순서

### PR A — 도메인 결정과 challenge schema

1. `DOMAIN_SPECIFICATION.md`에서 IP rate limit 저장소 결정을 PostgreSQL 구현과 일치하도록 개정한다.
2. OTP challenge 상태(`PENDING`, `VERIFIED`, `CONSUMED`, `INVALIDATED`)와 전이 규칙을 명시한다.
3. challenge 테이블과 local migration을 추가한다.
4. email canonicalization, expiry, attempt/cooldown, consumed 시각과 필요한 unique/index/check를 확정한다.

운영 DB에는 적용하지 않고 SQL 검토와 local schema test만 수행한다.

### PR B — OTP use case

1. `requestOtp(email, clientIp)`를 구현한다.
2. Email/IP 시간당 제한과 60초 resend cooldown을 원자적으로 적용한다.
3. 기존 challenge를 즉시 무효화하고 새 6자리 OTP challenge를 발급한다.
4. `verifyOtp(challengeId, otp)`를 구현한다.
5. 만료 확인, 실패 횟수 원자 증가, 5회 초과 차단, 성공 시 `VERIFIED` 전이를 보장한다.
6. OTP 비교는 저장된 hash/HMAC와 수행하며 원문을 반환하지 않는다.

### PR C — 이메일 발송 경계

1. OCI Email Delivery HTTPS 호출을 담당하는 작은 server infrastructure 함수를 추가한다.
2. OCI Instance Principal 인증과 endpoint/region/sender 환경변수 계약을 추가한다.
3. 회원가입 인증 메일 본문을 생성·발송하는 application-specific 함수를 추가한다.
4. challenge 저장/갱신과 외부 메일 호출을 분리하고, 발송 실패 상태를 안전하게 처리한다.
5. local/test에서는 실제 OCI 호출 없이 sink/mock 경로를 사용하되 production에서 dev-mail 경로를 차단한다.

### PR D — 회원가입 완료와 Auth.js 연결

1. `completeSignup(challengeId, password, nickname)`을 구현한다.
2. `VERIFIED` challenge 확인과 최종 consume, Account/Profile/PasswordCredential 생성을 하나의 transaction으로 처리한다.
3. Account 생성 경쟁은 email unique 제약과 명시적인 expected error로 처리한다.
4. Password policy와 Argon2id hash 저장을 적용한다.
5. 회원가입 Route Handler/Server Action의 입력·출력·실패 계약을 추가한다.
6. 완료 후 Auth.js 로그인 경계와 연결하되, OTP 검증 전에는 Account를 생성하지 않는다.

## 필수 테스트

- 정상 발급, cooldown, email/IP 시간당 제한
- 재발급 시 이전 challenge 무효화
- 만료 OTP, 잘못된 OTP, 5회 초과 시도
- 성공 검증의 단일 `VERIFIED` 전이와 재검증 거부
- `completeSignup()`의 challenge 상태·최종 consume·계정 3종 생성 원자성
- 동일 email 동시 완료 요청
- OTP/비밀번호/메일 발송 실패 시 원문 및 민감정보 비노출
- local/test sink 동작과 production dev-mail 차단
- OCI 호출은 Instance Principal 경계 밖에서 실행하지 않음

## 보류 및 비범위

- Google/Kakao OAuth 회원가입
- Password reset 및 이메일 변경
- Redis 도입
- SMTP
- 범용 이메일 provider framework
- production DB migration 적용
