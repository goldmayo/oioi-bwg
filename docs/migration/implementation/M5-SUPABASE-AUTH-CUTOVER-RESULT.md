# M5 Supabase Auth 제거 결과

> Supabase Storage 유지 결정은 OCI Object Storage 선택으로 superseded 되었다. 상세 전환 계획은
> `M5-OCI-OBJECT-STORAGE-UPLOAD-PLAN.md`를 따른다.

## 변경 범위

- Auth.js가 로그인·로그아웃과 세션을 소유하므로 Supabase Auth SSR client와 세션 갱신 Proxy를 제거했다.
- 별도 Proxy가 필요한 UX redirect는 후속 요구가 생길 때 Auth.js 세션을 읽는 얇은 경계로 추가한다.
- Supabase Storage 업로드는 `createStorageClient()`로 분리했다. 세션 쿠키를 읽거나 갱신하지 않으며,
  `persistSession`과 자동 토큰 갱신을 비활성화했다.
- OCI Object Storage 전환 전까지 기존 Supabase Storage 호환 경계가 임시로 남아 있다.
- `@supabase/ssr`는 더 이상 사용하지 않아 제거했다.

## 보류 항목

- OCI Object Storage 전환 후 Supabase JS SDK와 Supabase Storage 환경변수를 제거한다.
- 운영 환경변수 변경이나 production DB 접근은 수행하지 않았다.

## 검증

- `pnpm type-check`
- `pnpm test:harness`
- `pnpm lint`
- `pnpm lint:fsd`
- `pnpm test:unit:run`
- `pnpm format:check`
- `pnpm build`
