/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 19 자동 메모이제이션 컴파일러 활성화
  reactCompiler: true,

  // 이미지 최적화 설정을 위한 외부 도메인 허용 (Cloudflare R2)
  images: {
    unoptimized: true, // Next.js의 기본 이미지 최적화 비활성화 (Cloudflare R2 사용 시)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.oioibawige.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // 서버 사이드 데이터 페칭 로그 강화 (캐시 히트/미스 확인용)
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  experimental: {
    // Next.js 16 핵심: 명시적 캐싱(use cache) 엔진 활성화
    cacheComponents: true,

    // 브라우저 Router Cache의 유효 기간(staleTime) 설정
    staleTimes: {
      dynamic: 30, // 동적 페이지: 30초 동안 브라우저에 캐싱 (이후 재요청)
      static: 60, // 정적 페이지: 60초 동안 브라우저에 캐싱
    },
    // ---------------------------------------------------------

    // instrumentation.ts 활성화
    instrumentationHook: true,
  },

  // 서버리스 환경에서 외부 바이너리 의존성 최적화
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
