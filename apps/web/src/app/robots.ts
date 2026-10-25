import { MetadataRoute } from "next";

import { SITE_CONFIG } from "@/shared/config/site";

/**
 * robots.txt 설정
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  };
}
