# M6 관리자 Album HTTP Contract 결과

## 완료 범위

- `GET`/`POST /api/admin/albums`, `PATCH`/`DELETE /api/admin/albums/[id]`를 추가했다.
- request path/body와 response DTO를 shared Zod contract로 검증한다.
- Album service는 admin 권한을 계속 최종 검사하고, 존재하지 않는 update/delete를 `ALBUM_NOT_FOUND`로
  표현한다.
- duplicate Album slug는 `ALBUM_SLUG_ALREADY_EXISTS`(409)로 변환한다.
- 기존 관리자 Server Action consumer와 UI는 유지한다.

## 보류

- `features/manage-album/api/{api,queries,mutations}.ts`와 TanStack Query consumer 전환
- 기존 Album Server Action 제거
- OCI deployment smoke
