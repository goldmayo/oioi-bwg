# [Design] 어드민 가사 편집기 (Admin Lyrics Editor)

## 1. 개요 (Overview)
- **목적:** 어드민 가사 편집기의 핵심 로직(상태 관리, 유튜브 연동, 싱크 캡처)을 설계하여 구현의 안정성을 확보.
- **주요 구성 요소:** `useLyricsEditor` 커스텀 훅, `YoutubePlayer` 컴포넌트, `LrcImporter` 컴포넌트.

## 2. 데이터 흐름 설계 (Data Flow)
1. **Load:** Server Component에서 `getSongBySlug` (Queries) 호출하여 데이터 로드.
2. **Initialize:** `useLyricsEditor` 훅에 로드된 가사 데이터 주입.
3. **Sync:** YouTube IFrame API의 `getCurrentTime()`을 100ms 주기로 폴링하여 `currentTime` 상태 업데이트.
4. **Action:** 스페이스바 클릭 시 `captureTime(currentIndex)` 실행하여 현재 시간을 해당 행에 기록하고 다음 행으로 포커스 이동.
5. **Save:** `LyricLineSchema`로 검증 후 `updateSong` (Commands) 호출하여 DB 업데이트.

## 3. 핵심 모듈 설계 (Core Modules)

### 3.1 `useLyricsEditor.ts` (Custom Hook)
```typescript
interface EditorState {
  lyrics: LyricLine[];
  currentIndex: number;
  isRecording: boolean;
  history: LyricLine[][]; // Undo/Redo용
}

const useLyricsEditor = (initialLyrics: LyricLine[]) => {
  // Methods:
  // - captureTime(): 현재 유튜브 시간을 lyrics[currentIndex]에 주입
  // - updateLine(index, partialLine): 특정 행 수정
  // - importLrc(text): parseLrc 유틸을 사용하여 가사 일괄 주입
};
```

### 3.2 `YoutubePlayer.tsx`
- **Props:** `videoId`, `onTimeUpdate(time)`, `onStateChange(state)`
- **특징:** YouTube IFrame API를 직접 제어하여 정밀한 시간 정보를 부모 컴포넌트에 전달.

## 4. UI/UX 상세 설계
- **Commands Layer:** `src/libs/db/drizzle/commands.ts`를 통한 물리적 DB 접근 캡슐화.
- **Viewport Control:** Vinext `proxy.ts`를 통한 관리자 권한 보호.

---
*Created by Gemini CLI (bkit methodology)*
