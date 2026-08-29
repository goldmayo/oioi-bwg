/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // React 19 자동 메모이제이션 컴파일러 활성화
  reactCompiler: true,

  // 현재 외부 asset URL을 그대로 사용한다. 최종 provider 정책은 M8에서 확정한다.
  images: {
    unoptimized: true, // 기존 외부 asset URL을 그대로 사용
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

  // standalone Node runtime에서 postgres.js를 외부 패키지로 유지한다.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
