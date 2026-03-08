/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 16 표준: 명시적 캐싱 활성화
    cacheComponents: true,
  },
};

export default nextConfig;
