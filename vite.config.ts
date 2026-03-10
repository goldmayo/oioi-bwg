import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }), // Sentry 빌드 타임 최적화 및 소스맵 업로드 설정
    sentryVitePlugin({
      org: "oioibawige",
      project: "cheer-rock-crab",
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // 빌드 로그 정돈
      silent: true,

      // 보안: 업로드 완료 후 빌드 결과물에서 소스맵 파일(.map) 자동 삭제
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map", "./.vinext/**/*.map"],
      },

      // 서버리스(Cloudflare) 환경을 위한 번들 사이즈 최적화
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayIframe: true,
      },
    }),
  ],
  build: {
    sourcemap: true,
  },
});
