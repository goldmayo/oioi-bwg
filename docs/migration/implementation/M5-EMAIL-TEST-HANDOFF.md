# M5 이메일 테스트 Handoff

## 2026-08-30 현재 상태

- 회원가입 OTP 메일의 server-only template 분리 구현은 PR #39에 있다.
- HTML은 table layout, inline CSS, text fallback만 사용한다. flex/grid, media query, 외부 stylesheet,
  JavaScript, background image는 사용하지 않는다.
- OCI Email Delivery의 domain, approved sender, DKIM, HTTPS Submission API 및 실제 외부 수신은
  운영 설정 차원에서 확인됐다.
- 아직 OCI Compute에 현재 애플리케이션을 배포하지 않았으므로, **현재 앱이** Instance Principal로
  OCI Email Delivery에 제출하고 수신한 smoke는 미완료다.

## 로컬 실행 경계

- `compose.dev.yml`의 `next` 서비스는 `.env.local`만 `env_file`로 읽는다. `.env`만 수정하면
  Compose 컨테이너에는 반영되지 않는다.
- 코드 변경은 bind mount로 반영되므로 의존성 변경이 없는 한 image rebuild가 필요하지 않다.
- `.env.local`의 환경변수를 변경한 경우에는 기존 컨테이너의 환경이 갱신되지 않으므로 다음처럼
  `next` 컨테이너를 재생성한다.

  ```bash
  docker compose -f compose.dev.yml up -d --force-recreate next
  ```

- local development의 기본 `EMAIL_DELIVERY_MODE=dev`는 외부 전송 없이 성공 응답만 반환한다.
- `EMAIL_DELIVERY_MODE=oci` 경로는 `InstancePrincipalsAuthenticationDetailsProviderBuilder`만
  사용한다. OCI Compute 밖의 local Docker/host에서는 인증할 수 없으며, API key·private key·SMTP
  credential을 local 환경변수에 추가하지 않는다.

## 검증 완료

- template unit test: subject/text fallback, table·inline CSS 구조, dynamic HTML escape
- `pnpm type-check`
- `pnpm test:harness`
- `pnpm lint` (기존 max-lines warning 5건, error 없음)
- `pnpm lint:fsd`
- `pnpm test:unit:run` (19 files, 59 tests)
- `pnpm format:check`
- `pnpm build`

## 다음 작업

1. PR #39을 merge한다.
2. 별도 작은 PR로 회원가입 API의 Route Handler 계약 테스트와 local PostgreSQL 통합 테스트를 추가한다.
   테스트 process에서만 OTP 난수와 email submit을 mock해, OTP 원문을 DB/log/HTTP response에 노출하지
   않고 `request → verify → complete` 전체 흐름을 검증한다.
3. OCI Compute 배포 후 `EMAIL_DELIVERY_MODE=oci`로 test recipient에 한 번 발송해 앱의
   Instance Principal → HTTPS Submission → 실제 수신을 smoke한다. Gmail, Outlook, Apple Mail에서
   HTML 렌더링을 확인한다.

## 비범위

- 테스트 편의를 위한 OTP 조회 API 또는 dev HTTP response에 OTP 원문을 추가하지 않는다.
- local 실발송을 위해 OCI API key/private key/SMTP credential 기반의 별도 인증 경로를 만들지 않는다.
- 관리자 template CMS와 React Email 도입은 이메일 종류나 편집 운영 요구가 생길 때 별도 제품 기능으로
  검토한다.
