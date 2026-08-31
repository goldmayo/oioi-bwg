# M6 관리자 Album Client Transport 결과

## 완료 범위

- `features/manage-album/api/{api,queries,mutations}.ts`에 관리자 Album 브라우저 API와 TanStack Query
  option factory를 추가했다.
- 관리자 Album 페이지는 service 결과와 현재 CASL rules를 request-scoped QueryClient에
  `setQueryData()`한 뒤 가까운 `HydrationBoundary`로 전달한다.
- `AlbumManagerClient`는 `useSuspenseQuery()`와 `useMutation()`을 직접 사용하며 생성·수정·삭제 성공 후
  관리자 Album query를 명시적으로 invalidate한다.
- mutation이 `403`을 반환하면 현재 ability query를 다시 조회한다. route-private 조합 컴포넌트가 Auth와
  Album feature를 결합하고, 갱신된 ability가 관리 권한을 거부하면 버튼과 열린 관리 dialog를 숨긴다.
- 기존 Album CRUD Server Action과 action result type, `window.location.reload()`를 제거했다.
- `204 DELETE`를 JSON으로 파싱하지 않도록 공용 Ky transport의 delete 성공 경계를 void 응답으로 정리했다.

## Server/Client query 경계

M4에서 확정한 `client-only` Ky 경계와 RSC의 동일 query identity를 모두 유지한다.

```text
RSC: service → setQueryData(queryOptions.queryKey) → dehydrate
Client: queryOptions(browser Ky queryFn) → hydrated cache → 필요 시 /api refetch
```

`queries.ts`는 server-safe한 key/options를 소유하고, Client consumer가 client-only API query function을
전달한다. Auth와 Album feature를 결합하는 ability HTTP 함수는 단일 consumer인 route-private 조합
컴포넌트에 둔다. RSC 전용 options나 별도 query key factory는 만들지 않았다. 초기 hydration 직후 같은
데이터를 다시 요청하지 않도록 관리자 Album과 ability query에 30초 `staleTime`을 적용했다.

## 검증

- 관리자 Album API unit test: 목록 response contract, invalid contract, POST/PATCH/DELETE 연결
- HTTP transport unit test: body 없는 `204 DELETE`
- `pnpm type-check`
- `pnpm test:harness`
- `pnpm lint` — 오류 0건, 기존 max-lines 경고 5건 유지
- `pnpm lint:fsd`
- `pnpm test:unit:run` — 26 files, 78 tests
- `pnpm format:check`
- `pnpm build`

production DB와 외부 인프라는 연결하거나 변경하지 않았다.

## 보류

- Song create/update/delete와 lyric save HTTP/client transport 전환
- 기존 max-lines 경고 5건의 M6 별도 검토
- 일반 회원가입 UI, OCI production deployment smoke, Base UI 전환
