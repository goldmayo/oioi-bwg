---
title: Legacy Main User Process Inventory
document_id: RE-MAIN-004
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
| 0.1.0 | 2026-09-05 | Codex | main 실제 page·component·Server Action 기준 process 목록 작성 |

# Legacy Main User Process Inventory

| Process ID | 프로세스 | 주체 | 진입 화면 | 서버 경계 | 데이터 영향 |
|---|---|---|---|---|---|
| PROC-MAIN-PUB-001 | 홈 앨범 탐색 | 누구나 | SCR-MAIN-PUB-001 | RSC query `getAllAlbumsWithSongs` | `Album`, visible `Song` read |
| PROC-MAIN-PUB-002 | 응원법 목록 필터 | 누구나 | SCR-MAIN-PUB-002 | RSC query 후 client filter | DB read only |
| PROC-MAIN-PUB-003 | 앨범 상세 열기 | 누구나 | SCR-MAIN-PUB-003 | RSC query `getAlbumBySlug` | `Album`, visible `Song` read |
| PROC-MAIN-PUB-004 | 곡 응원법 시청 | 누구나 | SCR-MAIN-PUB-004 | RSC query `getSongBySlug` | `Song`, `Album` read |
| PROC-MAIN-PUB-005 | 더보기 정보 탐색 | 누구나 | SCR-MAIN-PUB-005 | 정적 RSC | 없음 |
| PROC-MAIN-ADM-001 | 관리자 로그인 | 관리자 후보 | SCR-MAIN-ADM-001 | Server Action `signIn` → Supabase Auth | session cookie 변경 |
| PROC-MAIN-ADM-002 | 관리자 로그아웃 | authenticated session caller via Admin UI | Admin layout | Server Action `signOut` → Supabase Auth | session cookie 삭제 |
| PROC-MAIN-ADM-003 | 앨범 CRUD | Admin UI caller | SCR-MAIN-ADM-002 | Server Action → `getDb` → Drizzle | `Album` mutation, path revalidation |
| PROC-MAIN-ADM-004 | 곡 CRUD | Admin UI caller | SCR-MAIN-ADM-003 | Server Action → `getDb` → Drizzle | `Song` mutation, tag/path invalidation |
| PROC-MAIN-ADM-005 | 앨범 이미지 업로드 | Admin UI caller | SCR-MAIN-ADM-002 | Server Action → Supabase Storage | Storage object 생성 |
| PROC-MAIN-ADM-006 | 가사 편집·저장 | Admin UI caller | SCR-MAIN-ADM-004 | Server Action → Drizzle command | `Song.lyrics`, `youtubeId`, `updatedAt` |

## 프로세스별 관찰

### Public 조회

Public page는 `shared/api/db/drizzle/queries.ts`를 직접 호출하는 RSC 경로다. HTTP API 호출은 main page 코드에서 확인되지 않는다. 홈과 응원법 목록은 `getAllAlbumsWithSongs`, 상세는 slug query를 사용한다.

### 관리자 mutation

관리자 content action은 AdminLayout을 통과한 UI에서 호출되지만 action 자체에는 별도 admin role 검사가 확인되지 않는다. 성공 시 `{ success: true }`, 실패 시 `{ success: false, error }`를 반환한다. 이 envelope는 HTTP response가 아니라 Server Action 반환값이다.

### 이미지 업로드

`FormData.file`을 받아 5MB 이하·`image/*` 파일을 확인하고 Supabase Storage `images` bucket에 업로드한 뒤 public URL을 반환한다. main code에는 action 내부 admin auth 확인이 없다.

### 가사 저장

`saveSongData(songId, data)`는 `LyricsDataSchema`로 lyrics를 검증하고 `updateSong` command를 호출한다. command 내부에서 `updateTag("songs")`, `updateTag("song-id-${id}")`를 수행하고 action은 root layout `revalidatePath`를 수행한다.

## 4. 확인 필요

- Public query가 실제 production에서 어떤 cache mode로 실행되는지
- Supabase Storage bucket public policy와 RLS/policy
- Server Action이 실제로 어떤 사용자 경계에서 호출되는지
