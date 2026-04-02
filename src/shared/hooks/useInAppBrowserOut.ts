"use client";

import { useEffect } from "react";

// 대표적인 인앱 브라우저(웹뷰) User-Agent 정규식 패턴 모음
const IN_APP_BROWSER_REGEX = /kakaotalk|instagram|naver|line|twitter/i;

// 무한 리다이렉트 역루프 방지를 위한 세션 스토리지 플래그 키
const EXTERNAL_REDIRECT_FLAG_KEY = "has_redirected";

/**
 * 모바일 인앱 브라우저 접속을 감지하여 기기의 기본 브라우저(크롬, 사파리 등)로
 * 외부 강제 연결을 유도하는 커스텀 훅입니다.
 */
export function useInAppBrowserOut() {
  useEffect(() => {
    // 1. 브라우저 환경이 아닐 경우(SSR 렌더링 중일 때) 조기 종료
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isInAppBrowser = IN_APP_BROWSER_REGEX.test(userAgent);
    
    // 2. 인앱 브라우저가 아니라면(기본 브라우저라면) 스토리지 플래그 데이터 초기화 후 종료
    if (!isInAppBrowser) {
      sessionStorage.removeItem(EXTERNAL_REDIRECT_FLAG_KEY);
      return;
    }

    // 3. 인앱 환경이지만 이미 우회를 시도한 적이 있는 유저라면(1 값) 무한 루프 방지를 위해 조기 종료
    if (sessionStorage.getItem(EXTERNAL_REDIRECT_FLAG_KEY) === "1") return;
    
    // 이번 사이클에 즉각적으로 우회를 시도함을 세션에 마킹 (성공/실패 무관)
    sessionStorage.setItem(EXTERNAL_REDIRECT_FLAG_KEY, "1");

    const currentUrl = window.location.href;

    // 4-A. 카카오톡 인앱 환경: 전용 오픈 스킴(kakaotalk://web/openExternal)을 사용하여 외부 브라우저 띄우기
    if (/kakaotalk/.test(userAgent)) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
      return;
    }

    // 4-B. 타 인앱 기기 (안드로이드) 환경: 시스템 크롬 인텐트 기능을 사용하여 강제 크롬 앱 호출
    if (/android/.test(userAgent)) {
      const cleanUrl = currentUrl.replace(/^https?:\/\//, ""); // 인텐트 스킴 특성상 HTTP/HTTPS 부분 제거
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
  }, []);
}
