# M4 API Contract Result

## 완료 범위

M4 공개 조회 HTTP 경계를 다음 흐름으로 도입했다.

```text
TanStack Query → ky → /api Route Handler → service → repository → Drizzle
```

- `shared/contracts`에 공개 Album/Song 성공 응답 및 표준 failure 응답 Zod contract를 둔다.
- Ky client는 `get`, `post`, `put`, `patch`, `delete` method를 제공하고, non-2xx를
  `ApiError`로 정규화한다.
- browser HTTP adapter는 `client-only` 경계를 가진다. entity root public API와 client API
  entrypoint를 분리해 RSC가 실수로 내부 HTTP를 호출하지 못하게 한다.
- Query client가 retry를 소유한다. Ky transport retry는 비활성화했고 Query `signal`은
  요청까지 전달된다.
- `GET /api/albums/[slug]`, `GET /api/songs/[slug]`는 params와 성공 응답을 Zod로
  검증한다. expected failure는 service의 `AppError`에서 HTTP failure JSON으로 변환한다.
- 공개 root resource 조회는 repository에서 `isVisible = true`를 강제한다. 따라서
  비공개 Album/Song은 RSC와 API 모두에서 공개되지 않는다.

## FSD 조정

- `song` entity를 신설했다. Song 공개 API/query adapter와 `SongTitleBadge`를 소유한다.
- admin 전용 Song 목록/가사 편집 projection은 단일 feature 소비자에 맞춰 각각
  `manage-song`, `manage-lyrics` model에 둔다. `AdminAlbumSummary`는 두 feature가 함께
  소비하므로 Album entity model에 유지한다.
- admin 화면용 Album/Song projection은 각각 해당 entity model로 내렸다.
- 기존 거대 `manage-content` feature는 `manage-album`, `manage-song`으로 분리했다.
- Album 상세 modal은 단일 route 전용 UI이므로 `/albums/[slug]/_ui`로 이동했다.
- `manage-lyrics`, `chant-sync`, `auth`는 독립된 사용자 행동과 상태를 가지므로 feature에
  유지했다.

## Hydration 판단

공개 Album/Song 페이지는 현재 RSC가 service를 직접 호출하며, 해당 데이터를 client에서
지속적으로 Query 소비하거나 refetch하지 않는다. 따라서 이 checkpoint에서는 불필요한
prefetch/hydration을 추가하지 않았다. 이후 client-side server-state 소비가 생기는 화면에만
RSC prefetch → `HydrationBoundary`를 적용한다.

## 의도적으로 제외한 범위

- M5 authentication, CASL authorization, token refresh
- admin mutation API contract와 revision/discussion/moderation lifecycle
- waveform 등 대용량 upload/download protocol
- URL 및 locale routing 변경

## 검증

- `pnpm type-check` 통과
- `pnpm lint` 오류 0건 (기존/이동된 컴포넌트의 max-lines warning 5건 유지)
- `pnpm test:unit:run` 통과: 10 files, 33 tests
- Route contract test: Album/Song의 200 output contract, invalid slug 400, expected missing
  resource 404를 검증한다.
- Repository test: 공개 Album/Song root query가 `isVisible = true` predicate를 가진다는 것을
  검증한다.
- `pnpm build` 통과: Next.js 16.3.3 Turbopack, 두 공개 API route 포함
- Docker 로컬 DB에서 실제 확인
  - `GET /api/albums/harmony-from-discord` 성공 contract
  - `GET /api/songs/harmony-of-stars` 성공 contract
  - 없는 Song slug는 `404 { "code": "SONG_NOT_FOUND", "message": "..." }`
