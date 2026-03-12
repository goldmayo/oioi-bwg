// src/utils/analytics.ts
import { sendGTMEvent } from "@next/third-parties/google";
/**
 * 프로젝트 전역에서 사용할 분석 이벤트 래퍼입니다.
 * 라이브러리 교체 시 이 함수 내부만 수정하면 됩니다.
 */
export const analytics = {
  // 버튼 클릭 및 인터랙션 이벤트
  trackEvent: (eventName: string, params?: Record<string, unknown>) => {
    if (typeof window !== "undefined") {
      // sendGTMEvent는 내부적으로 window.dataLayer.push를 수행합니다.
      sendGTMEvent({ event: eventName, ...params });
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
