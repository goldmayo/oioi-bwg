import type { AlbumDetail } from "@/shared/contracts/album";

/**
 * [ViewModel]
 * 클라이언트 및 UI 컴포넌트(Grid, Modal 등)에서 공통으로 의존하는 프론트엔드용 뷰 모델입니다.
 * HTTP DTO와 persistence row를 직접 노출하지 않고 화면에 필요한 구조만 표현합니다.
 */

export interface AlbumSong {
  title: string;
  slug: string; // 상세 페이지 연결을 위한 슬러그
  file?: string; // DB 연동 이후로는 점차 사용 빈도가 낮아질 수 있는 필드
  hasOfficial?: boolean;
  isTitle?: boolean;
  youtubeId: string;
}

export interface Album {
  name: string;
  songs: AlbumSong[];
  imageSlug: string; // 정적 에셋 풀업 시 사용하는 레거시/혹은 대체 식별자
  imgUrl: string; // DB에서 동적으로 관리하게 된 외부 저장소 이미지 주소
  color: string;
  officialLink?: string; // 나중에 고도화 시 사용할 공식 카페/영상 링크
}

/** 공개 Album DTO를 현재 UI가 소비하는 최소 view model로 변환한다. */
export function toAlbumViewModel(album: AlbumDetail): Album {
  return {
    name: album.name,
    imageSlug: album.slug,
    imgUrl: album.imgUrl,
    color: album.color,
    songs: album.songs.map((song) => ({
      title: song.title,
      slug: song.slug,
      youtubeId: song.youtubeId,
      hasOfficial: song.hasOfficialCheer,
      isTitle: song.isTitle,
    })),
  };
}
