// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "cheer-rock-crab",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    // SST Ion은 --stage 값에 따라 .env.staging 또는 .env.production을 자동으로 로드합니다.
    // 따라서 별도의 분기 로직 없이 process.env를 직접 사용하면 됩니다.

    // Vinext(Nitro)가 생성한 서버 핸들러를 AWS Lambda로 띄웁니다.
    const server = new sst.aws.Function("VinextServer", {
      handler: ".output/server/index.handler",
      url: true, // Function URL 활성화
      memory: "1024 MB",
      timeout: "15 seconds",
      architecture: "arm64",
      logging: {
        retention: "1 day", // 비용 방어: 로그 1일 보관
      },
      environment: {
        // 🔥 배포되는 환경은 항상 최적화 모드(production)여야 합니다.
        NODE_ENV: "production", 
        DATABASE_URL: process.env.DATABASE_URL!,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
        // 현재 환경(staging/production) 구분은 전용 변수를 사용합니다.
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: $app.stage,
      },
    });

    // 콜드 스타트 방지 (Warming) - 5분마다 람다 호출 (최신 CronV2 적용)
    new sst.aws.CronV2("Warmer", {
      schedule: "rate(5 minutes)",
      function: {
        handler: "scripts/warm.handler",
        environment: {
          TARGET_URL: server.url,
        }
      }
    });

    return {
      url: server.url,
    };
  },
});

