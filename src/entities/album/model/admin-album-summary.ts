/** 관리자 콘텐츠 화면에서 사용하는 앨범 요약 projection이다. */
export interface AdminAlbumSummary {
  id: number;
  name: string;
  slug: string;
  imgUrl: string;
  color: string;
  releaseDate: string | null;
  isVisible: boolean;
  createdAt: string;
}
