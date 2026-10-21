import { MetadataRoute } from "next";

/**
 * robots.txt 설정
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://oioibawige.com/sitemap.xml",
  };
}
