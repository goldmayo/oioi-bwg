import type { AdminSongSummary } from "@/entities/song";

import type { SongEditInput } from "../model/schemas";

/** 서버 값에서 편집 세션의 초기 입력값만 만든다. */
export function getSongFormDefaults(song?: AdminSongSummary): SongEditInput {
  return {
    albumId: song?.albumId ?? "",
    title: song?.title ?? "",
    slug: song?.slug ?? "",
    youtubeId: song?.youtubeId ?? "",
    hasOfficialCheer: song?.hasOfficialCheer ?? false,
    isTitle: song?.isTitle ?? false,
    isVisible: song?.isVisible ?? true,
    order: song?.order ?? 0,
    lrcText: "",
  };
}
