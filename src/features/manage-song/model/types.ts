/** 곡 관리 목록과 편집 폼이 공유하는 admin 전용 Song projection이다. */
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
