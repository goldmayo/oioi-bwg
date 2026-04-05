# [Plan] 테스트 환경 구축 (Vitest & Playwright)

이 문서는 **Logic-First** 전략을 바탕으로, 유지보수 효율성을 극대화한 테스트 환경을 구축하기 위한 계획을 담고 있습니다. UI의 잦은 변화에 유연하게 대응하면서도 서비스의 핵심 가치(비즈니스 로직 및 사용자 흐름)를 견고하게 보호하는 것을 목표로 합니다.

## 1. 배경 및 목적
- **UI 중심 테스트의 한계**: 빈번한 디자인 변경 시 테스트 코드 수정 비용이 과도하게 발생함.
- **Logic-First 접근**: 복잡한 상태 변화가 일어나는 Hooks와 핵심 유틸리티 함수(Vitest), 그리고 전체 비즈니스 흐름(Playwright) 검증에 집중.
- **개발자 경험(DX)**: 빠른 피드백 루프를 제공하고, 기능 명세서 역할을 겸하는 테스트 코드 작성.

## 2. 테스트 전략 및 구조

### 2.1 Vitest (단위 및 로직 테스트)
- **대상**: Custom Hooks (`useAdminEditor`), Utils (`lrc-parser`), API Queries.
- **위치**: 소스 코드 파일과 동일한 위치에 배치 (**Colocation**).
  - 예: `src/features/manage-lyrics/useAdminEditor.test.ts`
- **핵심**: 컴포넌트 렌더링보다는 상태(State)와 액션(Action)의 정합성 검증.

### 2.2 Playwright (E2E 테스트)
- **대상**: 로그인, 가사 편집 저장 흐름, 모바일 반응형 레이아웃 확인.
- **위치**: `tests/e2e/` 폴더에 별도 관리.
- **핵심**: 실제 브라우저 환경에서의 유저 시나리오(Critical Path) 검증.

## 3. 상세 구현 단계

### Phase 1: Vitest & RTL 환경 설정
1. **의존성 설치**: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
2. **설정 통합**: `vite.config.ts`에 테스트 설정 추가 및 `vitest.setup.ts` 작성.
3. **첫 번째 테스트**: `useAdminEditor.ts`의 시간 캡처(`Q`) 및 행 추가(`E`) 로직 검증 코드 작성.

### Phase 2: Playwright 환경 설정
1. **의존성 설치**: `@playwright/test` 설치 및 브라우저 엔진 다운로드.
2. **설정 파일**: `playwright.config.ts` (Base URL, 모바일 디바이스 프로필 설정).
3. **인증 유지**: 테스트 간 세션 공유를 위한 `auth.setup.ts` 구성.
4. **시나리오 작성**: "관리자 로그인 -> 곡 선택 -> 가사 수정 -> 저장" 전체 흐름 테스트.

### Phase 3: 워크플로우 최적화
1. **스크립트 정의**: `test:unit`, `test:e2e`, `test:ui` 추가.
2. **Feature Flag 도입**: `env` 기반의 기능 활성화 제어 로직 기초 설계.

## 4. 기대 효과
- **안정성**: 가사 편집 중 발생하는 실수(시간 역전 등)를 로직 레벨에서 사전 차단.
- **속도**: Vite 기반의 빠른 테스트 실행으로 개발 생산성 향상.
- **신뢰**: 배포 전 핵심 유저 시나리오 자동 검증으로 장애 발생률 감소.
