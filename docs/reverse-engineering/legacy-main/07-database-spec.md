---
title: Legacy Main Database Specification
document_id: RE-MAIN-007
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
| 0.1.0 | 2026-09-05 | Codex | main runtime schema, Drizzle query/command, migration 기준 DB 구조 작성 |

# Legacy Main Database Specification

## 1. DB 접근 경계

```text
RSC / Server Action
→ shared/api/db/drizzle/queries.ts 또는 commands.ts
→ getDb()
→ postgres-js
→ env.DB.connectionString (Hyperdrive) 또는 DATABASE_URL fallback
→ PostgreSQL
```

`getDb`는 React `cache()`로 감싸져 request/render lifecycle 내 DB instance를 재사용한다. `prepare: false`, `max: 5`, `fetch_types: false`가 설정되어 있다.

## 2. Runtime schema inventory

실제 application runtime이 import하는 `src/shared/api/db/drizzle/schema.ts`에는 다음 2개 table이 있다.

| Table | 주요 column | Key / relation |
|---|---|---|
| `Album` | `id`, `name`, `slug`, `imgUrl`, `color`, `releaseDate`, `isVisible`, `createdAt` | `id` PK |
| `Song` | `id`, `albumId`, `title`, `youtubeId`, `lyrics`, `hasOfficialCheer`, `isTitle`, `isVisible`, `order`, `createdAt`, `updatedAt`, `slug` | `id` PK, `albumId → Album.id CASCADE`, `Song_slug_key` unique index |

### Album

- `id`: serial PK
- `name`, `slug`, `imgUrl`, `color`: non-null text
- `releaseDate`: nullable timestamp(3)
- `isVisible`: boolean default true, non-null
- `createdAt`: timestamp(3) default CURRENT_TIMESTAMP, non-null

### Song

- `id`: serial PK
- `albumId`: non-null integer FK to Album, `ON DELETE CASCADE`
- `title`, `youtubeId`, `lyrics`, `slug`: non-null
- `hasOfficialCheer`, `isTitle`, `isVisible`: non-null boolean; defaults false/false/true
- `order`: non-null integer default 0
- `createdAt`: timestamp(3) default CURRENT_TIMESTAMP, non-null
- `updatedAt`: timestamp(3) non-null, command/action에서 값을 명시적으로 공급
- `Song_slug_key`: btree unique index

`lyrics`는 JSONB이고 application `LyricsDataSchema`가 배열·line·segment 구조를 검증한다. DB migration의 JSON 내부 check constraint는 확인되지 않는다.

## 3. ORM relation

`schema.ts`에서 `albumRelations.songs`와 `songRelations.album`이 정의된다. `drizzle/relations.ts`는 빈 import만 있고 별도 relation 정의는 없다.

## 4. Migration / configuration discrepancy

- `drizzle/0000_solid_mysterio.sql`와 `drizzle/schema.ts`는 main tree에 존재한다.
- `drizzle.config.ts`의 schema path는 `./src/libs/db/drizzle/schema.ts`다.
- 해당 path는 main tree inventory에서 확인되지 않는다.
- runtime query/command는 `./src/shared/api/db/drizzle/schema.ts`를 import한다.
- root `drizzle/schema.ts`에는 `Song` 단일 table과 `albumName` column이 정의되어 있어 runtime schema와 일치하지 않는다.

위 차이는 저장소에서 직접 확인되는 Legacy 상태이며, 어느 쪽이 운영 DB의 canonical인지 이 문서에서 보정하지 않는다.

따라서 main repository에는 runtime schema, migration/tooling schema, Drizzle config가 하나의 schema SSOT로 정합되지 않은 상태가 확인된다. 어느 정의가 운영 정답인지는 `unknown`으로 남긴다.

## 5. Query patterns

| 함수 | 동작 |
|---|---|
| `getSongBySlug` | slug로 Song 단건 조회, Album와 songs relation 포함 |
| `getSongById` | id 단건 조회 |
| `getAllSongs` | visible song 전체, order 오름차순 |
| `getAllAlbumsWithSongs` | visible album + visible songs, releaseDate 내림차순 |
| `getAlbumBySlug` | slug 앨범 단건 + visible songs |
| `getAllAlbums` | 전체 album, releaseDate 오름차순 |
| `getSongsWithAlbum` | 전체 song + album name, albumId/order 오름차순 |

## 6. Mutation / delete policy

- Album create/update/delete는 직접 Drizzle mutation이다.
- Song create/update/delete는 직접 Drizzle mutation이다.
- Album 삭제 FK는 Song cascade다.
- 명시적인 application transaction은 확인되지 않는다.
- seed script는 `package.json`의 `db:seed`에 등록되어 있으나 해당 `src/libs/db/drizzle/seed.ts` 파일은 main tree에서 확인되지 않는다.
- Supabase client는 DB query client가 아니라 Auth/Storage 용도로 확인된다.

## 7. 확인 필요

- 실제 production database schema와 main migration의 일치 여부
- `DATABASE_DIRECT_URL`, Hyperdrive binding, Supabase Postgres의 실제 연결 대상
- RLS/policy SQL 또는 Supabase dashboard 설정
- `drizzle.config.ts`와 root schema discrepancy가 배포·migration에 미친 실제 영향
