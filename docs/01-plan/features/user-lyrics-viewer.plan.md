# Plan: User Lyrics Viewer (실시간 응원법 뷰어)

사용자가 유튜브 영상을 시청하며 실시간으로 동기화된 응원법을 확인할 수 있는 핵심 뷰어 페이지를 구축합니다.

## 1. 목표 (Goals)
- 유튜브 영상 재생 시간과 가사 데이터의 완벽한 60fps 동기화.
- 응원법 타입(`Echo`, `Extra`)별 직관적인 시각적 차별화.
- 광고 상황에서도 끊김 없는 사용자 경험(UX) 제공.
- 모바일 친화적인 스택 레이아웃 및 부드러운 스크롤 애니메이션.

## 2. 핵심 기능 (Features)
- **[F-1] Sync Engine:** `useAdWatcher`를 통합한 고성능 타임 폴링 엔진.
- **[F-2] Motion Sync (GSAP Integration):**
  - **Smart Center Snapping:** GSAP `offsetY` 기능을 활용하여 활성 가사 행을 화면 중앙으로 자동 스냅.
  - **Focus Effects:** 현재 행 강조(`scale: 1.05`, `font-black`) 및 비활성 행 블러 처리.
- **[F-3] Inline Cheer UI:**
  - **Main:** 일반 가사 (Bold weight).
  - **Echo:** 브랜드 컬러 (`qwer-w`) + 밑줄 강조.
  - **Extra:** 가사 사이의 독립 박스 + 배경색 (`qwer-e`) + 이탤릭 효과.
- **[F-4] Interaction:** 특정 가사 행 클릭 시 해당 시점으로 영상 이동 (Seek).
- **[F-5] Ad Feedback:** 광고 감지 시 가사 진행 일시정지 및 UI 안내 메시지 표시.

## 3. 기술 설계 (Technical Design)
- **페이지 경로:** `src/app/(user)/songs/[slug]/page.tsx`
- **핵심 컴포넌트:**
  - `YoutubePlayer`: 관리자에서 검증된 고성능 IFrame 래퍼 재사용.
  - `LyricsViewerClient`: 싱크 로직 및 전체 레이아웃 제어.
- **애니메이션 엔진:** GSAP (`ScrollToPlugin` 활용).
- **데이터 페칭:** Server Components에서 **Drizzle Queries**를 통해 곡 데이터(JSON 가사 포함) 조회.

## 4. UI/UX 전략
- **Layout:** Vinext Viewport 고정형 레이아웃 (`h-dvh`), 가변적인 비디오/가사 비율.
- **Color:** 다크 모드 기반, 멤버/앨범 브랜드 컬러 적극 활용.
- **Typography:** 반응형 폰트 사이즈 (모바일 `text-2xl`, 데스크탑 `lg:text-4xl`).

---
*Created by Gemini CLI (bkit PDCA methodology)*
