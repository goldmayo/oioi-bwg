# 타입 아키텍처 리팩토링 — Zod SSOT + 모노레포 전환 대비 [확정]

## 핵심 원칙

1. **모든 API 계약은 Zod 스키마가 SSOT다.** 타입은 `z.infer`로만 만든다.
2. **Entity는 서버 내부에만 존재한다.** `schema.ts`의 Drizzle 타입은 절대 외부로 노출되지 않는다.
3. **`models/`는 Drizzle을 모른다.** `shared/types/`만 import한다.
4. **런타임 검증은 선택적으로.** 타입 선언은 필수, `.parse()` 호출은 필요한 곳에만.
5. **YAGNI.** Update 스키마 등 당장 없는 엔드포인트의 타입은 필요할 때 추가한다.

---

## 패키지 경계 (모노레포 전환 시)

```
현재                              →    미래
──────────────────────────────────────────────
src/shared/types/                 →    packages/types/
  song.schema.ts                         Zod 스키마 + 타입 (SSOT)
  album.schema.ts                        Zod 스키마 + 타입 (SSOT)
  album.ts                               SongViewModel, AlbumViewModel

src/shared/api/db/                →    apps/api/
  drizzle/schema.ts                      SongEntity, AlbumEntity (서버 전용)
  drizzle/queries.ts                     DB 쿼리 함수

src/models/                       →    apps/web/
src/features/                     →    apps/web/
src/shared/api/http/              →    apps/web/
```

---

## 의존성 방향 (지금부터 강제)

```
shared/types/*.schema.ts    ← Drizzle import 금지
shared/api/db/schema.ts     → shared/types/ import 가능
models/                     → shared/types/ 만 import
                               shared/api/db/ import 금지
```

---

## 변경 1: `src/shared/types/song.schema.ts` (신규)

```ts
import { z } from "zod";

/** GET /songs — 목록 아이템 */
export const SongListSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  youtubeId: z.string(),
  albumId: z.number(),
  order: z.number(),
  updatedAt: z.string(),
  hasOfficialCheer: z.boolean(),
  isTitle: z.boolean(),
  isVisible: z.boolean(),
});
export type SongList = z.infer<typeof SongListSchema>;

/** GET /songs/:slug — 단건 (lyrics 포함) */
export const SongSchema = SongListSchema.extend({
  lyrics: z.unknown(),
});
export type Song = z.infer<typeof SongSchema>;

/** POST /songs — 생성 요청 */
export const CreateSongRequestSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  youtubeId: z.string().min(1),
  albumId: z.number().int().positive(),
  hasOfficialCheer: z.boolean().default(false),
  isTitle: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  order: z.number().int().default(0),
  lyrics: z.unknown(),
  // updatedAt 제외 — DB/서버가 자동 관리
});
export type CreateSongRequest = z.infer<typeof CreateSongRequestSchema>;
```

---

## 변경 2: `src/shared/types/album.schema.ts` (신규)

```ts
import { z } from "zod";
import { SongListSchema } from "./song.schema";

/** GET /albums — 목록 아이템 */
export const AlbumListSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  imgUrl: z.string(),
  color: z.string(),
  releaseDate: z.string().nullable(),
  isVisible: z.boolean(),
});
export type AlbumList = z.infer<typeof AlbumListSchema>;

/** GET /albums/:slug — 단건 (songs 포함) */
export const AlbumSchema = AlbumListSchema.extend({
  songs: z.array(SongListSchema),
});
export type Album = z.infer<typeof AlbumSchema>;

/** POST /albums — 생성 요청 */
export const CreateAlbumRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  imgUrl: z.string().url(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  releaseDate: z.string().optional(),
  isVisible: z.boolean().default(true),
});
export type CreateAlbumRequest = z.infer<typeof CreateAlbumRequestSchema>;
```

---

## 변경 3: `src/shared/api/db/drizzle/schema.ts`

Drizzle 고유 타입만 남긴다.

```ts
// 유지: pgTable 정의, relations

// 변경 (rename)
export type AlbumEntity = typeof album.$inferSelect;
export type SongEntity  = typeof song.$inferSelect;

// 제거 (전부 삭제)
// Album, Song, InsertAlbum, InsertSong, SongListItem
```

---

## 변경 4: `src/shared/api/db/drizzle/queries.ts`

반환 타입을 Zod 스키마 기반 타입으로 교체. Entity 반환 금지.

```ts
import type { Song, SongList } from "@/shared/types/song.schema";
import type { Album, AlbumList } from "@/shared/types/album.schema";

export async function getAllSongs(): Promise<SongList[]> {
  return db.query.song.findMany({
    columns: {
      id: true, title: true, slug: true, youtubeId: true,
      albumId: true, order: true, updatedAt: true,
      hasOfficialCheer: true, isTitle: true, isVisible: true,
    },
  });
}

export async function getSongBySlug(slug: string): Promise<Song | undefined> {
  return db.query.song.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
    columns: {
      id: true, title: true, slug: true, youtubeId: true, lyrics: true,
      albumId: true, order: true, updatedAt: true,
      hasOfficialCheer: true, isTitle: true, isVisible: true,
    },
  });
}

export async function getAllAlbums(): Promise<AlbumList[]> {
  return db.query.album.findMany({
    columns: {
      id: true, name: true, slug: true, imgUrl: true,
      color: true, releaseDate: true, isVisible: true,
    },
  });
}
```

---

## 변경 5: `src/shared/types/album.ts` — ViewModel rename

```ts
// Before
export interface AlbumSong { ... }
export interface Album { ... }

// After
export interface SongViewModel { ... }
export interface AlbumViewModel { ... }
```

---

## 변경 6: `src/models/song/mappers.ts`

Drizzle import 전면 제거. `shared/types/` 스키마만 참조.

```ts
// ❌ 절대 금지
import { Song, SongListItem } from "@/shared/api/db/drizzle/schema";

// ✅ 올바른 import
import type { SongList, Song } from "@/shared/types/song.schema";
import type { SongViewModel } from "@/shared/types/album";

export const mapSongListToViewModel = (dto: SongList): SongViewModel => ({
  title: dto.title,
  slug: dto.slug,
  youtubeId: dto.youtubeId,
  hasOfficial: dto.hasOfficialCheer,
  isTitle: dto.isTitle,
});

export type SongDetailViewModel = SongViewModel & {
  order: number;
  lyrics: unknown;
  updatedAt: string;
};

export const mapSongToViewModel = (dto: Song): SongDetailViewModel => ({
  ...mapSongListToViewModel(dto),
  order: dto.order,
  lyrics: dto.lyrics,
  updatedAt: dto.updatedAt,
});
```

---

## 변경 7: `src/models/song/queries.ts` — queryOptions 팩토리

```ts
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/http/base-api";
import { SongListSchema, SongSchema } from "@/shared/types/song.schema";
import type { SongList, Song } from "@/shared/types/song.schema";
import { mapSongListToViewModel, mapSongToViewModel } from "./mappers";

const songKeys = {
  all: ["songs"] as const,
  lists: () => [...songKeys.all, "list"] as const,
  detail: (slug: string) => [...songKeys.all, "detail", slug] as const,
};

export const songQueries = {
  list: () =>
    queryOptions({
      queryKey: songKeys.lists(),
      queryFn: async ({ signal }) => {
        const data = await api.get<SongList[]>("songs", { signal });
        return SongListSchema.array().parse(data); // 런타임 검증 (선택)
      },
      select: (data) => data.map(mapSongListToViewModel),
    }),

  detail: (slug: string) =>
    queryOptions({
      queryKey: songKeys.detail(slug),
      queryFn: async ({ signal }) => {
        const data = await api.get<Song>(`songs/${slug}`, { signal });
        return SongSchema.parse(data);
      },
      select: mapSongToViewModel,
      enabled: !!slug,
    }),
};
```

---

## 변경 8: `src/features/manage-content/actions/song-actions.ts` (신규)

```ts
"use server";
import { api } from "@/shared/api/http/base-api";
import { CreateSongRequestSchema } from "@/shared/types/song.schema";
import type { Song } from "@/shared/types/song.schema";
import type { SongViewModel } from "@/shared/types/album";
import { mapSongListToViewModel } from "@/models/song/mappers";

export async function createSongAction(data: unknown) {
  const parsed = CreateSongRequestSchema.parse(data); // 입력 검증
  try {
    const song = await api.post<Song>("admin/songs", parsed);
    return { success: true, data: mapSongListToViewModel(song) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "곡 생성에 실패했습니다.";
    return { success: false, message };
  }
}
```

---

## 변경 9: `src/features/manage-lyrics/useAdminEditor.ts`

```ts
AdminEditorSong → AdminEditorSongViewModel
```

---

## 영향받는 파일 요약

| 파일 | 변경 내용 |
|:---|:---|
| `drizzle/schema.ts` | `Album`, `Song`, `InsertAlbum`, `InsertSong`, `SongListItem` 삭제 |
| `drizzle/queries.ts` | 반환 타입 → Zod 기반 DTO |
| `models/song/mappers.ts` | Drizzle import 제거, `shared/types/song.schema` import |
| `models/song/queries.ts` | Zod 스키마 기반으로 전면 재작성 |
| `shared/types/album.ts` | `AlbumSong` → `SongViewModel`, `Album` → `AlbumViewModel` |
| `shared/components/album/*.tsx` | `AlbumSong` → `SongViewModel`, `Album` → `AlbumViewModel` |
| `shared/components/chant/*.tsx` | `AlbumSong` → `SongViewModel` |
| `manage-lyrics/ui/*.tsx` (3개) | `AdminEditorSong` → `AdminEditorSongViewModel` |
| `manage-content/actions/song-actions.ts` | 신규 작성 |
| `manage-content/api/useCreateSong.ts` | 신규 작성 |
| `app/(user)/page.tsx` | inline 매핑 → mapper |
| `app/(user)/albums/[slug]/page.tsx` | inline 매핑 → mapper |
| `app/(user)/chants/page.tsx` | inline 매핑 → mapper |
| `containers/*.tsx` | `Album` → `AlbumViewModel` |
| `features/album-info/AlbumDetailModal.tsx` | `Album` → `AlbumViewModel` |
| `features/chant-sync/LyricsViewerClient.tsx` | `Album` → `AlbumViewModel` |

---

## 검증 계획

```bash
pnpm tsc --noEmit   # 0 에러

# 경계 침범 확인
grep -r "drizzle" src/shared/types/    # 없어야 함
grep -r "api/db" src/models/           # 없어야 함
```
