# 커스텀 훅 테스트 가이드

**작성일**: 2025-01-18  
**기반**: common-test-guideline.md FIRST, Right-BICEP, CORRECT 원칙

## 목차

1. [커스텀 훅 테스트의 특수성](#커스텀-훅-테스트의-특수성)
2. [프로젝트 테스트 환경](#프로젝트-테스트-환경)
3. [단계별 테스트 작성 가이드](#단계별-테스트-작성-가이드)
4. [의존성 모킹 전략](#의존성-모킹-전략)
5. [실제 예시: useAdminEditor 테스트](#실제-예시-useadmineditor-테스트)
6. [주요 테스트 패턴](#주요-테스트-패턴)
7. [테스트 시나리오 체크리스트](#테스트-시나리오-체크리스트)

## 커스텀 훅 테스트의 특수성

### 일반 함수 테스트와의 차이점

```typescript
// ❌ 일반 함수처럼 직접 호출하면 안됨
const result = useAdminEditor({ song: mockSong }); // Error!

// ✅ renderHook을 사용해야 함
const { result } = renderHook(() => useAdminEditor({ song: mockSong }));
```

### React의 규칙을 따라야 하는 이유

- **Hooks Rules**: 컴포넌트 최상위에서만 호출 가능
- **Re-render**: 상태 변경 시 리렌더링 시뮬레이션 필요 (`act` 사용)
- **Cleanup**: 언마운트 시 이벤트 리스너/구독 해제 테스트
- **Context**: `AdminEditorProvider`와 같은 Context가 필요한 경우 래퍼 제공

## 프로젝트 테스트 환경

### 필수 라이브러리

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "vitest": "^2.0.0",
    "jsdom": "^24.0.0"
  }
}
```

### 기본 테스트 설정

```typescript
// tests/setup.ts
import "@testing-library/jest-dom";
import { vi } from "vitest";

// 서버 액션 모킹
vi.mock("@/features/manage-lyrics/actions", () => ({
  updateSongLyrics: vi.fn(),
}));

// Drizzle 쿼리 모킹
vi.mock("@/shared/api/db/drizzle/queries", () => ({
  getSongBySlug: vi.fn(),
}));
```

## 단계별 테스트 작성 가이드

### 1단계: 실제 구현체 분석

**❗ 중요**: 테스트 코드 작성 전 반드시 수행

```typescript
// 1. 훅의 인터페이스 확인
interface AdminEditorProps {
  song: Song;
}

// 2. 반환값 확인
const result = {
  lyrics: LyricLine[],
  isRecording: boolean,
  captureTime: (index: number) => void,
  saveLyrics: () => Promise<void>,
  // ...
};

// 3. 의존성 확인
import { useForm } from "react-hook-form";
import { updateSongLyrics } from "../actions";
```

### 2단계: 모킹 전략 수립

```typescript
// 의존성별 모킹 전략
const mockStrategies = {
  "Server Actions": "updateSongLyrics 결과를 성공/실패로 모킹",
  "YouTube Player": "player 객체와 getGetCurrentTime 메서드 모킹",
  "Browser API": "window.confirm 또는 toast 알림 모킹",
  Timers: "vi.useFakeTimers()로 재생 시간 시뮬레이션",
};
```

### 3단계: common-test-guideline.md 원칙 적용

```typescript
describe("useAdminEditor", () => {
  // FIRST 원칙
  beforeEach(() => {
    vi.clearAllMocks(); // Fast, Isolated
  });

  // Right-BICEP 원칙
  describe("기본 기능 (Right)", () => {
    it("should capture current player time to specific line", () => {
      // Given-When-Then 구조
    });
  });

  describe("경계 조건 (Boundary)", () => {
    // 첫 번째 행 이전으로 시간 캡처 시도, 마지막 행 이후 추가 등
  });

  describe("에러 조건 (Error)", () => {
    // 저장 실패, 유효하지 않은 시간 포맷 등
  });
});
```

## 의존성 모킹 전략

### YouTube Player 객체 모킹

```typescript
const mockPlayer = {
  getCurrentTime: vi.fn().mockReturnValue(12.5),
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  getPlayerState: vi.fn().mockReturnValue(1), // 1: Playing
};

// result.current.setPlayer(mockPlayer)로 주입
```

### Server Action 성공/실패 모킹

```typescript
import { updateSongLyrics } from "../actions";

// 성공 시
vi.mocked(updateSongLyrics).mockResolvedValue({ success: true });

// 실패 시
vi.mocked(updateSongLyrics).mockResolvedValue({ error: "권한이 없습니다." });
```

## 실제 예시: useAdminEditor 테스트

### 기본 구조

```typescript
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminEditor } from "../useAdminEditor";

describe("useAdminEditor", () => {
  const mockSong = {
    id: 1,
    title: "Discord",
    lyrics: [{ startTime: 0, text: "Intro", isExtra: false }],
    // ... 기타 필드
  };

  it("should initialize with song lyrics", () => {
    // Given: 훅 초기화
    const { result } = renderHook(() => useAdminEditor({ song: mockSong }));

    // Then: 가사 데이터가 정상적으로 로드됨
    expect(result.current.lyrics).toHaveLength(1);
    expect(result.current.lyrics[0].text).toBe("Discord");
  });

  it("should toggle recording mode", () => {
    const { result } = renderHook(() => useAdminEditor({ song: mockSong }));

    // When: 녹화 모드 토글
    act(() => {
      result.current.setIsRecording(true);
    });

    // Then: 상태 반영 확인
    expect(result.current.isRecording).toBe(true);
  });
});
```

### 비즈니스 로직 테스트 (시간 캡처)

```typescript
it("should update line time when captureTime is called", () => {
  const { result } = renderHook(() => useAdminEditor({ song: mockSong }));

  // Given: 플레이어 상태 모킹
  const mockPlayer = { getCurrentTime: () => 45.2 };
  act(() => {
    result.current.setPlayer(mockPlayer as any);
  });

  // When: 0번째 행에 대해 시간 캡처 실행
  act(() => {
    result.current.captureTime(0);
  });

  // Then: 해당 행의 startTime이 업데이트됨
  expect(result.current.lyrics[0].startTime).toBe(45.2);
});
```

## 주요 테스트 패턴

### 패턴 1: 상태 연쇄 변경 (자동 다음 행 이동)

```typescript
it("should move to next line after capture if recording is ON", () => {
  const { result } = renderHook(() => useAdminEditor({ song: mockSong }));

  act(() => {
    result.current.setIsRecording(true);
    result.current.setPlayer({ getCurrentTime: () => 10 } as any);
  });

  act(() => {
    result.current.captureTime(0);
  });

  // 0번 캡처 후 자동으로 1번 행으로 포커스 이동 확인
  expect(result.current.currentIndex).toBe(1);
});
```

### 패턴 2: 비동기 저장 및 알림

```typescript
it("should show success toast when save is successful", async () => {
  // Given: 서버 액션 성공 설정
  vi.mocked(updateSongLyrics).mockResolvedValue({ success: true });
  const { result } = renderHook(() => useAdminEditor({ song: mockSong }));

  // When: 저장 실행
  await act(async () => {
    await result.current.handleSave();
  });

  // Then: 서버 액션이 호출됨
  expect(updateSongLyrics).toHaveBeenCalled();
});
```

## 테스트 시나리오 체크리스트

### ✅ 기본 기능 (FIRST - Right)

- [ ] 초기 가사 데이터 로드 확인
- [ ] 녹화 모드(`isRecording`) 토글 동작
- [ ] 재생 시간 업데이트 구독(`subscribeToTime`) 확인

### ✅ 경계 조건 (Right-BICEP - Boundary)

- [ ] 가사가 없는 곡 처리
- [ ] 0초 미만 또는 곡 길이 초과 시간 캡처 시도
- [ ] 마지막 행에서 캡처 후 다음 행 이동 동작 (무시 또는 종료)

### ✅ 반대 조건 (Right-BICEP - Inverse)

- [ ] 녹화 모드 OFF일 때 캡처 시 다음 행으로 이동하지 않음 확인
- [ ] 저장 취소 시 상태가 유지되는지 확인

### ✅ 교차 검증 (Right-BICEP - Cross-check)

- [ ] `lyrics` 배열의 개수가 UI 행 개수와 일치하는지
- [ ] 전체 오프셋 적용 시 모든 행의 시간이 일관되게 변하는지

### ✅ 에러 조건 (Right-BICEP - Error)

- [ ] 네트워크 단절 시 저장 실패 처리
- [ ] 유효하지 않은 YouTube ID 입력 시 플레이어 에러 핸들링

---

**참고 문서**:

- [common-test-guideline.md](./common-test-guideline.md)
- [React Testing Library (RTL) 공식 문서](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest 공식 문서](https://vitest.dev/)
