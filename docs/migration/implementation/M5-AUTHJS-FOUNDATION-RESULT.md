---
title: "M5 Auth.js Foundation Result"
document_id: "M5-AUTHJS-FOUNDATION-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-08-30"
depends_on:
  - "M5-AUTH-SCHEMA-RESULT"
---

# M5 Auth.js Foundation Result

## 완료 범위

- Auth.js Credentials provider와 JWT session을 추가했다.
- email/password 입력은 Auth.js 경계에서 Zod로 검증한다.
- PasswordCredential 조회 후 Argon2id PHC hash를 검증한다.
- ACTIVE Account만 `{ id: string }` identity로 반환한다.
- JWT callback은 application identity인 `sub`만 유지하고 role/status를 넣지 않는다.
- 기존 로그인·로그아웃 Server Action을 Auth.js `signIn`/`signOut`으로 교체했다.
- `/api/auth/[...nextauth]` Route Handler를 연결했다.

## 보안 및 보류 범위

- 존재하지 않는 email도 dummy Argon2id hash 검증을 수행해 password verification 경로를 유지한다.
- 인증 실패는 계정 존재·상태·비밀번호 오류를 구분하지 않는 일반 문구로 반환한다.
- `AUTH_SECRET`은 환경변수 계약으로만 추가하고 값은 저장소에 넣지 않았다.
- RequestContext, CASL, admin service/RSC 보안 경계, Supabase Auth 제거는 후속 PR로 보류했다.
- Supabase Storage와 기존 Supabase middleware는 이 checkpoint에서 제거하지 않았다.
- locale 및 assignment 정책은 지원하지 않는다.

## 검증

- `pnpm type-check`
- `pnpm lint` (오류 0건, 기존 max-lines 경고 5건)
- `pnpm lint:fsd`
- `pnpm test:unit:run` (12개 파일, 39건 통과)
- `pnpm build` (Auth.js route 포함 19개 route 생성)

운영 DB에는 연결하거나 변경하지 않았다.
