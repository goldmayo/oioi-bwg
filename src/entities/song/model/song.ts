/** 관리자 곡 목록과 편집 폼에서 사용하는 곡 요약 projection이다. */
export interface AdminSongSummary {
  id: number;
  title: string;
  slug: string;
  albumId: number;
  order: number;
  youtubeId: string;
  updatedAt: string;
  hasOfficialCheer: boolean;
  isTitle: boolean;
  isVisible: boolean;
  album: { name: string };
}

/** 관리자 가사 편집기를 초기화하는 최소 Song projection이다. */
export interface SongEditor {
  id: number;
  title: string;
  youtubeId: string;
  lyrics: unknown;
}
