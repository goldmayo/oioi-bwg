/**
 * YouTube IFrame API 객체에 대한 최소한의 타입 정의
 * ESLint 'no-explicit-any' 에러를 해결하기 위해 사용합니다.
 */
export interface YouTubePlayerInstance {
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): {
    video_id: string;
    author: string;
    title: string;
  };
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
}

/**
 * YouTube 이벤트 객체 타입 정의
 */
export interface YouTubeEvent {
  target: YouTubePlayerInstance;
  data: number;
}
