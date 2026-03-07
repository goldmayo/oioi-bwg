# [Plan] 어드민 가사 편집기 (Admin Lyrics Editor)

## 1. 개요 (Overview)
- **기능명:** 어드민 가사 편집기 (Admin Lyrics Editor)
- **목적:** YouTube IFrame API와 연동하여 실시간으로 가사 싱크(Timestamp)를 캡처하고, 응원법 속성을 편집하여 DB에 저장하는 관리자 도구 구축.
- **주요 가치:** 데이터 입력 오류 방지, 작업 시간 단축, 실시간 프리뷰를 통한 싱크 정확도 확보.

## 2. 사용자 스토리 (User Stories)
- **LRC 임포트:** 관리자는 외부에서 가져온 `.lrc` 텍스트를 붙여넣어 즉시 편집을 시작할 수 있다.
- **실시간 싱크 캡처:** 관리자는 영상을 재생하며 스페이스바를 눌러 각 가사 행의 `startTime`을 즉시 기록할 수 있다.
- **속성 편집:** 관리자는 각 가사 줄에 대해 `isCheer`, `isEcho`, `isExtra` 속성을 클릭 한 번으로 지정할 수 있다.
- **실시간 프리뷰:** 관리자는 수정한 내용이 사용자 화면에서 어떻게 보일지 하단 레일 프리뷰를 통해 즉시 확인할 수 있다.
- **DB 저장:** 관리자는 저장 버튼을 클릭하여 **Drizzle Commands** 레이어를 거쳐 데이터를 즉시 업데이트할 수 있다.

## 3. 핵심 기능 (Key Features)
- [x] **LRC Parser:** `.lrc` 텍스트 ↔ `LyricLine[]` JSON 변환 유틸리티.
- [x] **YouTube Sync Hook:** 플레이어 시간과 가사 행을 매칭하고 캡처하는 커스텀 훅 (`useLyricsEditor`).
- [x] **Admin Sidebar:** 앨범별 곡 선택 내비게이션 (Shadcn Accordion).
- [x] **Lyrics Editor UI:** 가사 수정 테이블 및 속성 토글 컨트롤.
- [x] **GSAP Preview Rail:** 실시간 동기화된 애니메이션 프리뷰.
- [x] **Mutation Layer:** Drizzle ORM 기반 데이터 저장 및 `revalidatePath` 처리.

## 4. 기술 스택 및 라이브러리 (Tech Stack)
- **Framework:** Vinext (Vite-based App Router)
- **Styling:** Tailwind CSS 4, Shadcn UI (Accordion, Table, Dialog, Button)
- **Animation:** GSAP (`@gsap/react`)
- **State/Validation:** React `useState`, `zod`
- **Database:** Drizzle ORM (Supabase)

## 5. 단계별 구현 계획 (Phases)
### Phase 1: 기반 마련 (Foundation)
- `zod` 설치 및 `types/lyrics.ts` 스키마 정의.
- `utils/lrc-parser.ts` 파싱 로직 구현 및 테스트.

### Phase 2: 핵심 로직 (Core Logic)
- `useLyricsEditor` 커스텀 훅 개발 (상태 관리, Undo/Redo, Sync 캡처).
- YouTube IFrame API 연동 기본 플레이어 컴포넌트 개발.

### Phase 3: UI 및 통합 (UI & Integration)
- 어드민 레이아웃 및 곡 선택 사이드바 구현.
- 가사 편집 테이블 및 제어 UI 구현.
- GSAP 기반 실시간 프리뷰 레일 구현.

### Phase 4: 저장 및 검증 (Persistence & QA)
- Drizzle Commands 구현 및 DB 연동.
- Zod 스키마 검증 및 에러 처리.
- 핵심 시나리오 테스트.

## 6. 검증 전략 (Verification Strategy)
- **유닛 테스트:** `lrc-parser.ts`가 다양한 LRC 포맷을 정확히 파싱하는지 확인.
- **통합 테스트:** `saveSongData` 액션을 통한 데이터 저장이 Drizzle을 통해 정상적으로 반영되는지 확인.
- **품질 지표:** 
  - 스페이스바 캡처 반응성 (Latency < 50ms).
  - 저장 실패 시 데이터 복구 기능 작동 여부.
  - UI 정합성 (이전 행보다 빠른 시간 설정 시 경고 표시).

---
*Created by Gemini CLI (bkit PDCA methodology)*
