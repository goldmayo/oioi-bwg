# M5 Supabase Auth 제거 결과

## 변경 범위

- Auth.js가 로그인·로그아웃과 세션을 소유하므로 Supabase Auth SSR client와 세션 갱신 Proxy를 제거했다.
- 별도 Proxy가 필요한 UX redirect는 후속 요구가 생길 때 Auth.js 세션을 읽는 얇은 경계로 추가한다.
- Supabase Storage 업로드는 `createStorageClient()`로 분리했다. 세션 쿠키를 읽거나 갱신하지 않으며,
  `persistSession`과 자동 토큰 갱신을 비활성화했다.
- Storage가 M8까지 남으므로 `@supabase/supabase-js`와 Supabase URL/anon key 환경변수는 유지한다.
- `@supabase/ssr`는 더 이상 사용하지 않아 제거했다.

## 보류 항목

- Storage provider 이전과 Supabase JS SDK 제거는 M8에서 수행한다.
- 운영 환경변수 변경이나 production DB 접근은 수행하지 않았다.

## 검증

- `pnpm type-check`
- `pnpm test:harness`
- `pnpm lint`
- `pnpm lint:fsd`
- `pnpm test:unit:run`
- `pnpm format:check`
- `pnpm build`
