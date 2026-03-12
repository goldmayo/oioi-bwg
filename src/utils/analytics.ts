// src/utils/analytics.ts
/**
 * 프로젝트 전역에서 사용할 분석 이벤트 래퍼입니다.
 * 외부 라이브러리 의존성을 제거하고 전역 dataLayer를 사용합니다.
 */
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[] | undefined;
  }
}

export const analytics = {
  // 버튼 클릭 및 인터랙션 이벤트
  trackEvent: (eventName: string, params?: Record<string, unknown>) => {
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        ...params,
      });
    }
  },

  // 1. 메인 화면에서 어떤 앨범 클릭했는지
  trackAlbumClick: (albumName: string, imageSlug: string) => {
    analytics.trackEvent("album_click", {
      album_name: albumName,
      album_slug: imageSlug,
    });
  },

  // 2. AlbumDetailModal 에서 어떤 곡들을 클릭했는지
  trackSongClick: (songTitle: string, albumName: string) => {
    analytics.trackEvent("song_click", {
      song_title: songTitle,
      album_name: albumName,
    });
  },

  // 3. LyricsViewerClient 에서 어떤 곡에서 어떤 가사를 가장 많이 선택했는지
  trackLyricClick: (songTitle: string, lyricText: string, startTime: number) => {
    analytics.trackEvent("lyric_click", {
      song_title: songTitle,
      lyric_text: lyricText,
      start_time: startTime,
    });
  },
};
