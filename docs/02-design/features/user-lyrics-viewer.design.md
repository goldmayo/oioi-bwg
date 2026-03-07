# Design: User Lyrics Viewer (실시간 응원법 뷰어)

사용자 페이지의 핵심인 싱크 뷰어의 컴포넌트 구조, 데이터 흐름, 애니메이션 수치를 상세 설계합니다.

## 1. 컴포넌트 계층 구조 (Component Hierarchy)
- **`SongDetailPage (Server)`**: `getSongBySlug` (Queries) 호출 및 메타데이터 설정.
  - **`LyricsViewerClient (Client)`**: 싱크 엔진 제어 및 레이아웃 관리.
    - **`YoutubePlayer`**: IFrame API 연동 및 `onPlayerReady` 콜백 제공.
    - **`Lyrics 영역`**: GSAP 센터 앵커링 대상 컨테이너.

## 2. 데이터 흐름 (Data Flow)
1. **Fetch:** Drizzle Queries를 통해 JSON 가사 로드.
2. **State:** `currentTime`을 `useAdWatcher`와 공유하여 광고 여부 판별.
3. **Logic:** `isAdPlaying`이 `false`일 때만 `currentIndex`를 업데이트.
4. **Motion:** `currentIndex` 변경 시 GSAP `scrollTo`와 `offsetY` 기능을 활용해 부드러운 센터링 구현.

## 3. 애니메이션 명세 (Motion Spec)
- **Smart Center Snapping:** 
  - Target: `.lyrics-container`
  - Method: `gsap.to(container, { scrollTo: { y: target, offsetY: container.offsetHeight / 2 } })`
  - Position: 활성 행이 가시 영역의 정확한 50% 지점에 위치하도록 동적 계산.
- **Focus Transition:**
  - `scale`: 1.0 -> 1.05
  - `opacity`: 0.15 -> 1.0 (비활성 행은 블러/투명도 처리)
  - `translate`: 활성 행 좌측 여백 강조 (`translate-x-2` 보존)

## 4. 광고 대응 UX (Ad-Aware UI)
- `isAdPlaying` 상태일 때 가사 영역에 **"Ad Playing..."** 오버레이 표시.
- 광고 종료 시 싱크 엔진 자동 재개.

---
*Created by Gemini CLI (bkit methodology)*
