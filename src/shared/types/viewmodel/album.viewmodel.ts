/**
 * [ViewModel]
 * 클라이언트 및 UI 컴포넌트(Grid, Modal 등)에서 공통으로 의존하는 프론트엔드용 뷰 모델입니다.
 * DB 엔티티나 API DTO와 분리되어 화면 렌더링에 최적화된 구조를 가집니다.
 */

import type { SongViewModel } from "./song.viewmodel";

export interface AlbumViewModel {
  name: string;
  songs: SongViewModel[];
  imageSlug: string; // 정적 에셋 풀업 시 사용하는 레거시/혹은 대체 식별자
  imgUrl: string; // DB에서 동적으로 관리하게 된 외부 저장소 이미지 주소
  color: string;
  officialLink?: string; // 나중에 고도화 시 사용할 공식 카페/영상 링크
}
