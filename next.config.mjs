import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 19 자동 메모이제이션 컴파일러 활성화
  reactCompiler: true,
  cacheComponents: true, // Next.js 16 명시적 캐싱 엔진 활성화

  // 서버 사이드 데이터 페칭 로그 강화 (캐시 히트/미스 확인용)
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  experimental: {
    // 브라우저 Router Cache의 유효 기간(staleTime) 설정
    staleTimes: {
      dynamic: 0, // 동적 페이지: 즉시 만료 (병렬 라우트 유령 DOM 방지)
      static: 180, // 정적 페이지: 캐싱 유지
    },
  },

  // 서버리스 환경에서 외부 바이너리 의존성 최적화
  serverExternalPackages: ["postgres"],
};

export default withSentryConfig(nextConfig, {
  org: "oioibawige",
  project: "cheer-rock-crab",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
    reactComponentAnnotation: {
      enabled: true,
    },
  },
});
