"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string) {
  // 1. 상태 구독 로직 (지정된 query의 상태가 바뀔 때만 callback 실행)
  const subscribe = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query);

      // resize 대신 change 이벤트를 사용하면 중단점을 교차할 때만 실행되어 성능이 매우 좋습니다.
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    [query],
  );

  // 2. 현재 브라우저의 실제 상태를 가져오는 로직
  const getSnapshot = () => window.matchMedia(query).matches;

  // 3. 서버 사이드 렌더링(SSR) 시 초기 렌더링 상태 (Hydration 에러 방지)
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
