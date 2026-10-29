import type { EventEmitterForPlayerEvents, PlayerAdapter } from "peaks.js";

import type { YouTubePlayerInstance } from "@/shared/model/youtube";

/** Peaks의 시간축은 요청한 seek 값이 아니라 실제 IFrame 시각으로만 갱신한다. */
export function createYouTubePeaksPlayer(
  player: YouTubePlayerInstance,
  videoId: string,
  duration: number,
  onTimeUpdate: (time: number) => void,
  isBlocked: () => boolean,
): PlayerAdapter {
  let emitter: EventEmitterForPlayerEvents | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let time = 0;
  let playing = false;
  let pendingSeek: { time: number; requestedAt: number } | undefined;
  let destroyed = false;
  const available = () => !destroyed && !isBlocked() && player.getVideoData().video_id === videoId;
  const sync = () => {
    if (!available()) return;
    const actual = player.getCurrentTime();
    if (!Number.isFinite(actual) || actual < 0) return;
    time = actual;
    const nextPlaying = player.getPlayerState() === 1;
    if (playing !== nextPlaying) {
      playing = nextPlaying;
      if (playing) emitter?.emit("player.playing", actual);
      else emitter?.emit("player.pause", actual);
    }
    if (
      pendingSeek &&
      (Math.abs(actual - pendingSeek.time) < 0.1 || Date.now() - pendingSeek.requestedAt > 2000)
    ) {
      pendingSeek = undefined;
      emitter?.emit("player.seeked", actual);
    }
    emitter?.emit("player.timeupdate", actual);
    onTimeUpdate(actual);
  };
  return {
    init: async (events) => {
      emitter = events;
      destroyed = false;
      sync();
      emitter.emit("player.canplay");
      timer = setInterval(sync, 100);
    },
    destroy: () => {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      emitter = undefined;
    },
    play: async () => {
      if (available()) player.playVideo();
    },
    pause: () => {
      if (available()) player.pauseVideo();
    },
    isPlaying: () => available() && player.getPlayerState() === 1,
    isSeeking: () => Boolean(pendingSeek),
    getCurrentTime: () => time,
    getDuration: () => duration,
    seek: (requested) => {
      if (!available() || !Number.isFinite(requested)) return;
      const target = Math.max(0, Math.min(duration, requested));
      pendingSeek = { time: target, requestedAt: Date.now() };
      player.seekTo(target, true);
    },
  };
}
