---
title: Legacy Main API / Server Boundary Specification
document_id: RE-MAIN-008
version: 0.1.0
status: draft
authority: plan
source:
  repository: goldmayo/oioi-bwg
  branch: main
  commit: 4b299934846f4a0eed7132f58c5b1c2a481a3739
---

## Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-09-05 | Codex | main HTTP route, Server Action, RSC, Worker, external boundary inventory 작성 |

# Legacy Main API / Server Boundary Specification

## 1. HTTP API 결과

main commit tree에서 `src/app/api/**/route.ts`, `src/pages/api/**` 및 별도 application API route는 확인되지 않는다.

```text
HTTP Route Handler 기반 application API는 확인되지 않음.
Mutation은 Server Action을 통해 수행됨.
Public 조회는 RSC가 Drizzle query helper를 직접 호출함.
```

따라서 migration 이후의 `/api/admin/*` 또는 `/api/auth/*` endpoint를 main 기준 문서에 포함하지 않는다.

## 2. Server Action inventory

| Action | 파일 | 입력 | 동작 | 반환 |
|---|---|---|---|---|
| `signIn` | `src/features/auth/actions.ts` | FormData email/password | Supabase password login 및 admin role 확인 | 실패 `{ error }`, 성공 redirect |
| `signOut` | 동일 | 없음 | Supabase signOut, root revalidate, `/` redirect | redirect |
| `createAlbumAction` | `manage-content/actions.ts` | unknown form data | schema parse 후 Album insert | `{ success, error? }` |
| `updateAlbumAction` | 동일 | id + unknown form data | Album update | `{ success, error? }` |
| `deleteAlbumAction` | 동일 | id | Album delete, cascade | `{ success, error? }` |
| `createSongAction` | 동일 | unknown form data | LRC parse/validate 후 Song insert | `{ success, error? }` |
| `updateSongAction` | 동일 | id + unknown form data | optional LRC parse 후 Song update | `{ success, error? }` |
| `deleteSongAction` | 동일 | id | Song delete | `{ success, error? }` |
| `uploadAlbumImageAction` | 동일 | FormData file | Supabase Storage upload | `{ success, url? / error? }` |
| `saveSongData` | `manage-lyrics/actions.ts` | songId + lyrics/youtubeId | lyrics validate 및 command update | `{ success, error? }` |

Server Action은 REST path/method/status 계약으로 변환하지 않는다. 오류는 action별 plain object 또는 redirect로 처리된다.

## 3. RSC direct server call

| 화면 | 직접 호출 | 결과 |
|---|---|---|
| 홈 | `getAllAlbumsWithSongs` | view model을 client container에 전달 |
| 응원법 목록 | `getAllAlbumsWithSongs` | flattened initialSongs 전달 |
| 앨범 상세 | `getAlbumBySlug` | AlbumDetailModal 전달 또는 `notFound()` |
| 곡 상세 | `getSongBySlug` | LyricsViewerClient 전달 또는 `notFound()` |
| 관리자 앨범 | `getAllAlbums` | AlbumManagerClient initial data |
| 관리자 곡 | `getSongsWithAlbum`, `getAllAlbums` | SongManagerClient initial data |
| 관리자 편집 | `getSongBySlug` | LazyAdminEditor 전달 또는 `notFound()` |

## 4. Worker endpoint

Cloudflare Worker `worker/index.ts`는 모든 요청을 `handler.fetch(request)`로 vinext app-router entry에 위임한다. 단, `/_vinext/image`는 Worker에서 직접 Cloudflare Images binding과 ASSETS binding을 사용해 이미지 최적화 응답을 반환한다.

## 5. External boundaries

- Supabase Auth: `signInWithPassword`, `signOut`, `getUser`
- Supabase Storage: `images` bucket upload 및 public URL 생성
- Cloudflare R2: main runtime code에서 직접 호출은 확인되지 않음
- Cloudflare Images: Worker의 `IMAGES` binding으로 이미지 transform
- YouTube: viewer의 외부 player integration

## 6. Cache / response boundary

- Server Action은 `revalidatePath("/", "layout")`를 직접 호출한다.
- Song command는 `updateTag("songs")`, `updateTag("song-id-${id}")`를 호출한다.
- 모든 mutation에 동일한 cache invalidation이 적용되는 것은 아니다. Album create/update는 path만, delete는 path와 songs tag를 호출한다.
- 공통 HTTP error response mapper, HTTP status, API envelope는 확인되지 않는다.
