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
  - **Smart Snap Scroll:** 현재 가사 행을 화면 상단 1/3 지점으로 자동 스냅 스크롤.
  - **Focus Effects:** 현재 행 확대(`scale: 1.05`) 및 글로우(`glow`) 효과로 시선 집중.
  - **Reveal Animation:** `isEcho`는 마스킹 리빌, `isExtra`는 박스 확장 애니메이션 적용.
- **[F-3] Inline Cheer UI:**
  - **Main:** 일반 가사 (Regular weight).
  - **Echo:** 볼드 + 밑줄 + 브랜드 컬러 (`qwer-w`) + 마스킹 효과.
  - **Extra:** 가사 사이의 독립 박스 + 배경색 (`qwer-e`) + 이탤릭 + 슬라이드 업 효과.
- **[F-4] Interaction:** 특정 가사 행 클릭 시 해당 시점으로 영상 이동 (Seek).
- **[F-5] Ad Feedback:** 광고 감지 시 가사 진행 일시정지 및 UI 안내 메시지 표시.

## 3. 기술 설계 (Technical Design)
- **페이지 경로:** `src/app/(user)/songs/[id]/page.tsx`
- **핵심 컴포넌트:**
  - `YoutubePlayer`: 관리자에서 검증된 고성능 IFrame 래퍼 재사용.
  - `LyricsViewerClient`: 싱크 로직 및 전체 레이아웃 제어.
  - `LyricLineItem`: 개별 가사 행 렌더링 및 애니메이션 적용.
- **애니메이션 엔진:** GSAP (ScrollToPlugin 활용 예정).
- **데이터 페칭:** Server Components에서 Prisma를 통해 곡 데이터(JSON 가사 포함) 조회.

## 4. UI/UX 전략
- **Layout:** 상단 40% 유튜브(Fixed/Sticky), 하단 60% 가사 영역.
- **Color:** 다크 모드 기반, 멤버/앨범 브랜드 컬러 적극 활용.
- **Typography:** 가독성 높은 폰트 사이즈 및 행간 확보.

## 5. 단계별 작업 계획 (Tasks)
1. `src/app/(user)/songs/[id]/page.tsx` 서버 컴포넌트 및 기본 레이아웃 구성.
2. `LyricsViewerClient` 싱크 엔진 및 `useAdWatcher` 연동.
3. 가사 타입별 스타일링 및 `LyricLineItem` 구현.
4. GSAP 기반 스마트 스냅 스크롤 로직 정교화.
5. 최종 타입 체크 및 디자인 디테일 보정.

---
─────────────────────────────────────────────────
📊 bkit Feature Usage Report
─────────────────────────────────────────────────
✅ Used: /pdca plan, bkit rules, frontend-architect
⏭️ Not Used: phase-6-ui-integration (구현 단계에서 사용 예정)
💡 Recommended: 위 기획안 승인 시 `/pdca design` 단계로 이동
─────────────────────────────────────────────────
