# M5 회원가입 이메일 템플릿 결과

## 완료 범위

- 회원가입 OTP의 subject, text fallback, HTML body 생성을 server-only template 함수로 분리했다.
- HTML은 broad email client 호환성을 위해 table layout과 inline CSS만 사용한다.
- flex/grid, external stylesheet, media query, JavaScript, background image를 사용하지 않는다.
- 동적 HTML 값은 escape하며, text fallback은 항상 함께 제공한다.

## 검증

- template unit test로 subject/text, inline CSS/table 구조, 동적 HTML escape를 검증했다.
- `pnpm type-check`
- `pnpm test:harness`
- `pnpm lint`
- `pnpm lint:fsd`
- `pnpm test:unit:run`
- `pnpm format:check`
- `pnpm build`

## 보류

- multi-client visual rendering 검증은 실제 OCI Email Delivery 운영 준비 후 Gmail, Outlook, Apple Mail에서
  test recipient로 수행한다.
- 관리자 편집 template CMS와 React Email은 email 종류·운영 요구가 늘어날 때 별도 제품 기능으로 검토한다.
