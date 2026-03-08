/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. React 19 자동 메모이제이션 컴파일러 활성화
  reactCompiler: true,

  // 2. 서버 사이드 데이터 페칭 로그 강화 (캐시 히트/미스 확인용)
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  experimental: {
    // 3. Next.js 16 핵심: 명시적 캐싱(use cache) 엔진 활성화
    cacheComponents: true,
  },

  // 5. 서버리스 환경에서 외부 바이너리 의존성 최적화
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
