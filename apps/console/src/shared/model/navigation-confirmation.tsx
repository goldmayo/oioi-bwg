"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";

type Navigation = () => void;
type Blocker = (navigate: Navigation) => void;
const context = createContext<{ current: Blocker | null } | null>(null);

/** 링크가 아닌 이동 의도를 현재 폼의 확인 UI에 전달한다. 라우터·이력은 소유하지 않는다. */
export function NavigationConfirmationProvider({ children }: { children: ReactNode }) {
  const blockerRef = useRef<Blocker | null>(null);
  return <context.Provider value={blockerRef}>{children}</context.Provider>;
}

export function useConfirmNavigation() {
  const blockerRef = useContext(context);
  return useCallback(
    (navigate: Navigation) => {
      if (blockerRef?.current) blockerRef.current(navigate);
      else navigate();
    },
    [blockerRef],
  );
}

export function useNavigationBlocker(block: Blocker | null) {
  const blockerRef = useContext(context);
  useEffect(() => {
    if (!blockerRef) return;
    blockerRef.current = block;
    return () => {
      if (blockerRef.current === block) blockerRef.current = null;
    };
  }, [block, blockerRef]);
}
