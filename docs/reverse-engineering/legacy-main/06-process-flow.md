---
title: Legacy Main Detailed Process Flow
document_id: RE-MAIN-006
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
| 0.1.0 | 2026-09-05 | Codex | main 실제 query/action/command/cache 호출 순서 작성 |

# Legacy Main Detailed Process Flow

> 아래 mutation flow의 주체와 순서는 Admin UI entry 기준이다. AdminLayout의 role 검사와 Server Action 자체 인가는 별도 경계이며, UI에서 호출된다는 사실이 Server Action의 admin authorization을 의미하지 않는다.

## 1. Public 홈 조회

```text
UserMainPage
→ Suspense
→ AsyncAlbumsList
→ getAllAlbumsWithSongs()
→ getDb()
→ db.query.album.findMany
→ visible Album + visible Song relation
→ view model mapping / empty album filter
→ AlbumListContainer
```

응원법 목록도 `ChantsDataWrapper → getAllAlbumsWithSongs()`를 사용한 뒤 client list로 평탄화한다.

## 2. Public 상세 조회

```text
/albums/[slug]
→ params.slug
→ getAlbumBySlug(slug)
→ db.query.album.findFirst + visible songs
→ not found면 notFound()
→ AlbumDetailModal

/songs/[slug]
→ params.slug
→ getSongBySlug(slug)
→ db.query.song.findFirst + album/songs relation
→ song 또는 album 없음이면 notFound()
→ LyricsViewerClient
```

`/albums/[slug]` page에는 `"use cache"` 지시어가 있으나, 현재 query 함수에 명시적인 tag/cache helper는 확인되지 않는다.

## 3. 관리자 인증 흐름

```text
AdminLayout
→ createClient() [Supabase server client + cookies]
→ supabase.auth.getUser()
→ app_metadata.role === "admin"?
  → Yes: AdminSidebar + children
  → No: LazyLoginForm
```

로그인 제출은 다음 순서다.

```text
LoginForm
→ FormData(email, password)
→ signIn Server Action
→ supabase.auth.signInWithPassword
→ role 확인
→ non-admin이면 signOut + error 반환
→ admin이면 revalidatePath("/", "layout")
→ redirect("/admin")
```

## 4. 앨범 mutation

```text
AlbumFormDialog
→ AlbumFormSchema parse
→ createAlbumAction 또는 updateAlbumAction
→ getDb()
→ db.insert/update(album)
→ revalidatePath("/", "layout")
→ { success: true }
→ client window.location.reload()
```

삭제는 `deleteAlbumAction → db.delete(album) → revalidatePath → updateTag("songs")` 순서이며 DB FK cascade가 소속 Song을 삭제한다.

## 5. 곡 mutation

```text
SongFormDialog
→ SongFormSchema / SongEditSchema
→ parseLrc(lrcText)
→ LyricsDataSchema.parse
→ db.insert/update(Song)
→ updateTag("songs")
→ 필요 시 updateTag("song-id-${id}")
→ revalidatePath("/", "layout")
→ { success: true }
```

곡 삭제도 `db.delete(Song)` 후 `songs`, `song-id-${id}` tag와 root layout path를 갱신한다.

## 6. 가사 저장

```text
AdminEditorClient
→ saveSongData(songId, { lyrics, youtubeId })
→ LyricsDataSchema.parse(data.lyrics)
→ updateSong command
→ db.update(Song).set({ lyrics, youtubeId, updatedAt })
→ updateTag("songs")
→ updateTag(`song-id-${id}`)
→ revalidatePath("/", "layout")
→ { success: true }
```

## 7. 이미지 업로드

```text
AlbumFormDialog
→ FormData.file
→ uploadAlbumImageAction
→ file 존재/5MB/image type 확인
→ Supabase server client
→ storage.from("images").upload(fileName, file)
→ getPublicUrl(fileName)
→ { success: true, url }
```

## 8. 오류 및 atomicity

- 각 action은 `try/catch`에서 오류를 log하고 사용자용 실패 객체를 반환한다.
- 앨범·곡 mutation에는 명시적인 transaction 호출이 확인되지 않는다.
- 로그인과 이미지 upload의 외부 provider 오류는 각 action에서 처리한다.
- 전체 flow에 공통 API error mapper는 확인되지 않는다.
