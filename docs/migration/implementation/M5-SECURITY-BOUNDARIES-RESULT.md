# M5 보안 경계 적용 결과

## 범위

- 관리자 RSC layout은 Auth.js 기반 `RequestContext`를 사용한다.
- 비로그인 요청은 로그인 화면을 표시하고, 로그인했지만 관리자 권한이 없는 요청은 `forbidden()`으로 종료한다.
- 관리자 앨범·곡 조회 및 변이 service는 `RequestContext`를 받아 활성 사용자와 `manage all` 권한을 검증한다.
- 관리자 Server Action과 가사 저장 action은 요청 context를 service 경계까지 전달한다.
- Proxy와 Supabase Storage 의존성은 변경하지 않았다.

## 정책

관리자 service는 `requireUser()`로 인증을 확인한 뒤 CASL ability의 `manage all` 권한을 확인한다. 실패는 각각 `UNAUTHENTICATED`와 `FORBIDDEN` `AppError`로 표현되며, HTTP 변환은 기존 Route Handler 경계를 따른다.

## 검증

- `pnpm type-check`
- `pnpm test:unit:run` (14 files, 47 tests)
- `pnpm lint` (기존 max-lines 경고 5건)
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`

production DB에는 연결하거나 변경하지 않았다.
