import { useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * YouTube 광고를 감지하고 상태를 반환하는 훅
 * @param player 유튜브 플레이어 객체 (YT.Player)
 * @param targetId 재생하고자 하는 원본 영상 ID
 */
export const useAdWatcher = (player: any, targetId: string) => {
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [targetDuration, setTargetDuration] = useState(0);

  // 1. 영상 로드 시 원본 길이를 한 번 저장합니다.
  // 광고가 아닌 정상 상태에서만 길이를 갱신하도록 보호 로직을 추가합니다.
  useEffect(() => {
    if (player && typeof player.getDuration === "function" && !isAdPlaying) {
      const d = player.getDuration();
      const videoData = typeof player.getVideoData === "function" ? player.getVideoData() : null;
      const currentVideoId = videoData?.video_id;

      // 현재 재생 중인 ID가 원본과 일치하고 길이가 유효할 때만 타겟 길이를 설정
      if (d > 0 && currentVideoId === targetId) {
        setTargetDuration(d);
      }
    }
  }, [player, targetId, isAdPlaying]);

  useGSAP(() => {
    if (!player || !targetId) return;

    /**
     * 프레임 단위로 광고 상태를 체크하는 내부 함수
     * 성능을 위해 React State 업데이트는 상태가 변할 때만 수행합니다.
     */
    const checkAdStatus = () => {
      try {
        const videoData = typeof player.getVideoData === "function" ? player.getVideoData() : null;
        const currentId = videoData?.video_id;
        const currentDuration = typeof player.getDuration === "function" ? player.getDuration() : 0;

        // Heuristic: ID가 다르거나 길이가 원곡과 다를 때 (2초 이상 차이) 광고로 간주
        const adDetected = (currentId && currentId !== targetId) || 
                           (targetDuration > 0 && Math.abs(currentDuration - targetDuration) > 2);

        // 상태가 실제로 변했을 때만 setState를 호출하여 성능 저하 방지
        if (adDetected !== isAdPlaying) {
          setIsAdPlaying(adDetected);

          if (adDetected) {
            console.log("🚫 [useAdWatcher] 광고 감지됨: 동기화 일시정지");
          } else {
            console.log("✅ [useAdWatcher] 광고 종료됨: 동기화 재개");
          }
        }
      } catch (_e) {
        // 플레이어 초기화 또는 API 응답 지연 시 발생하는 에러 무시
      }
    };

    // GSAP Ticker에 등록하여 60fps로 감시 (성능 최적화)
    gsap.ticker.add(checkAdStatus);
    return () => gsap.ticker.remove(checkAdStatus);
  }, [player, isAdPlaying, targetId, targetDuration]);

  return isAdPlaying;
};

