"use cache";

import { MetadataRoute } from "next";

/**
 * robots.txt 설정
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login/"], // 관리자 페이지는 수집 제외
    },
    sitemap: "https://oioibawige.com/sitemap.xml",
  };
}
