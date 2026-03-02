# Design: User Lyrics Viewer (실시간 응원법 뷰어)

사용자 페이지의 핵심인 싱크 뷰어의 컴포넌트 구조, 데이터 흐름, 애니메이션 수치를 상세 설계합니다.

## 1. 컴포넌트 계층 구조 (Component Hierarchy)
- **`SongDetailPage (Server)`**: 데이터 페칭 및 메타데이터 설정.
  - **`LyricsViewerClient (Client)`**: 싱크 엔진 제어 및 레이아웃 관리.
    - **`YoutubePlayer`**: IFrame API 연동 및 `onPlayerReady` 콜백 제공.
    - **`LyricsScrollArea`**: GSAP 스냅 스크롤 대상 컨테이너.
      - **`LyricLineItem`**: 개별 행 렌더링, `isActive` 상태에 따른 모션 적용.

## 2. 데이터 흐름 (Data Flow)
1. **Fetch:** `prisma.song.findUnique`를 통해 JSON 가사 로드.
2. **State:** `currentTime`을 `useAdWatcher`와 공유하여 광고 여부 판별.
3. **Logic:** `isAdPlaying`이 `false`일 때만 `currentIndex`를 업데이트.
4. **Motion:** `currentIndex` 변경 시 GSAP `to` 명령어로 스크롤 위치 이동.

## 3. 애니메이션 명세 (Motion Spec)
- **Smart Snap:** 
  - Target: `.lyrics-container`
  - Method: `gsap.to(container, { scrollTo: targetElement, duration: 0.6, ease: "power2.out" })`
  - Position: 활성 행이 컨테이너 상단에서 30% 지점에 위치하도록 계산.
- **Focus Transition:**
  - `scale`: 1.0 -> 1.05
  - `opacity`: 0.4 -> 1.0 (비활성 행은 블러/투명도 처리)
  - `duration`: 0.3s
- **Extra Expansion:**
  - `height`: 0 -> auto
  - `ease`: "elastic.out(1, 0.75)"

## 4. 광고 대응 UX (Ad-Aware UI)
- `isAdPlaying` 상태일 때 가사 영역 상단에 **"유튜브 광고 중... 싱크를 대기합니다."** 오버레이 표시.
- 영상 복귀 시 `player.getCurrentTime()`으로 `currentIndex` 즉시 재보정.

## 5. 타입 정의 (Types)
```typescript
interface LyricsViewerProps {
  song: {
    id: number;
    title: string;
    youtubeId: string;
    lyrics: LyricLine[];
  };
}
```

---
─────────────────────────────────────────────────
📊 bkit Feature Usage Report
─────────────────────────────────────────────────
✅ Used: /pdca design, bkit rules, frontend-architect
⏭️ Not Used: phase-6-ui-integration (구현 단계에서 사용 예정)
💡 Recommended: 설계 승인 시 `/pdca do` 단계로 이동하여 구현 시작
─────────────────────────────────────────────────
