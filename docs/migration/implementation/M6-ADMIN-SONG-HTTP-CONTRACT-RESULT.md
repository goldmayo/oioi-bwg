# M6 관리자 Song HTTP 계약 결과

## 완료 범위

- `GET /api/admin/songs`: 관리자 곡 목록 DTO 반환
- `POST /api/admin/songs`: 곡 생성 입력 검증 및 `201 { id }` 반환
- `PATCH /api/admin/songs/[id]`: 곡 수정 입력·path 검증 및 `{ id }` 반환
- `DELETE /api/admin/songs/[id]`: 곡 삭제 및 `204` 반환
- `UNAUTHENTICATED`, `FORBIDDEN`, `SONG_NOT_FOUND`, validation failure의 공통 HTTP 변환 유지
- LRC 원문 해석과 유효 가사 판정을 Server Action에서 Song service로 이동
- update/delete affected row 확인을 통한 `SONG_NOT_FOUND` 보장

## 경계 결정

```text
Route Handler
  = request Zod validation / HTTP status / response contract

Song service
  = admin authorization / LRC parsing / expected AppError

Song repository
  = Drizzle statement / affected row 반환
```

생성·수정 성공 응답은 client가 목록 query를 invalidate하여 다시 조회한다는 전제에서 최소 식별자
`{ id }`만 반환한다. 관계가 포함된 관리자 목록 DTO를 만들기 위한 추가 read와 transaction은 만들지
않았다.

## 의도적으로 보류한 범위

- Song manager의 TanStack Query/ky 전환과 기존 Server Action 제거
- 별도 lyric editor의 구조화된 가사 저장 HTTP endpoint 및 client 전환
- 운영에서 확인되지 않은 `Song.slug` unique constraint 추가
- production DB migration

별도 lyric editor는 이미 구조화된 `LyricsData`를 편집하므로 LRC 원문을 받는 곡 CRUD와 같은 request
contract로 합치지 않는다. 다음 client transport 전환에서 별도의 저장 endpoint로 연결한다.

## 검증

- `pnpm type-check`: 통과
- `pnpm test:harness`: 7개 통과
- `pnpm lint`: 오류 없음, 기존 `max-lines-per-function` 경고 5건
- `pnpm lint:fsd`: 통과
- `pnpm test:unit:run`: 29 files, 88 tests 통과
- `pnpm format:check`: 통과
- `pnpm build`: 통과, 신규 `/api/admin/songs` 및 `/api/admin/songs/[id]` route 확인
