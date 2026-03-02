import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useState } from "react";

import { YouTubePlayerInstance } from "@/types/youtube";

/**
 * YouTube 광고를 감지하고 상태를 반환하는 훅
 * @param player 유튜브 플레이어 객체
 * @param targetId 재생하고자 하는 원본 영상 ID
 */
export const useAdWatcher = (player: YouTubePlayerInstance | null, targetId: string) => {
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [targetDuration, setTargetDuration] = useState(0);

  // 1. 영상 로드 시 원본 길이를 한 번 저장합니다.
  // 에러 해결: setState를 비동기적으로 호출하여 cascading render 경고를 방지합니다.
  useEffect(() => {
    if (!player || typeof player.getDuration !== "function" || isAdPlaying) return;

    const d = player.getDuration();
    const videoData = typeof player.getVideoData === "function" ? player.getVideoData() : null;
    const currentVideoId = videoData?.video_id;

    if (d > 0 && currentVideoId === targetId && targetDuration === 0) {
      // 비동기 처리를 통해 이펙트 실행 직후의 동기적 상태 변경 방지
      const timer = setTimeout(() => {
        setTargetDuration(d);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [player, targetId, isAdPlaying, targetDuration]);

  useGSAP(() => {
    if (!player || !targetId) return;

    /**
     * 프레임 단위로 광고 상태를 체크하는 내부 함수
     */
    const checkAdStatus = () => {
      try {
        const videoData = typeof player.getVideoData === "function" ? player.getVideoData() : null;
        const currentId = videoData?.video_id;
        const currentDuration = typeof player.getDuration === "function" ? player.getDuration() : 0;

        // Heuristic: ID가 다르거나 길이가 원곡과 다를 때 (2초 이상 차이) 광고로 간주
        const adDetected = (currentId && currentId !== targetId) || 
                           (targetDuration > 0 && Math.abs(currentDuration - targetDuration) > 2);

        if (adDetected !== isAdPlaying) {
          setIsAdPlaying(adDetected);
          
          if (adDetected) {
            console.log("🚫 [useAdWatcher] 광고 감지됨: 동기화 일시정지");
          } else {
            console.log("✅ [useAdWatcher] 광고 종료됨: 동기화 재개");
          }
        }
      } catch (_e) {
        // 무시
      }
    };

    gsap.ticker.add(checkAdStatus);
    return () => gsap.ticker.remove(checkAdStatus);
  }, [player, isAdPlaying, targetId, targetDuration]);

  return isAdPlaying;
};
