import { vi } from "vitest";

// 두 앱의 jsdom 테스트가 공유하는 브라우저 API mock.
// Node로 명시한 서버 테스트에는 DOM matcher/mock을 설치하지 않는다.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
