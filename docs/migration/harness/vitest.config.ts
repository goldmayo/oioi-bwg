import { defineConfig } from "vitest/config";

/**
 * 테스트 설정을 `vite.config.ts`와 분리합니다.
 *
 * 앱 설정에는 tailwind·router 생성기·devtools 플러그인이 달려 있는데 **단위 테스트에는 하나도 필요 없습니다.**
 * 같이 쓰면 테스트를 돌릴 때마다 라우트 트리를 재생성하고 CSS를 컴파일합니다.
 *
 * `environment: "node"`인 것도 의도입니다 — 지금 대상은 전부 **순수 함수**(날짜 계산·페이징 변환·
 * 봉투 처리)라 DOM이 없습니다. jsdom을 붙이면 의존성과 실행 시간만 늘어납니다.
 * 컴포넌트 테스트가 실제로 필요해지면 그때 `environmentMatchGlobs`로 파일 단위로 켭니다.
 */
export default defineConfig({
  // `@/` 별칭을 tsconfig에서 그대로 읽습니다 (vite 8 네이티브 옵션)
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /** 날짜 계산이 로컬 자정 기준이라 실행 환경 타임존이 바뀌면 결과가 달라집니다 — 고정합니다 */
    env: { TZ: "Asia/Seoul" },
  },
});
