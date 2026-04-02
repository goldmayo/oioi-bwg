"use client";

import { useInAppBrowserOut } from "@/shared/hooks/useInAppBrowserOut";

/**
 * 인앱 브라우저 진입 시 기본 브라우저로 화면을 강제 전환시키는 투명 가드 컴포넌트입니다.
 * 최상단 루트 레이아웃(layout.tsx)에 마운트하여 사용합니다.
 */
export function InAppBrowserGuard() {
  useInAppBrowserOut();
  return null;
}
