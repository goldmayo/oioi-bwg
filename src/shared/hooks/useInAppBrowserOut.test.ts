import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInAppBrowserOut } from "./useInAppBrowserOut";

describe("useInAppBrowserOut Hook", () => {
  const originalLocation = window.location;
  const originalNavigator = window.navigator;

  beforeEach(() => {
    // DOM 관련 전역 객체 Mocking 설정 (window.location 덮어쓰기)
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "https://example.com/test", replace: vi.fn() },
    });

    // navigator.userAgent 덮어쓰기 가능하도록 속성 열기
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: { userAgent: "" },
    });

    // 기본적으로 매 단위 테스트마다 세션 스토리지 초기화
    sessionStorage.clear();
  });

  afterEach(() => {
    // 테스트 후 본래 환경으로 복구
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    Object.defineProperty(window, "navigator", { configurable: true, value: originalNavigator });
    vi.restoreAllMocks();
  });

  it("일반 브라우저(Chrome/Safari) 환경이면 아무 동작도 하지 않고 sessionStorage를 초기화한다.", () => {
    // Given
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    });
    sessionStorage.setItem("has_redirected", "1");

    // When
    renderHook(() => useInAppBrowserOut());

    // Then
    expect(sessionStorage.getItem("has_redirected")).toBeNull();
    expect(window.location.href).toBe("https://example.com/test");
  });

  it("카카오톡(KakaoTalk) 인앱 환경이면 전용 스킴으로 외부 브라우저를 호출하고 상태를 마킹한다.", () => {
    // Given
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) KAKAOTALK 10.0.0",
    });

    // When
    renderHook(() => useInAppBrowserOut());

    // Then
    expect(sessionStorage.getItem("has_redirected")).toBe("1");
    // URL 컴포넌트가 퍼센트(URL) 인코딩된 상태여야 함
    expect(window.location.href).toBe("kakaotalk://web/openExternal?url=https%3A%2F%2Fexample.com%2Ftest");
  });

  it("안드로이드(Android) 타 인앱(Instagram 등) 환경이면 크롬 앱 인텐트 스킴으로 강제 우회한다.", () => {
    // Given
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 Instagram 300.0.0.0",
    });

    // When
    renderHook(() => useInAppBrowserOut());

    // Then
    expect(sessionStorage.getItem("has_redirected")).toBe("1");
    expect(window.location.href).toBe("intent://example.com/test#Intent;scheme=https;package=com.android.chrome;end");
  });

  it("이미 리다이렉트를 시도한 상태(sessionStorage 1)라면 무한루프 방지를 위해 추가 우회 동작을 하지 않는다.", () => {
    // Given
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 13; SM-G991N) AppleWebKit/537.36 KAKAOTALK 10.0.0",
    });
    sessionStorage.setItem("has_redirected", "1"); // 이미 시도됨 마킹

    // When
    renderHook(() => useInAppBrowserOut());

    // Then
    // 상태값이 변하지 않아야 하며, location.href 도 기본값에서 변하지 않아야 함
    expect(sessionStorage.getItem("has_redirected")).toBe("1");
    expect(window.location.href).toBe("https://example.com/test");
  });
});
