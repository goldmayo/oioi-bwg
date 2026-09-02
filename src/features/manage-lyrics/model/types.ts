import type { LyricsData } from "@/shared/contracts/song";

/** 가사 편집기를 초기화하는 feature 전용 Song projection이다. */
export interface SongEditor {
  id: number;
  title: string;
  youtubeId: string;
  lyrics: LyricsData;
}
