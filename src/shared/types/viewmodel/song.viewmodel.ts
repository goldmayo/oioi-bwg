export interface SongViewModel {
  title: string;
  slug: string; // 상세 페이지 연결을 위한 슬러그
  file?: string; // DB 연동 이후로는 점차 사용 빈도가 낮아질 수 있는 필드
  hasOfficial?: boolean;
  isTitle?: boolean;
  youtubeId: string;
}
