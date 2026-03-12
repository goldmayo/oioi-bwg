import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // .env 파일에서 SENTRY_AUTH_TOKEN 등을 로드합니다.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
      sentryVitePlugin({
        org: "oioibawige",
        project: "cheer-rock-crab",
        // loadEnv를 통해 가져온 토큰을 사용합니다.
        authToken: env.SENTRY_AUTH_TOKEN,

        silent: false,

        sourcemaps: {
          // [핵심 수정] dist 폴더 내의 모든 하위 경로를 탐색하도록 설정합니다.
          assets: ["./dist/**"],

          // Cloudflare Workers 용량 제한 준수를 위해 업로드 후 반드시 삭제합니다.
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },

        bundleSizeOptimizations: {
          excludeDebugStatements: true,
          excludeReplayIframe: true,
        },
      }),
    ],
    build: {
      // 빌드 시 소스맵 생성을 활성화합니다.
      sourcemap: "hidden",
    },
  };
});
