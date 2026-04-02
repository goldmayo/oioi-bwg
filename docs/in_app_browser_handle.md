# 카톡 인앱 브라우저 탈출

실제로 B2C(일반 사용자 타겟) 서비스, 특히 공유 기능이 핵심인 앱에서는 카카오톡/인스타 등의 인앱 브라우저(In-App Browser) 탈출 로직이 필수입니다. 인앱 브라우저는 브라우저 스토리지 연동, 상태 유지, Web Share API 호출 등에서 알 수 없는 버그와 제약이 많다.

## 인앱 브라우저 탈출 로직

- 세션 스토리지(sessionStorage) 검증의 중요성: 두 번째 코드처럼 무한 리다이렉트 방지 로직(EXTERNAL_REDIRECT_FLAG_KEY)이 없으면 외부 브라우저를 띄우지 못했을 때 앱이 끝없이 새로고침되는 치명적인 루프에 빠질 수 있습니다.
- 확실한 안드로이드/카카오톡 대응: 카카오톡 전용 스킴(kakaotalk://web/openExternal)과 안드로이드 크롬 인텐트(intent://...;package=com.android.chrome;end)는 현재로서 가장 확실한 네이티브 브라우저 호출 방법입니다.
- (주의점) iOS 기기에서는 window.open('\_blank') 방식이 보안이나 팝업 차단에 의해 막히는 경우가 많습니다. iOS 환경에서 다른 앱(인스타 등)으로 열렸을 때는 어쩔 수 없이 클립보드 복사 유도를 하거나 화면 하단에 알림 배너를 작게 띄우는 것이 차선책이 될 수 있습니다만, 우리나라 트래픽 대다수를 차지하는 카카오톡/안드로이드 유저를 확실히 내보낼 수 있다는 점에서 이 코드는 엄청난 효과를 발휘합니다.

## 커스텀 훅 작성 및 호출 위치

해당 로직은 여러 페이지가 아니라 "유저가 어느 링크로 접속하든, 최초 진입 시 즉각적으로 단 한 번만" 실행되어야 합니다.

따라서 특정 page.tsx 내부가 아닌 전역을 관장하는 최상단 루트, 즉 **src/app/layout.tsx**에 두어야 합니다. 적용하는 방법인 Next.js App Router 기준의 베스트 프랙티스는 다음과 같습니다.

### Step 1. 클라이언트 전용 컴포넌트(Guard) 생성

로직 특성상 window와 navigator에 접근해야 하므로 서버 컴포넌트인 Layout 안에는 직접 넣을 수 없습니다. 다음과 같이 훅을 감싸고 UI를 반환하지 않는 가벼운 Guard 컴포넌트를 만듭니다.

```typescript
// src/shared/hooks/useInAppBrowserOut.ts
"use client";

import { useEffect } from "react";

const IN_APP_BROWSER_REGEX = /kakaotalk|instagram|naver|line|twitter/i;
const EXTERNAL_REDIRECT_FLAG_KEY = "has_redirected";

export function useInAppBrowserOut() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isInAppBrowser = IN_APP_BROWSER_REGEX.test(userAgent);

    // 일반 브라우저면 검사 안 함
    if (!isInAppBrowser) {
      sessionStorage.removeItem(EXTERNAL_REDIRECT_FLAG_KEY);
      return;
    }

    // 이미 리다이렉트 시도를 한 적 있으면 무한 루프 방지
    if (sessionStorage.getItem(EXTERNAL_REDIRECT_FLAG_KEY) === "1") return;
    sessionStorage.setItem(EXTERNAL_REDIRECT_FLAG_KEY, "1");

    const currentUrl = window.location.href;

    // 카카오톡 탈출
    if (/kakaotalk/.test(userAgent)) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
      return;
    }

    // 안드로이드 타 인앱 탈출 시도 (크롬 인텐트 활용)
    if (/android/.test(userAgent)) {
      const cleanUrl = currentUrl.replace(/^https?:\/\//, "");
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
  }, []);
}

// src/shared/components/InAppBrowserGuard.tsx
("use client");

export function InAppBrowserGuard() {
  useInAppBrowserOut();
  return null; // UI를 그리지 않고 훅만 실행시키는 투명망토 역할
}
```

### Step 2. 루트 레이아웃(layout.tsx) 최상단에 마운트

공유 링크를 통해 어이 어이 바위게의 어떤 페이지든(홈페이지 접속이 아닌 특정 응원법 상세 페이지 직행이더라도) 바로 발동되게 합니다.

```typescript
// src/app/layout.tsx
import { InAppBrowserGuard } from "@/shared/components/InAppBrowserGuard";
// ... 다른 임포트들

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* 이 가드가 렌더링되자마자 브라우저 환경을 체크해 쫓아냅니다 */}
        <InAppBrowserGuard />

        {/* 실제 화면 렌더링 영역 */}
        {children}
      </body>
    </html>
  );
}
```
