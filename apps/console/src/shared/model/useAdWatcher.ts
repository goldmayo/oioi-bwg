import { useEffect, useState } from "react";
import gsap from "gsap";

import { clientLogger } from "@/shared/lib/client-logger";
import type { YouTubePlayerInstance } from "@/shared/model/youtube";

/** player/영상별 길이 기준과 ticker 수명을 함께 관리한다. */
export const useAdWatcher = (player: YouTubePlayerInstance | null, targetId: string) => {
  const [status, setStatus] = useState({ player, targetId, isAdPlaying: false });
  useEffect(() => {
    if (!player || !targetId) return;
    let targetDuration = 0;
    let wasAdPlaying = false;
    const checkAdStatus = () => {
      try {
        const currentId = player.getVideoData?.()?.video_id;
        const duration = player.getDuration?.() ?? 0;
        if (currentId === targetId && duration > 0 && targetDuration === 0)
          targetDuration = duration;
        const isAdPlaying = Boolean(
          (currentId && currentId !== targetId) ||
          (targetDuration > 0 && Math.abs(duration - targetDuration) > 2),
        );
        if (isAdPlaying !== wasAdPlaying) {
          clientLogger.debug(isAdPlaying ? "ad detected; sync paused" : "ad ended; sync resumed");
          wasAdPlaying = isAdPlaying;
        }
        setStatus((previous) =>
          previous.player === player &&
          previous.targetId === targetId &&
          previous.isAdPlaying === isAdPlaying
            ? previous
            : { player, targetId, isAdPlaying },
        );
      } catch {
        // 교체 중이거나 이미 파괴된 iframe은 다음 tick에서 확인한다.
      }
    };
    gsap.ticker.add(checkAdStatus);
    return () => gsap.ticker.remove(checkAdStatus);
  }, [player, targetId]);
  return status.player === player && status.targetId === targetId ? status.isAdPlaying : false;
};
