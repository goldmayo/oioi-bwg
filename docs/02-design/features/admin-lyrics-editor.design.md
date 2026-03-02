# [Design] 어드민 가사 편집기 (Admin Lyrics Editor)

## 1. 개요 (Overview)
- **목적:** 어드민 가사 편집기의 핵심 로직(상태 관리, 유튜브 연동, 싱크 캡처)을 설계하여 구현의 안정성을 확보.
- **주요 구성 요소:** `useLyricsEditor` 커스텀 훅, `YoutubePlayer` 컴포넌트, `LrcImporter` 컴포넌트.

## 2. 데이터 흐름 설계 (Data Flow)
1. **Load:** Server Component에서 `prisma.song.findUnique` 호출하여 데이터 로드.
2. **Initialize:** `useLyricsEditor` 훅에 로드된 가사 데이터 주입.
3. **Sync:** YouTube IFrame API의 `getCurrentTime()`을 100ms 주기로 폴링하여 `currentTime` 상태 업데이트.
4. **Action:** 스페이스바 클릭 시 `captureTime(currentIndex)` 실행하여 현재 시간을 해당 행에 기록하고 다음 행으로 포커스 이동.
5. **Save:** `LyricLineSchema`로 검증 후 Server Actions 호출하여 DB 업데이트.

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
  // State: lyrics, currentIndex, isRecording 등
  // Methods:
  // - captureTime(): 현재 유튜브 시간을 lyrics[currentIndex]에 주입
  // - updateLine(index, partialLine): 특정 행 수정
  // - importLrc(text): parseLrc 유틸을 사용하여 가사 일괄 주입
  // - undo() / redo(): 작업 기록 되돌리기
};
```

### 3.2 `YoutubePlayer.tsx`
- **Props:** `videoId`, `onTimeUpdate(time)`, `onStateChange(state)`
- **특징:** YouTube IFrame API를 직접 제어하여 정밀한 시간 정보를 부모 컴포넌트(`useLyricsEditor`)에 전달.

### 3.3 `AdminEditorLayout.tsx` (UI Structure)
- **Top:** `YoutubePlayer` + Global Actions (Save, Reset, Export).
- **Center:** `LyricTable` (Shadcn Table) - 각 행은 `LyricRow` 컴포넌트로 구성.
- **Bottom:** **GSAP Preview Rail** - 현재 시간에 맞춰 가사 노드들이 수평으로 흐르는 시각화.

## 4. UI/UX 상세 설계
- **Hotkeys:**
  - `Space`: 현재 행 싱크 캡처 + 다음 행 이동.
  - `Ctrl + Z`: Undo.
  - `Ctrl + S`: 저장 (Save Action).
- **Validation UI:**
  - `startTime`이 이전 행보다 느릴 경우 해당 행 배경색을 `bg-destructive/10`으로 변경.
  - 필수 필드 누락 시 저장 버튼 비활성화.

## 5. 정합성 및 테스트 설계
- **Snapshot Test:** `stringifyLrc(parseLrc(sample))` 결과가 원본과 동일한지 확인.
- **Constraint:** `startTime`은 반드시 오름차순이어야 함 (자동 정렬 기능 포함).

---
*Created by Gemini CLI (bkit PDCA methodology)*
