import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // env-cmd나 파일에서 읽어온 CLOUDFLARE_ENV가 있으면 process.env에 주입하여 Wrangler 환경을 선택합니다.
  if (env.CLOUDFLARE_ENV) {
    process.env.CLOUDFLARE_ENV = env.CLOUDFLARE_ENV;
  }

  console.log(
    `[Vite] Mode: ${mode}, Cloudflare Target: ${process.env.CLOUDFLARE_ENV || "production"}`,
  );

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
      // Sentry 빌드 타임 최적화 및 소스맵 업로드 설정
      sentryVitePlugin({
        org: "oioibawige",
        project: "cheer-rock-crab",
        authToken: env.SENTRY_AUTH_TOKEN,
        // 빌드 로그 정돈
        silent: true,
        // 보안: 업로드 완료 후 빌드 결과물에서 소스맵 파일(.map) 자동 삭제
        sourcemaps: {
          // filesToDeleteAfterUpload: ["./dist/**/*.map", "./.vinext/**/*.map"],
        },
        // 서버리스(Cloudflare) 환경을 위한 번들 사이즈 최적화
        bundleSizeOptimizations: {
          excludeDebugStatements: true,
          excludeReplayIframe: true,
        },
      }),
      // 번들 사이즈 분석 (ANALYZE=true 일 때만 리포트 생성)
      process.env.ANALYZE === "true" &&
        visualizer({
          filename: "./dist/report.html",
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    build: {
      sourcemap: "hidden",
    },
  };
});
