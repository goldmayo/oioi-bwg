// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "oioi-bawige",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: "ap-northeast-2", // 🔥 서울 리전 고정
        },
      },
    };
  },
  async run() {
    const site = new sst.aws.Nextjs("OioibawigeWeb", {
      warm: 0, // 과금 방지를 위해 Provisioned Concurrency는 끕니다.
      transform: {
        server: {
          memory: "1024 MB", // 🔥 성능 최적화: 서버 람다 메모리 증설
        },
      },

      environment: {
        NODE_ENV: "production", // 배포 환경은 스테이지와 상관없이 항상 최적화(production) 모드여야 합니다.
        NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || $app.stage,
        DATABASE_URL: process.env.DATABASE_URL!,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: $app.stage,
      },
    });

    // 가성비 웜업 (비용 0원)
    new sst.aws.CronV2("Warmer", {
      schedule: "rate(5 minutes)",
      function: {
        handler: "scripts/warm.handler",
        environment: {
          TARGET_URL: site.url,
        },
      },
    });

    return {
      url: site.url,
    };
  },
});
