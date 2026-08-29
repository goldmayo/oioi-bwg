import babel from "@rolldown/plugin-babel";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
    /**
     * React Compiler — 이 저장소의 코드는 컴파일러를 전제로 씁니다(수동 memo/useCallback 금지,
     * `docs/guide/07-forms.md`). 템플릿 정리 때 플러그인만 빠지고 전제가 남아 한동안
     * "자동도 수동도 없는" 상태였습니다 — 감사 §1 (docs/plan/2026-08-20-defect-audit.md).
     * `eslint-plugin-react-hooks` v7의 컴파일러 규칙 16종은 이미 전부 통과 상태였습니다.
     * plugin-react v6은 oxc 기반이라 babel 옵션이 없고, `@rolldown/plugin-babel` 경유가 공식 경로입니다.
     */
    babel({ presets: [reactCompilerPreset()] }),
    // 번들 treemap — 예산 초과 원인 추적용. `npm run analyze`(--mode analyze)에서만 dist/stats.html 생성
    mode === "analyze" ? visualizer({ filename: "dist/stats.html", gzipSize: true }) : undefined,
  ],
  /**
   * 표출 기기(스탠바이미 2)가 webOS 24 = Chromium 108이라 CSS·JS 하한을 108로 못 박습니다.
   * CSS는 Tailwind **3.4**(PostCSS 파이프라인 — postcss.config.mjs)가 색을 채널 변수
   * `rgb(var(--x) / a)`(Chrome 65+)로 합성하므로 v4의 color-mix(111+) 문제가 원천에 없고,
   * 벤더 프리픽스는 autoprefixer가 .browserslistrc(chrome >= 108)를 읽어 처리합니다.
   * v4 → 3.4 전환 경위: docs/plan 2026-08-26 (108 호환 3안 실측 비교).
   */
  // manifest: 경로별 번들 리포트(scripts/bundle-report.mjs)가 청크 그래프를 읽는 원천
  build: { manifest: true, target: "chrome108", cssTarget: "chrome108" },
}));

export default config;
