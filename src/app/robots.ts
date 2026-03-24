"use cache";

import { MetadataRoute } from "next";

/**
 * robots.txt 설정
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = "https://oioibawige.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login/"], // 관리자 페이지는 수집 제외
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
